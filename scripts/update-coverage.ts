/**
 * Update data/coverage.json with current database statistics.
 *
 * Preserves hand-maintained schema fields (schema_version, mcp_type,
 * scope_statement, scope_exclusions, gaps, per-source metadata including
 * per-section item_counts that the DB does not disambiguate, completeness,
 * etc.) and only refreshes the dynamic totals + timestamps. Runs safely on
 * CI without clobbering docs.
 *
 * Note: EIOPA coverage.json splits `sources` into 4 sub-sections
 * (guidelines, technical-standards, opinions, supervisory-statements),
 * but the DB flattens guidelines+opinions+supervisory-statements into a
 * single `guidelines` table. Per-source item_counts are therefore ingest-
 * time counts maintained by the crawler and not recomputed here.
 *
 * Usage:
 *   npx tsx scripts/update-coverage.ts
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["EIOPA_DB_PATH"] ?? "data/eiopa.db";
const COVERAGE_FILE = "data/coverage.json";

interface DbMetaRow {
  key: string;
  value: string;
}

function readBuiltAt(db: Database.Database): string | null {
  try {
    const row = db
      .prepare("SELECT value FROM db_metadata WHERE key = 'built_at' LIMIT 1")
      .get() as DbMetaRow | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    console.error("Run: npm run seed  or  npm run build:db");
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  const categories = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as {
    n: number;
  }).n;
  const guidelines = (db.prepare("SELECT COUNT(*) AS n FROM guidelines").get() as {
    n: number;
  }).n;
  const technical_standards = (db
    .prepare("SELECT COUNT(*) AS n FROM technical_standards")
    .get() as { n: number }).n;

  const builtAt = readBuiltAt(db);

  const existing: Record<string, unknown> = existsSync(COVERAGE_FILE)
    ? JSON.parse(readFileSync(COVERAGE_FILE, "utf8"))
    : {};

  // Preserve the per-source breakdown (crawler-maintained).
  const sources =
    Array.isArray(existing["sources"]) && existing["sources"].length > 0
      ? (existing["sources"] as Record<string, unknown>[])
      : [];

  // total_items is the sum of per-source item_counts (preserves the split).
  const totalItems = sources.reduce((acc, s) => {
    const n = s["item_count"];
    return acc + (typeof n === "number" ? n : 0);
  }, 0);

  const existingSummary =
    (existing["summary"] as Record<string, unknown> | undefined) ?? {};
  const summary = {
    ...existingSummary,
    total_sources: sources.length,
    total_items: totalItems,
  };

  const coverage = {
    ...existing,
    sources,
    gaps: existing["gaps"] ?? [],
    totals: { categories, guidelines, technical_standards },
    summary,
    database_built: builtAt ?? existing["database_built"] ?? null,
    generatedAt: new Date().toISOString(),
  };

  const dir = dirname(COVERAGE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(COVERAGE_FILE, JSON.stringify(coverage, null, 2) + "\n", "utf8");

  console.log(`Coverage updated: ${COVERAGE_FILE}`);
  console.log(`  Categories          : ${categories}`);
  console.log(`  Guidelines (DB)     : ${guidelines}`);
  console.log(`  Technical Standards : ${technical_standards}`);
  console.log(`  total_items (sources): ${totalItems}`);
  console.log(
    `  Schema fields preserved: scope_exclusions, gaps, per-source item_counts`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
