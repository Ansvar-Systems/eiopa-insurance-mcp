/**
 * EIOPA Ingestion Fetcher
 *
 * Fetches the EIOPA publications portal, extracts insurance and pensions regulation
 * links, downloads PDFs, and extracts text content for database ingestion.
 *
 * Usage:
 *   npx tsx scripts/ingest-fetch.ts
 *   npx tsx scripts/ingest-fetch.ts --dry-run     # log what would be fetched
 *   npx tsx scripts/ingest-fetch.ts --force        # re-download existing files
 *   npx tsx scripts/ingest-fetch.ts --limit 5      # fetch only first N documents
 */

import * as cheerio from "cheerio";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, basename } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = "https://www.eiopa.europa.eu";
const PORTAL_URL = `${BASE_URL}/publications/guidelines`;
const RAW_DIR = "data/raw";
const RATE_LIMIT_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE_MS = 2000;
const REQUEST_TIMEOUT_MS = 60_000;
const USER_AGENT = "Ansvar-MCP/1.0 (regulatory-data-ingestion; https://ansvar.eu)";

// Keywords to identify insurance/pensions-relevant EIOPA documents
const EIOPA_KEYWORDS = [
  "solvency",
  "orsa",
  "internal model",
  "technical provision",
  "own funds",
  "scr",
  "mcr",
  "governance",
  "outsourcing",
  "cloud",
  "iorp",
  "pension",
  "dora",
  "ict risk",
  "digital operational resilience",
  "ict third-party",
  "underwriting",
  "reinsurance",
  "group supervision",
  "reporting",
  "disclosure",
  "sfcr",
  "rsr",
  "qrt",
  "sustainability",
  "climate",
];

// CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const fetchLimit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "999", 10) : 999;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentLink {
  title: string;
  url: string;
  category: string;
  filename: string;
}

interface FetchedDocument {
  title: string;
  url: string;
  category: string;
  filename: string;
  text: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
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
    // Dynamic import to avoid top-level issues with pdf-parse
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
// EIOPA portal scraping
// ---------------------------------------------------------------------------

function isEiopaRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  return EIOPA_KEYWORDS.some((kw) => lower.includes(kw));
}

async function scrapePortal(): Promise<DocumentLink[]> {
  console.log(`Fetching EIOPA publications portal: ${PORTAL_URL}`);
  const response = await fetchWithRetry(PORTAL_URL);
  const html = await response.text();
  const $ = cheerio.load(html);

  const links: DocumentLink[] = [];

  // EIOPA publications page uses anchor tags with href pointing to PDFs and document pages
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const title = $(el).text().trim();

    if (!href || !title) return;
    if (!href.toLowerCase().endsWith(".pdf") && !href.includes("/publications/") && !href.includes("/guidelines")) return;
    if (!isEiopaRelevant(title)) return;

    const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const rawFilename = basename(href.split("?")[0] ?? href);
    const filename = rawFilename || `eiopa-doc-${links.length + 1}.pdf`;

    // Infer category from title or URL path
    let category = "Solvency II Guidelines";
    const lowerTitle = title.toLowerCase();
    const lowerHref = href.toLowerCase();
    if (lowerTitle.includes("iorp") || lowerTitle.includes("pension")) {
      category = "DORA & IORP II";
    } else if (lowerTitle.includes("dora") || lowerTitle.includes("ict") || lowerTitle.includes("digital operational")) {
      category = "DORA & IORP II";
    } else if (lowerTitle.includes("its") || lowerTitle.includes("rts") || lowerTitle.includes("implementing technical") || lowerTitle.includes("regulatory technical")) {
      category = "Technical Standards (ITS/RTS)";
    } else if (lowerHref.includes("technical-standard")) {
      category = "Technical Standards (ITS/RTS)";
    }

    // Avoid duplicates
    if (links.some((l) => l.url === fullUrl)) return;

    links.push({ title, url: fullUrl, category, filename });
  });

  // If scraping yielded nothing (portal may require JS), log and return known documents
  if (links.length === 0) {
    console.warn("  Warning: No links found via scraping. Portal may require JavaScript rendering.");
    console.warn("  Falling back to known EIOPA document list.");
    return getKnownDocuments();
  }

  return links;
}

function getKnownDocuments(): DocumentLink[] {
  return [
    {
      title: "Guidelines on Own Risk and Solvency Assessment (ORSA)",
      url: "https://www.eiopa.europa.eu/document-library/guidelines/guidelines-own-risk-and-solvency-assessment_en",
      category: "Solvency II Guidelines",
      filename: "eiopa-bos-14-253-orsa-guidelines.pdf",
    },
    {
      title: "Guidelines on System of Governance",
      url: "https://www.eiopa.europa.eu/document-library/guidelines/guidelines-system-governance_en",
      category: "Solvency II Guidelines",
      filename: "eiopa-bos-14-259-system-of-governance.pdf",
    },
    {
      title: "Guidelines on Outsourcing to Cloud Service Providers",
      url: "https://www.eiopa.europa.eu/document-library/guidelines/guidelines-outsourcing-cloud-service-providers_en",
      category: "Solvency II Guidelines",
      filename: "eiopa-bos-20-600-cloud-outsourcing.pdf",
    },
    {
      title: "Guidelines on Valuation of Technical Provisions",
      url: "https://www.eiopa.europa.eu/document-library/guidelines/guidelines-valuation-technical-provisions_en",
      category: "Solvency II Guidelines",
      filename: "eiopa-bos-14-166-technical-provisions.pdf",
    },
    {
      title: "Guidelines on Supervisory Reporting and Public Disclosure",
      url: "https://www.eiopa.europa.eu/document-library/guidelines/guidelines-supervisory-reporting-public-disclosure_en",
      category: "Solvency II Guidelines",
      filename: "eiopa-bos-14-180-reporting-disclosure.pdf",
    },
    {
      title: "Guidelines on Group Solvency",
      url: "https://www.eiopa.europa.eu/document-library/guidelines/guidelines-group-solvency_en",
      category: "Solvency II Guidelines",
      filename: "eiopa-bos-14-175-group-solvency.pdf",
    },
    {
      title: "RTS on ICT Risk Management Framework under DORA",
      url: "https://www.eiopa.europa.eu/publications/rts-ict-risk-management-framework-dora_en",
      category: "DORA & IORP II",
      filename: "eiopa-dora-rts-ict-risk-management-2024.pdf",
    },
    {
      title: "RTS on ICT Third-Party Risk Management under DORA",
      url: "https://www.eiopa.europa.eu/publications/rts-ict-third-party-risk-dora_en",
      category: "DORA & IORP II",
      filename: "eiopa-dora-rts-ict-tprm-2024.pdf",
    },
    {
      title: "Guidelines on Governance and Risk Assessment under IORP II",
      url: "https://www.eiopa.europa.eu/document-library/guidelines/guidelines-governance-iorp-ii_en",
      category: "DORA & IORP II",
      filename: "eiopa-bos-19-856-iorp-governance.pdf",
    },
    {
      title: "Commission Delegated Regulation EU 2015/35 — Solvency II Level 2",
      url: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32015R0035",
      category: "Technical Standards (ITS/RTS)",
      filename: "eu-2015-35-solvency-ii-delegated-regulation.pdf",
    },
    {
      title: "ITS on Supervisory Reporting QRT Templates — EU 2015/2450",
      url: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32015R2450",
      category: "Technical Standards (ITS/RTS)",
      filename: "eu-2015-2450-its-qrt-templates.pdf",
    },
    {
      title: "ITS on SFCR Public Disclosure Templates — EU 2015/2452",
      url: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32015R2452",
      category: "Technical Standards (ITS/RTS)",
      filename: "eu-2015-2452-its-sfcr-templates.pdf",
    },
    {
      title: "EIOPA Opinion on Sustainability Risks in Solvency II",
      url: "https://www.eiopa.europa.eu/publications/opinion-sustainability-risks-solvency-ii_en",
      category: "Solvency II Guidelines",
      filename: "eiopa-bos-23-456-sustainability-opinion.pdf",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
    console.log(`Created directory: ${RAW_DIR}`);
  }

  let documents = await scrapePortal();
  console.log(`Found ${documents.length} EIOPA-relevant documents`);

  if (documents.length > fetchLimit) {
    documents = documents.slice(0, fetchLimit);
    console.log(`Limiting to ${fetchLimit} documents`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would fetch:");
    for (const doc of documents) {
      console.log(`  ${doc.title} → ${doc.filename}`);
    }
    return;
  }

  const fetched: FetchedDocument[] = [];
  let skipped = 0;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!;
    const destPath = join(RAW_DIR, doc.filename);
    const metaPath = join(RAW_DIR, `${doc.filename}.meta.json`);

    if (!force && existsSync(metaPath)) {
      console.log(`[${i + 1}/${documents.length}] Skipping (exists): ${doc.title}`);
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${documents.length}] Fetching: ${doc.title}`);
    console.log(`  URL: ${doc.url}`);

    try {
      const response = await fetchWithRetry(doc.url);
      const buffer = Buffer.from(await response.arrayBuffer());

      writeFileSync(destPath, buffer);
      console.log(`  Downloaded: ${buffer.length.toLocaleString()} bytes → ${destPath}`);

      let text = "";
      if (doc.url.toLowerCase().endsWith(".pdf")) {
        text = await extractPdfText(buffer);
        console.log(`  Extracted text: ${text.length.toLocaleString()} chars`);
      } else {
        // HTML page — store raw HTML for downstream processing
        text = buffer.toString("utf8").slice(0, 50_000);
        console.log(`  Stored HTML: ${text.length.toLocaleString()} chars`);
      }

      const meta: FetchedDocument = {
        title: doc.title,
        url: doc.url,
        category: doc.category,
        filename: doc.filename,
        text,
        fetchedAt: new Date().toISOString(),
      };

      writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
      fetched.push(meta);
    } catch (err) {
      console.error(
        `  ERROR fetching ${doc.url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Rate limit between requests
    if (i < documents.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  const summary = {
    fetchedAt: new Date().toISOString(),
    total: documents.length,
    fetched: fetched.length,
    skipped,
    errors: documents.length - fetched.length - skipped,
    documents: fetched.map((d) => ({
      title: d.title,
      filename: d.filename,
      category: d.category,
      textLength: d.text.length,
    })),
  };

  writeFileSync(join(RAW_DIR, "fetch-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nFetch complete: ${fetched.length} fetched, ${skipped} skipped, ${summary.errors} errors`);
  console.log(`Summary written to ${join(RAW_DIR, "fetch-summary.json")}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
