/**
 * Smoke tests for the EIOPA database layer.
 *
 * These run after the ingested DB is in place (real ingest or seed-sample) and
 * verify that the database is well-formed, FTS5 search returns hits, and the
 * runtime helpers expose the expected shapes. They intentionally avoid asserting
 * on specific document content so that ingestion refreshes do not break them.
 *
 * Contract tests live separately and are NOT part of this smoke suite.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import {
  getStats,
  listFrameworks,
  searchRegulations,
  searchControls,
  getControl,
  getCircular,
} from "../src/db.js";
import { buildFreshnessReport } from "../src/freshness.js";

const DB_PATH = process.env["EIOPA_DB_PATH"] ?? "data/eiopa.db";

describe("EIOPA database smoke", () => {
  it("database file exists", () => {
    expect(existsSync(DB_PATH)).toBe(true);
  });

  it("ships in DELETE journal mode (golden Gate 5)", () => {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      const mode = db.pragma("journal_mode", { simple: true });
      expect(String(mode).toLowerCase()).toBe("delete");
    } finally {
      db.close();
    }
  });

  it("PRAGMA integrity_check returns ok", () => {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      const result = db.pragma("integrity_check", { simple: true });
      expect(result).toBe("ok");
    } finally {
      db.close();
    }
  });

  it("db_metadata table is populated with required keys", () => {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      const rows = db.prepare("SELECT key, value FROM db_metadata").all() as Array<{
        key: string;
        value: string;
      }>;
      const map = new Map(rows.map((r) => [r.key, r.value]));
      expect(map.get("schema_version")).toBeTruthy();
      expect(map.get("category")).toBe("compliance");
      expect(map.get("mcp_name")).toBe("eiopa-insurance-mcp");
    } finally {
      db.close();
    }
  });

  it("contains a non-trivial number of categories + guidelines + technical standards", () => {
    const stats = getStats();
    const total = stats.categories + stats.guidelines + stats.technical_standards;
    expect(stats.categories).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThanOrEqual(30);
  });

  it("listFrameworks returns rows with required fields", () => {
    const rows = listFrameworks();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const first = rows[0]!;
    expect(first.id).toBeTruthy();
    expect(first.name).toBeTruthy();
  });

  it("FTS5 search across guidelines returns hits for a common term", () => {
    const hits = searchRegulations({ query: "governance", limit: 5 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const h of hits) {
      expect(["guideline", "technical_standard"]).toContain(h.type);
      expect(h.title).toBeTruthy();
      expect(h.reference).toBeTruthy();
    }
  });

  it("category-scoped search returns shape-conformant rows", () => {
    const hits = searchControls({ query: "risk", limit: 3 });
    for (const h of hits) {
      expect(h.control_ref).toBeTruthy();
      expect(typeof h.title).toBe("string");
    }
  });

  it("getControl / getCircular return null for unknown references", () => {
    expect(getControl("DOES-NOT-EXIST-XYZ")).toBeNull();
    expect(getCircular("DOES-NOT-EXIST-XYZ")).toBeNull();
  });

  it("buildFreshnessReport returns at least one source and a status", () => {
    const report = buildFreshnessReport();
    expect(report.checked_at).toBeTruthy();
    expect(report.sources.length).toBeGreaterThanOrEqual(1);
    for (const s of report.sources) {
      expect(["Current", "Due", "OVERDUE", "Never fetched"]).toContain(s.status);
      expect(s.update_frequency).toBeTruthy();
    }
  });
});
