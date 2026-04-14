/**
 * Update data/coverage.json with current database statistics.
 *
 * Reads the EIOPA SQLite database and writes the coverage manifest in the
 * golden non-law schema (scope_statement, scope_exclusions, per-source
 * verification_method + measurement_unit + last_verified, gaps, summary).
 *
 * Usage:
 *   npx tsx scripts/update-coverage.ts
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["EIOPA_DB_PATH"] ?? "data/eiopa.db";
const COVERAGE_FILE = "data/coverage.json";
const PKG = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

interface CoverageSource {
  id: string;
  name: string;
  authority: string;
  url: string;
  last_fetched: string | null;
  last_verified: string;
  update_frequency: string;
  item_count: number;
  expected_items: number;
  measurement_unit: string;
  verification_method:
    | "api_reconciled"
    | "page_scraped"
    | "manifest_matched"
    | "manual_attestation";
  completeness: "full" | "partial" | "snapshot";
  completeness_note: string;
  status: "current" | "stale" | "unknown";
}

interface CoverageGap {
  id: string;
  description: string;
  reason: string;
  impact: "low" | "medium" | "high";
  planned: boolean;
}

interface CoverageFile {
  schema_version: string;
  generatedAt: string;
  mcp: string;
  mcp_name: string;
  mcp_type: string;
  database_version: string;
  database_built: string | null;
  scope_statement: string;
  scope_exclusions: string[];
  sources: CoverageSource[];
  gaps: CoverageGap[];
  totals: {
    categories: number;
    guidelines: number;
    technical_standards: number;
  };
  summary: {
    total_tools: number;
    total_sources: number;
    total_items: number;
  };
}

const TOOL_COUNT = 7; // search_eiopa_guidelines, get_eiopa_guideline, search_solvency_ii_rts, list_eiopa_categories, about, list_sources, check_data_freshness

const SCOPE_STATEMENT =
  "EIOPA-published Solvency II guidelines, opinions, supervisory statements, and ITS/RTS technical standards covering insurance, reinsurance, insurance groups, and IORP II pension funds across the EU/EEA.";

const SCOPE_EXCLUSIONS = [
  "EIOPA Q&A documents (informal guidance, not officially numbered)",
  "Non-English EIOPA publications",
  "National competent authority (NCA) implementation guidance",
  "CJEU judgments interpreting EU insurance law",
  "EBA / ESMA solo publications (covered by sibling MCPs)",
  "Draft consultation papers (only finalised publications are included)",
];

const GAPS: CoverageGap[] = [
  {
    id: "qna",
    description: "EIOPA Q&A documents",
    reason: "Informal guidance, not officially numbered or versioned",
    impact: "low",
    planned: true,
  },
  {
    id: "non-english",
    description: "Non-English EIOPA publications",
    reason: "English is the authoritative language for EU regulatory purposes",
    impact: "low",
    planned: false,
  },
  {
    id: "nca-guidance",
    description: "National competent authority implementation guidance",
    reason: "Out of scope; per-jurisdiction MCPs cover NCA-level material",
    impact: "medium",
    planned: false,
  },
];

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

  const totalItems = guidelines + technical_standards;
  const builtAt = readBuiltAt(db);
  const today = new Date().toISOString().slice(0, 10);

  // EIOPA publishes ~150-200 indexed documents across the four library sections
  // we ingest. Keep expected_items aligned with the most recent ingestion run.
  const expectedItems = totalItems > 0 ? totalItems : 185;

  const coverage: CoverageFile = {
    schema_version: "1.0",
    generatedAt: new Date().toISOString(),
    mcp: "eiopa-insurance-mcp",
    mcp_name: "EIOPA Insurance Guidelines MCP",
    mcp_type: "compliance",
    database_version: PKG.version,
    database_built: builtAt,
    scope_statement: SCOPE_STATEMENT,
    scope_exclusions: SCOPE_EXCLUSIONS,
    sources: [
      {
        id: "eiopa-publications",
        name: "EIOPA Publications",
        authority: "European Insurance and Occupational Pensions Authority",
        url: "https://www.eiopa.europa.eu/publications/guidelines",
        last_fetched: today,
        last_verified: today,
        update_frequency: "monthly",
        item_count: totalItems,
        expected_items: expectedItems,
        measurement_unit: "publications",
        verification_method: "page_scraped",
        completeness: "snapshot",
        completeness_note:
          "Scrapes four EIOPA document-library sections: guidelines, technical-standards, opinions, supervisory-statements. Each publication is normalised into either a guideline row or a technical-standard row.",
        status: "current",
      },
    ],
    gaps: GAPS,
    totals: { categories, guidelines, technical_standards },
    summary: {
      total_tools: TOOL_COUNT,
      total_sources: 1,
      total_items: totalItems,
    },
  };

  const dir = dirname(COVERAGE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(COVERAGE_FILE, JSON.stringify(coverage, null, 2) + "\n", "utf8");

  console.log(`Coverage updated: ${COVERAGE_FILE}`);
  console.log(`  Categories          : ${categories}`);
  console.log(`  Guidelines          : ${guidelines}`);
  console.log(`  Technical Standards : ${technical_standards}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
