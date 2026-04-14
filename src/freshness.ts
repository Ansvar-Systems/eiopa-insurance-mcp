/**
 * Runtime freshness reporter.
 *
 * Reads data/coverage.json and computes per-source age + status. Used by the
 * `check_data_freshness` MCP tool. Mirrors the build-time
 * scripts/check-freshness.ts logic but returns structured JSON for tool callers
 * instead of writing files.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COVERAGE_FILE = resolve(
  process.env["EIOPA_COVERAGE_PATH"] ?? join(__dirname, "..", "data", "coverage.json"),
);

const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 31,
  quarterly: 92,
  annually: 365,
};

interface CoverageSource {
  name: string;
  url?: string;
  last_fetched: string | null;
  update_frequency: string;
  item_count: number;
  status?: string;
}

interface CoverageFile {
  generatedAt?: string;
  mcp?: string;
  version?: string;
  database_built?: string | null;
  sources: CoverageSource[];
  totals?: Record<string, number>;
}

export interface FreshnessSourceReport {
  name: string;
  url: string | null;
  last_fetched: string | null;
  update_frequency: string;
  max_age_days: number;
  age_days: number | null;
  status: "Current" | "Due" | "OVERDUE" | "Never fetched";
  reason: string;
}

export interface FreshnessReport {
  checked_at: string;
  coverage_generated_at: string | null;
  database_built: string | null;
  any_stale: boolean;
  sources: FreshnessSourceReport[];
  refresh_command: string;
  coverage_path: string;
}

export function buildFreshnessReport(): FreshnessReport {
  if (!existsSync(COVERAGE_FILE)) {
    return {
      checked_at: new Date().toISOString(),
      coverage_generated_at: null,
      database_built: null,
      any_stale: true,
      sources: [],
      refresh_command:
        "gh workflow run ingest.yml --repo Ansvar-Systems/eiopa-insurance-mcp -f force=true",
      coverage_path: COVERAGE_FILE,
    };
  }

  const coverage = JSON.parse(readFileSync(COVERAGE_FILE, "utf8")) as CoverageFile;
  const now = Date.now();
  const reports: FreshnessSourceReport[] = [];
  let anyStale = false;

  for (const source of coverage.sources ?? []) {
    const freq = source.update_frequency?.toLowerCase() ?? "monthly";
    const maxAgeDays = FREQUENCY_DAYS[freq] ?? 92;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    let ageDays: number | null = null;
    let status: FreshnessSourceReport["status"] = "Current";
    let reason = "within expected refresh window";

    if (!source.last_fetched) {
      status = "Never fetched";
      reason = "last_fetched is null";
      anyStale = true;
    } else {
      const fetchedMs = new Date(source.last_fetched).getTime();
      if (Number.isNaN(fetchedMs)) {
        status = "OVERDUE";
        reason = `invalid last_fetched timestamp: ${source.last_fetched}`;
        anyStale = true;
      } else {
        ageDays = Math.floor((now - fetchedMs) / (24 * 60 * 60 * 1000));
        const remainingMs = maxAgeMs - (now - fetchedMs);
        if (remainingMs < 0) {
          status = "OVERDUE";
          reason = `last fetched ${ageDays}d ago (max ${maxAgeDays}d for ${freq})`;
          anyStale = true;
        } else if (remainingMs < maxAgeMs * 0.2) {
          status = "Due";
          reason = `due within ${Math.ceil(remainingMs / (24 * 60 * 60 * 1000))}d`;
        }
      }
    }

    reports.push({
      name: source.name,
      url: source.url ?? null,
      last_fetched: source.last_fetched,
      update_frequency: freq,
      max_age_days: maxAgeDays,
      age_days: ageDays,
      status,
      reason,
    });
  }

  return {
    checked_at: new Date().toISOString(),
    coverage_generated_at: coverage.generatedAt ?? null,
    database_built: coverage.database_built ?? null,
    any_stale: anyStale,
    sources: reports,
    refresh_command:
      "gh workflow run ingest.yml --repo Ansvar-Systems/eiopa-insurance-mcp -f force=true",
    coverage_path: COVERAGE_FILE,
  };
}
