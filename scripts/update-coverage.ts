/**
 * Update data/coverage.json with current database statistics.
 *
 * Reads the EIOPA SQLite database and writes a coverage summary file
 * used by the freshness checker, fleet manifest, and the about tool.
 *
 * Usage:
 *   npx tsx scripts/update-coverage.ts
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["EIOPA_DB_PATH"] ?? "data/eiopa.db";
const COVERAGE_FILE = "data/coverage.json";

interface CoverageFile {
  generatedAt: string;
  mcp: string;
  version: string;
  sources: CoverageSource[];
  totals: {
    categories: number;
    guidelines: number;
    technical_standards: number;
  };
}

interface CoverageSource {
  name: string;
  url: string;
  last_fetched: string | null;
  update_frequency: string;
  item_count: number;
  status: "current" | "stale" | "unknown";
}

async function main(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    console.error("Run: npm run seed  or  npm run build:db");
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  const categories = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
  const guidelines = (db.prepare("SELECT COUNT(*) AS n FROM guidelines").get() as { n: number }).n;
  const technical_standards = (db.prepare("SELECT COUNT(*) AS n FROM technical_standards").get() as { n: number }).n;

  // Get last-inserted date if available
  const latestTS = db
    .prepare("SELECT date FROM technical_standards ORDER BY date DESC LIMIT 1")
    .get() as { date: string } | undefined;

  const coverage: CoverageFile = {
    generatedAt: new Date().toISOString(),
    mcp: "eiopa-insurance-mcp",
    version: "0.1.0",
    sources: [
      {
        name: "EIOPA Publications",
        url: "https://www.eiopa.europa.eu/publications/guidelines",
        last_fetched: latestTS?.date ?? null,
        update_frequency: "monthly",
        item_count: categories + guidelines + technical_standards,
        status: "current",
      },
    ],
    totals: { categories, guidelines, technical_standards },
  };

  const dir = dirname(COVERAGE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(COVERAGE_FILE, JSON.stringify(coverage, null, 2), "utf8");

  console.log(`Coverage updated: ${COVERAGE_FILE}`);
  console.log(`  Categories          : ${categories}`);
  console.log(`  Guidelines          : ${guidelines}`);
  console.log(`  Technical Standards : ${technical_standards}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
