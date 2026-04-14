/**
 * EIOPA Ingestion Fetcher
 *
 * Scrapes the EIOPA document library across four sections (guidelines,
 * technical-standards, opinions, supervisory-statements), walks each section
 * with `?page=N` pagination until empty, follows each publication detail
 * page, downloads the attached PDF (or HTML fallback), extracts text, and
 * writes per-document `<filename>.meta.json` files into `data/raw/`.
 *
 * Sections:
 *   /document-library/guidelines_en             → Solvency II Guidelines
 *   /document-library/technical-standards_en    → Technical Standards (ITS/RTS)
 *   /document-library/opinions_en               → Opinions (under Solvency II Guidelines category)
 *   /document-library/supervisory-statements_en → Supervisory Statements
 *
 * Usage:
 *   npx tsx scripts/ingest-fetch.ts
 *   npx tsx scripts/ingest-fetch.ts --dry-run       # log what would be fetched
 *   npx tsx scripts/ingest-fetch.ts --force          # re-download existing files
 *   npx tsx scripts/ingest-fetch.ts --limit 5        # fetch only first N documents
 *   npx tsx scripts/ingest-fetch.ts --section=guidelines    # single section
 */

import * as cheerio from "cheerio";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = "https://www.eiopa.europa.eu";
const RAW_DIR = "data/raw";
const RATE_LIMIT_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE_MS = 2000;
const REQUEST_TIMEOUT_MS = 60_000;
const USER_AGENT = "Ansvar-MCP/1.0 (regulatory-data-ingestion; https://ansvar.eu)";
const MAX_PAGES_PER_SECTION = 30; // safety cap; real sections top out at ~4

interface SectionDefinition {
  slug: string;                 // URL path segment
  category: string;             // DB category label
}

const SECTIONS: SectionDefinition[] = [
  { slug: "guidelines",             category: "Solvency II Guidelines" },
  { slug: "technical-standards",    category: "Technical Standards (ITS/RTS)" },
  { slug: "opinions",               category: "Solvency II Guidelines" },
  { slug: "supervisory-statements", category: "Solvency II Guidelines" },
];

// CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const fetchLimit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "999999", 10) : 999999;
const sectionFlag = args.find((a) => a.startsWith("--section="))?.split("=")[1];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentLink {
  title: string;              // taken from listing page anchor / og:title
  detailUrl: string;          // /publications/<slug>_en
  category: string;           // section-derived category
  section: string;            // section slug
}

interface ResolvedDocument extends DocumentLink {
  pdfUrl: string | null;      // direct PDF if attached, else null
  filename: string;           // pdf filename or html-slug
  publicationDate: string | null;
  metaDescription: string | null;
}

interface FetchedDocument {
  title: string;
  url: string;                // original publication detail URL
  pdfUrl: string | null;
  category: string;
  section: string;
  filename: string;
  text: string;
  publicationDate: string | null;
  metaDescription: string | null;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const backoff = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.error(
        `  Attempt ${attempt + 1}/${retries} failed for ${url}: ${lastError.message}. ` +
          `Retrying in ${backoff}ms...`,
      );
      if (attempt < retries - 1) await sleep(backoff);
    }
  }
  throw lastError ?? new Error(`All retries failed for ${url}`);
}

// ---------------------------------------------------------------------------
// PDF text extraction
// ---------------------------------------------------------------------------

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(pdfBuffer);
    return data.text ?? "";
  } catch (err) {
    console.error(
      `  Warning: PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "";
  }
}

// ---------------------------------------------------------------------------
// Listing page scraping (paginated)
// ---------------------------------------------------------------------------

async function scrapeSectionListing(section: SectionDefinition): Promise<DocumentLink[]> {
  const links: DocumentLink[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES_PER_SECTION; page++) {
    const listUrl = `${BASE_URL}/document-library/${section.slug}_en?page=${page}`;
    console.log(`  Listing: ${listUrl}`);
    let html: string;
    try {
      const response = await fetchWithRetry(listUrl);
      html = await response.text();
    } catch (err) {
      console.error(`  Listing fetch failed on page ${page}: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }

    const $ = cheerio.load(html);
    const pageLinks: DocumentLink[] = [];

    $('a[href*="/publications/"][href$="_en"]').each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const title = $(el).text().trim().replace(/\s+/g, " ");
      if (!href || !title) return;

      const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
      // Normalize: strip fragments
      const normalized = fullUrl.split("#")[0]!;

      if (seen.has(normalized)) return;
      seen.add(normalized);

      pageLinks.push({
        title,
        detailUrl: normalized,
        category: section.category,
        section: section.slug,
      });
    });

    if (pageLinks.length === 0) {
      console.log(`  Page ${page}: 0 new links — end of section ${section.slug}`);
      break;
    }

    console.log(`  Page ${page}: +${pageLinks.length} items`);
    links.push(...pageLinks);

    // Rate limit between listing pages
    await sleep(RATE_LIMIT_MS);
  }

  return links;
}

// ---------------------------------------------------------------------------
// Detail page → PDF resolution
// ---------------------------------------------------------------------------

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/%20/g, "-")
    .replace(/%/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

async function resolveDetailPage(doc: DocumentLink): Promise<ResolvedDocument | null> {
  let html: string;
  try {
    const response = await fetchWithRetry(doc.detailUrl);
    html = await response.text();
  } catch (err) {
    console.error(`  Detail fetch failed for ${doc.detailUrl}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  const $ = cheerio.load(html);

  // Prefer og:title for clean title
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || doc.title;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;

  // Publication date: look for the definition list entry
  let publicationDate: string | null = null;
  $("dt").each((_, el) => {
    const label = $(el).text().trim().toLowerCase();
    if (label === "publication date") {
      const dateText = $(el).next("dd").text().trim();
      if (dateText) publicationDate = dateText;
    }
  });
  if (!publicationDate) {
    const og = $('meta[property="og:updated_time"]').attr("content");
    if (og) publicationDate = og.slice(0, 10);
  }

  // Find the primary PDF attachment. EIOPA lists the main document first on
  // detail pages, followed by annexes and supporting materials. We therefore
  // pick the first `/document/download/` link whose filename ends in `.pdf`
  // and skip zip bundles and annex-only attachments when a main PDF exists.
  const pdfAnchors: { url: string; filename: string; isAnnex: boolean }[] = [];
  $('a[href*="/document/download/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href) return;
    const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const filenameMatch = fullUrl.match(/filename=([^&]+)/);
    const rawName = filenameMatch ? decodeURIComponent(filenameMatch[1]!) : `doc-${pdfAnchors.length + 1}.pdf`;
    // Skip non-PDF bundle attachments entirely
    if (!rawName.toLowerCase().endsWith(".pdf")) return;
    const lowerName = rawName.toLowerCase();
    const isAnnex = lowerName.startsWith("annex") || lowerName.includes(" annex ") || / annex [ivx0-9]/i.test(rawName);
    pdfAnchors.push({ url: fullUrl, filename: rawName, isAnnex });
  });

  // Prefer first non-annex PDF; fall back to first annex; else null
  const chosen = pdfAnchors.find((a) => !a.isAnnex) ?? pdfAnchors[0] ?? null;

  // Unique filename per detail URL (avoid collisions when multiple docs share the same PDF name)
  const slug = doc.detailUrl.replace(/^https?:\/\/[^/]+/, "").replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]/g, "-").slice(0, 80);
  const filename = chosen
    ? `${slug}__${sanitizeFilename(chosen.filename)}`
    : `${slug}.html`;

  return {
    ...doc,
    title: ogTitle,
    pdfUrl: chosen?.url ?? null,
    filename,
    publicationDate,
    metaDescription,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
    console.log(`Created directory: ${RAW_DIR}`);
  }

  const sectionsToProcess = sectionFlag
    ? SECTIONS.filter((s) => s.slug === sectionFlag)
    : SECTIONS;

  if (sectionsToProcess.length === 0) {
    console.error(`No matching section for --section=${sectionFlag}`);
    process.exit(1);
  }

  // ---- Phase 1: list all publication detail URLs ---------------------------
  console.log(`\n== Phase 1: discovery ==`);
  const allLinks: DocumentLink[] = [];
  const seen = new Set<string>();
  for (const section of sectionsToProcess) {
    console.log(`\nSection: ${section.slug}`);
    const links = await scrapeSectionListing(section);
    for (const l of links) {
      if (seen.has(l.detailUrl)) continue;
      seen.add(l.detailUrl);
      allLinks.push(l);
    }
  }
  console.log(`\nDiscovered ${allLinks.length} unique publication pages`);

  if (allLinks.length > fetchLimit) {
    console.log(`Limiting to first ${fetchLimit}`);
  }
  const targetLinks = allLinks.slice(0, fetchLimit);

  if (dryRun) {
    console.log("\n[DRY RUN] Would resolve + download:");
    for (const l of targetLinks) {
      console.log(`  [${l.section}] ${l.title} → ${l.detailUrl}`);
    }
    return;
  }

  // ---- Phase 2: resolve each detail page and download the PDF --------------
  console.log(`\n== Phase 2: resolve + download ==`);
  const fetched: FetchedDocument[] = [];
  let skipped = 0;
  let errors = 0;

  // Pre-scan already-fetched detail URLs from existing meta files so we can
  // skip them without a detail-page round trip.
  const alreadyFetchedUrls = new Set<string>();
  if (!force && existsSync(RAW_DIR)) {
    const { readdirSync, readFileSync } = await import("node:fs");
    for (const f of readdirSync(RAW_DIR)) {
      if (!f.endsWith(".meta.json")) continue;
      try {
        const meta = JSON.parse(readFileSync(join(RAW_DIR, f), "utf8")) as { url?: string };
        if (meta.url) alreadyFetchedUrls.add(meta.url);
      } catch {
        // ignore
      }
    }
    if (alreadyFetchedUrls.size > 0) {
      console.log(`Found ${alreadyFetchedUrls.size} already-fetched documents — will skip without refetching detail pages`);
    }
  }

  for (let i = 0; i < targetLinks.length; i++) {
    const link = targetLinks[i]!;
    console.log(`[${i + 1}/${targetLinks.length}] ${link.title}`);
    console.log(`  Detail: ${link.detailUrl}`);

    if (!force && alreadyFetchedUrls.has(link.detailUrl)) {
      console.log(`  Skipping (already fetched)`);
      skipped++;
      continue;
    }

    const resolved = await resolveDetailPage(link);
    await sleep(RATE_LIMIT_MS);

    if (!resolved) {
      errors++;
      continue;
    }

    const destPath = join(RAW_DIR, resolved.filename);
    const metaPath = join(RAW_DIR, `${resolved.filename}.meta.json`);

    if (!force && existsSync(metaPath)) {
      console.log(`  Skipping (exists): ${resolved.filename}`);
      skipped++;
      continue;
    }

    let text = "";
    try {
      if (resolved.pdfUrl) {
        console.log(`  PDF: ${resolved.pdfUrl}`);
        const response = await fetchWithRetry(resolved.pdfUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(destPath, buffer);
        console.log(`  Downloaded: ${buffer.length.toLocaleString()} bytes → ${destPath}`);
        text = await extractPdfText(buffer);
        console.log(`  Extracted text: ${text.length.toLocaleString()} chars`);
      } else {
        console.log(`  No PDF attachment — storing HTML detail page`);
        const response = await fetchWithRetry(resolved.detailUrl);
        const html = await response.text();
        writeFileSync(destPath, html, "utf8");
        // Use cheerio to extract text content for the record
        const $ = cheerio.load(html);
        $("script, style, nav, header, footer").remove();
        text = $("main").text().replace(/\s+/g, " ").trim() || $("body").text().replace(/\s+/g, " ").trim();
        console.log(`  Extracted HTML text: ${text.length.toLocaleString()} chars`);
      }

      const meta: FetchedDocument = {
        title: resolved.title,
        url: resolved.detailUrl,
        pdfUrl: resolved.pdfUrl,
        category: resolved.category,
        section: resolved.section,
        filename: resolved.filename,
        text,
        publicationDate: resolved.publicationDate,
        metaDescription: resolved.metaDescription,
        fetchedAt: new Date().toISOString(),
      };

      writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
      fetched.push(meta);
    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }

    // Rate limit between documents
    if (i < targetLinks.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  const summary = {
    fetchedAt: new Date().toISOString(),
    discovered: allLinks.length,
    attempted: targetLinks.length,
    fetched: fetched.length,
    skipped,
    errors,
    bySection: SECTIONS.map((s) => ({
      section: s.slug,
      count: fetched.filter((d) => d.section === s.slug).length,
    })),
    documents: fetched.map((d) => ({
      title: d.title,
      filename: d.filename,
      section: d.section,
      category: d.category,
      pdfUrl: d.pdfUrl,
      publicationDate: d.publicationDate,
      textLength: d.text.length,
    })),
  };

  writeFileSync(join(RAW_DIR, "fetch-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nFetch complete: ${fetched.length} fetched, ${skipped} skipped, ${errors} errors`);
  console.log(`Summary: ${join(RAW_DIR, "fetch-summary.json")}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
