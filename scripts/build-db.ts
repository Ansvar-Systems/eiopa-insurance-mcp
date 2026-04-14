/**
 * Build the EIOPA SQLite database from fetched raw data.
 *
 * Reads .meta.json files from data/raw/, parses the extracted text,
 * and inserts categories, guidelines, and technical standards into the database.
 *
 * Usage:
 *   npx tsx scripts/build-db.ts
 *   npx tsx scripts/build-db.ts --force   # drop and rebuild database
 *   npx tsx scripts/build-db.ts --dry-run # log what would be inserted
 */

import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DB_PATH = process.env["EIOPA_DB_PATH"] ?? "data/eiopa.db";
const RAW_DIR = "data/raw";

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FetchedDocument {
  title: string;
  url: string;
  category: string;
  filename: string;
  text: string;
  fetchedAt: string;
}

interface CategoryRow {
  id: string;
  name: string;
  version: string | null;
  domain: string;
  description: string;
  item_count: number;
  effective_date: string | null;
  pdf_url: string;
}

interface GuidelineRow {
  category_id: string;
  control_ref: string;
  domain: string;
  subdomain: string;
  title: string;
  description: string;
  maturity_level: string;
  priority: string;
}

interface TechnicalStandardRow {
  reference: string;
  title: string;
  date: string | null;
  category: string;
  summary: string;
  full_text: string;
  pdf_url: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Document classification
// ---------------------------------------------------------------------------

function classifyDocument(doc: FetchedDocument): "guideline" | "technical_standard" | "unknown" {
  const titleLower = doc.title.toLowerCase();
  if (
    titleLower.includes("its") ||
    titleLower.includes("rts") ||
    titleLower.includes("implementing technical") ||
    titleLower.includes("regulatory technical") ||
    titleLower.includes("delegated regulation") ||
    titleLower.includes("implementing regulation")
  ) {
    return "technical_standard";
  }
  if (
    titleLower.includes("guideline") ||
    titleLower.includes("opinion") ||
    titleLower.includes("recommendation")
  ) {
    return "guideline";
  }
  // Default: treat longer documents as guidelines, shorter as technical standards
  return doc.text.length > 50_000 ? "guideline" : "technical_standard";
}

function inferCategoryId(doc: FetchedDocument): string {
  const titleLower = doc.title.toLowerCase();
  const catLower = doc.category.toLowerCase();
  if (catLower.includes("dora") || catLower.includes("iorp") || titleLower.includes("dora") || titleLower.includes("iorp")) {
    return "dora-iorp";
  }
  if (catLower.includes("technical") || titleLower.includes("its") || titleLower.includes("rts") || titleLower.includes("delegated regulation")) {
    return "technical-standards";
  }
  return "solvency-ii-guidelines";
}

function slugFromFilename(doc: FetchedDocument): string {
  return doc.filename
    .replace(/\.pdf$/i, "")
    .replace(/^publications-/, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80)
    .toUpperCase();
}

function inferGuidelineRef(doc: FetchedDocument): string {
  // Combine the EIOPA reference (when present) with the document slug so each
  // ingested document gets a unique control_ref. The EIOPA reference alone
  // often repeats across multiple related documents (ORSA, governance, etc.).
  const slug = slugFromFilename(doc);
  const refMatch = doc.text.match(/EIOPA-BoS-\d{2,4}[\/\-]\d{1,4}/i);
  if (refMatch) {
    return `${refMatch[0]!.toUpperCase().replace(/\//g, "-")}--${slug}`;
  }
  return `EIOPA--${slug}`;
}

function inferTechnicalStandardRef(doc: FetchedDocument): string {
  // Combine the cited EU regulation number with the document slug so each
  // ingested document is uniquely keyed even when the same regulation is
  // referenced across many publications.
  const slug = slugFromFilename(doc);
  const refMatch = doc.text.match(/\(EU\)\s*\d{4}\/\d+/i);
  if (refMatch) {
    const reg = refMatch[0]!.replace(/[^0-9/]/g, "").replace(/^\//, "");
    return `EU-${reg}--${slug}`;
  }
  return `EIOPA-TS--${slug}`;
}

function extractDate(text: string): string | null {
  // Look for dates in common EIOPA document formats
  const patterns = [
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
    /\b(\d{2})\/(\d{2})\/(\d{4})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2] && /[a-z]/i.test(match[2])) {
        const months: Record<string, string> = {
          january: "01", february: "02", march: "03", april: "04",
          may: "05", june: "06", july: "07", august: "08",
          september: "09", october: "10", november: "11", december: "12",
        };
        const month = months[match[2]!.toLowerCase()] ?? "01";
        return `${match[3]}-${month}-${match[1]!.padStart(2, "0")}`;
      }
      return match[0]!;
    }
  }
  return null;
}

function buildSummary(text: string, maxLen = 500): string {
  // Extract first meaningful paragraph as summary
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 50);
  const firstParagraph = lines[0] ?? "";
  return firstParagraph.length > maxLen
    ? firstParagraph.substring(0, maxLen) + "..."
    : firstParagraph;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    console.error(`Raw data directory not found: ${RAW_DIR}`);
    console.error("Run: npm run ingest:fetch");
    process.exit(1);
  }

  // Collect all .meta.json files
  const metaFiles = readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".meta.json"))
    .sort();

  if (metaFiles.length === 0) {
    console.warn("No .meta.json files found. Run: npm run ingest:fetch");
    return;
  }

  console.log(`Found ${metaFiles.length} fetched documents`);

  if (dryRun) {
    for (const f of metaFiles) {
      const doc: FetchedDocument = JSON.parse(readFileSync(join(RAW_DIR, f), "utf8"));
      const type = classifyDocument(doc);
      console.log(`  [${type}] ${doc.title} (${doc.text.length.toLocaleString()} chars)`);
    }
    return;
  }

  // Set up database
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (force && existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
    console.log(`Deleted ${DB_PATH}`);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = DELETE"); // Use DELETE mode for build script (faster for bulk inserts)
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);

  const insertCategory = db.prepare(
    "INSERT OR IGNORE INTO categories (id, name, version, domain, description, item_count, effective_date, pdf_url) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertGuideline = db.prepare(
    "INSERT OR IGNORE INTO guidelines " +
      "(category_id, control_ref, domain, subdomain, title, description, maturity_level, priority) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTechnicalStandard = db.prepare(
    "INSERT OR IGNORE INTO technical_standards (reference, title, date, category, summary, full_text, pdf_url, status) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  let categoriesInserted = 0;
  let guidelinesInserted = 0;
  let technicalStandardsInserted = 0;

  for (const metaFile of metaFiles) {
    const doc: FetchedDocument = JSON.parse(readFileSync(join(RAW_DIR, metaFile), "utf8"));
    const type = classifyDocument(doc);
    console.log(`Processing [${type}]: ${doc.title}`);

    if (type === "guideline") {
      const categoryId = inferCategoryId(doc);

      // Ensure category row exists
      const catResult = insertCategory.run(
        categoryId,
        doc.category || "EIOPA Publications",
        null,
        doc.category || "Solvency II Guidelines",
        buildSummary(doc.text, 500),
        0,
        extractDate(doc.text),
        doc.url,
      );
      if (catResult.changes > 0) categoriesInserted++;

      // For a real implementation, parse the PDF text to extract individual guidelines.
      // EIOPA guideline numbering follows "Guideline N on ..." patterns.
      // Here we insert one entry per document to demonstrate the pipeline.
      const ref = inferGuidelineRef(doc);
      const guidelineResult = insertGuideline.run(
        categoryId,
        ref,
        doc.category || "Solvency II Guidelines",
        "General",
        doc.title,
        doc.text.substring(0, 2000) || "See full document for requirements.",
        "Mandatory",
        "High",
      );
      if (guidelineResult.changes > 0) guidelinesInserted++;
    } else if (type === "technical_standard") {
      const reference = inferTechnicalStandardRef(doc);
      const result = insertTechnicalStandard.run(
        reference,
        doc.title,
        extractDate(doc.text),
        doc.category || "Technical Standards (ITS/RTS)",
        buildSummary(doc.text),
        doc.text || `See full document at: ${doc.url}`,
        doc.url,
        "active",
      );
      if (result.changes > 0) technicalStandardsInserted++;
    }
  }

  // Switch to WAL for production use
  db.pragma("journal_mode = WAL");
  db.pragma("vacuum");

  console.log(`
Build complete:
  Categories          : ${categoriesInserted} inserted
  Guidelines          : ${guidelinesInserted} inserted
  Technical Standards : ${technicalStandardsInserted} inserted

Database: ${DB_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
