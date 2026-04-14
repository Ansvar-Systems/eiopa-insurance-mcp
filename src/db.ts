/**
 * SQLite database access layer for the EIOPA Insurance Guidelines MCP server.
 *
 * Schema:
 *   - categories  — EIOPA guideline categories (Solvency II, Technical Standards, DORA & IORP II)
 *   - guidelines  — Individual EIOPA guidelines and opinions within each category
 *   - technical_standards — EIOPA ITS/RTS documents
 *
 * FTS5 virtual tables back full-text search on guidelines and technical standards.
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["EIOPA_DB_PATH"] ?? "data/eiopa.db";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id              TEXT    PRIMARY KEY,
  name            TEXT    NOT NULL,
  version         TEXT,
  domain          TEXT,
  description     TEXT,
  item_count      INTEGER DEFAULT 0,
  effective_date  TEXT,
  pdf_url         TEXT
);

CREATE INDEX IF NOT EXISTS idx_categories_domain ON categories(domain);

CREATE TABLE IF NOT EXISTS guidelines (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    TEXT    NOT NULL REFERENCES categories(id),
  control_ref    TEXT    NOT NULL UNIQUE,
  domain         TEXT    NOT NULL,
  subdomain      TEXT,
  title          TEXT    NOT NULL,
  description    TEXT    NOT NULL,
  maturity_level TEXT,
  priority       TEXT
);

CREATE INDEX IF NOT EXISTS idx_guidelines_category  ON guidelines(category_id);
CREATE INDEX IF NOT EXISTS idx_guidelines_domain    ON guidelines(domain);
CREATE INDEX IF NOT EXISTS idx_guidelines_maturity  ON guidelines(maturity_level);
CREATE INDEX IF NOT EXISTS idx_guidelines_priority  ON guidelines(priority);

CREATE VIRTUAL TABLE IF NOT EXISTS guidelines_fts USING fts5(
  control_ref, domain, subdomain, title, description,
  content='guidelines',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS guidelines_ai AFTER INSERT ON guidelines BEGIN
  INSERT INTO guidelines_fts(rowid, control_ref, domain, subdomain, title, description)
  VALUES (new.id, new.control_ref, new.domain, COALESCE(new.subdomain, ''), new.title, new.description);
END;

CREATE TRIGGER IF NOT EXISTS guidelines_ad AFTER DELETE ON guidelines BEGIN
  INSERT INTO guidelines_fts(guidelines_fts, rowid, control_ref, domain, subdomain, title, description)
  VALUES ('delete', old.id, old.control_ref, old.domain, COALESCE(old.subdomain, ''), old.title, old.description);
END;

CREATE TRIGGER IF NOT EXISTS guidelines_au AFTER UPDATE ON guidelines BEGIN
  INSERT INTO guidelines_fts(guidelines_fts, rowid, control_ref, domain, subdomain, title, description)
  VALUES ('delete', old.id, old.control_ref, old.domain, COALESCE(old.subdomain, ''), old.title, old.description);
  INSERT INTO guidelines_fts(rowid, control_ref, domain, subdomain, title, description)
  VALUES (new.id, new.control_ref, new.domain, COALESCE(new.subdomain, ''), new.title, new.description);
END;

CREATE TABLE IF NOT EXISTS technical_standards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reference  TEXT    NOT NULL UNIQUE,
  title      TEXT    NOT NULL,
  date       TEXT,
  category   TEXT,
  summary    TEXT,
  full_text  TEXT    NOT NULL,
  pdf_url    TEXT,
  status     TEXT    DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_technical_standards_date     ON technical_standards(date);
CREATE INDEX IF NOT EXISTS idx_technical_standards_category ON technical_standards(category);
CREATE INDEX IF NOT EXISTS idx_technical_standards_status   ON technical_standards(status);

CREATE VIRTUAL TABLE IF NOT EXISTS technical_standards_fts USING fts5(
  reference, title, category, summary, full_text,
  content='technical_standards',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS technical_standards_ai AFTER INSERT ON technical_standards BEGIN
  INSERT INTO technical_standards_fts(rowid, reference, title, category, summary, full_text)
  VALUES (new.id, new.reference, new.title, COALESCE(new.category, ''), COALESCE(new.summary, ''), new.full_text);
END;

CREATE TRIGGER IF NOT EXISTS technical_standards_ad AFTER DELETE ON technical_standards BEGIN
  INSERT INTO technical_standards_fts(technical_standards_fts, rowid, reference, title, category, summary, full_text)
  VALUES ('delete', old.id, old.reference, old.title, COALESCE(old.category, ''), COALESCE(old.summary, ''), old.full_text);
END;

CREATE TRIGGER IF NOT EXISTS technical_standards_au AFTER UPDATE ON technical_standards BEGIN
  INSERT INTO technical_standards_fts(technical_standards_fts, rowid, reference, title, category, summary, full_text)
  VALUES ('delete', old.id, old.reference, old.title, COALESCE(old.category, ''), COALESCE(old.summary, ''), old.full_text);
  INSERT INTO technical_standards_fts(rowid, reference, title, category, summary, full_text)
  VALUES (new.id, new.reference, new.title, COALESCE(new.category, ''), COALESCE(new.summary, ''), new.full_text);
END;
`;

// --- Interfaces ---------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  version: string | null;
  domain: string | null;
  description: string | null;
  item_count: number;
  effective_date: string | null;
  pdf_url: string | null;
}

export interface Guideline {
  id: number;
  category_id: string;
  control_ref: string;
  domain: string;
  subdomain: string | null;
  title: string;
  description: string;
  maturity_level: string | null;
  priority: string | null;
}

export interface TechnicalStandard {
  id: number;
  reference: string;
  title: string;
  date: string | null;
  category: string | null;
  summary: string | null;
  full_text: string;
  pdf_url: string | null;
  status: string;
}

// --- DB singleton -------------------------------------------------------------

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.exec(SCHEMA_SQL);

  return _db;
}

// --- Category queries ---------------------------------------------------------

export function listFrameworks(): Category[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM categories ORDER BY effective_date DESC")
    .all() as Category[];
}

export function getFramework(id: string): Category | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM categories WHERE id = ? LIMIT 1")
      .get(id) as Category | undefined) ?? null
  );
}

// --- Guideline queries --------------------------------------------------------

export interface SearchControlsOptions {
  query: string;
  framework?: string | undefined;
  domain?: string | undefined;
  limit?: number | undefined;
}

export function searchControls(opts: SearchControlsOptions): Guideline[] {
  const db = getDb();
  const limit = opts.limit ?? 10;

  const conditions: string[] = ["guidelines_fts MATCH :query"];
  const params: Record<string, unknown> = { query: opts.query, limit };

  if (opts.framework) {
    conditions.push("c.category_id = :framework");
    params["framework"] = opts.framework;
  }
  if (opts.domain) {
    conditions.push("c.domain = :domain");
    params["domain"] = opts.domain;
  }

  const where = conditions.join(" AND ");
  return db
    .prepare(
      `SELECT c.*, snippet(guidelines_fts, 4, '[', ']', '...', 20) AS _snippet
       FROM guidelines_fts f
       JOIN guidelines c ON c.id = f.rowid
       WHERE ${where}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(params) as Guideline[];
}

export function getControl(controlRef: string): Guideline | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM guidelines WHERE control_ref = ? LIMIT 1")
      .get(controlRef) as Guideline | undefined) ?? null
  );
}

// --- Technical standard queries -----------------------------------------------

export interface SearchCircularsOptions {
  query: string;
  category?: string | undefined;
  limit?: number | undefined;
}

export function searchCirculars(opts: SearchCircularsOptions): TechnicalStandard[] {
  const db = getDb();
  const limit = opts.limit ?? 10;

  const conditions: string[] = ["technical_standards_fts MATCH :query"];
  const params: Record<string, unknown> = { query: opts.query, limit };

  if (opts.category) {
    conditions.push("c.category = :category");
    params["category"] = opts.category;
  }

  const where = conditions.join(" AND ");
  return db
    .prepare(
      `SELECT c.*, snippet(technical_standards_fts, 4, '[', ']', '...', 20) AS _snippet
       FROM technical_standards_fts f
       JOIN technical_standards c ON c.id = f.rowid
       WHERE ${where}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(params) as TechnicalStandard[];
}

export function getCircular(reference: string): TechnicalStandard | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM technical_standards WHERE reference = ? LIMIT 1")
      .get(reference) as TechnicalStandard | undefined) ?? null
  );
}

// --- Combined search ----------------------------------------------------------

export interface SearchRegulationsOptions {
  query: string;
  domain?: string | undefined;
  limit?: number | undefined;
}

export interface RegulationResult {
  type: "guideline" | "technical_standard";
  id: string;
  title: string;
  reference: string;
  domain: string | null;
  summary: string | null;
  rank: number;
}

export function searchRegulations(opts: SearchRegulationsOptions): RegulationResult[] {
  const db = getDb();
  const limit = opts.limit ?? 10;
  const halfLimit = Math.ceil(limit / 2);

  const guidelineParams: Record<string, unknown> = { query: opts.query, limit: halfLimit };
  const tsParams: Record<string, unknown> = { query: opts.query, limit: halfLimit };

  let guidelineWhere = "guidelines_fts MATCH :query";
  if (opts.domain) {
    guidelineWhere += " AND c.domain = :domain";
    guidelineParams["domain"] = opts.domain;
  }

  const guidelines = db
    .prepare(
      `SELECT 'guideline' AS type, c.control_ref AS id, c.title, c.control_ref AS reference,
              c.domain, SUBSTR(c.description, 1, 200) AS summary, rank
       FROM guidelines_fts f
       JOIN guidelines c ON c.id = f.rowid
       WHERE ${guidelineWhere}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(guidelineParams) as RegulationResult[];

  let tsWhere = "technical_standards_fts MATCH :query";
  if (opts.domain) {
    tsWhere += " AND c.category = :domain";
    tsParams["domain"] = opts.domain;
  }

  const technicalStandards = db
    .prepare(
      `SELECT 'technical_standard' AS type, CAST(c.id AS TEXT) AS id, c.title, c.reference,
              c.category AS domain, c.summary, rank
       FROM technical_standards_fts f
       JOIN technical_standards c ON c.id = f.rowid
       WHERE ${tsWhere}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(tsParams) as RegulationResult[];

  // Merge, sort by rank (lower is better in FTS5 BM25), deduplicate
  const merged = [...guidelines, ...technicalStandards];
  merged.sort((a, b) => a.rank - b.rank);
  return merged.slice(0, limit);
}

// --- Stats --------------------------------------------------------------------

export interface DbStats {
  categories: number;
  guidelines: number;
  technical_standards: number;
}

export function getStats(): DbStats {
  const db = getDb();
  const categories = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
  const guidelines = (db.prepare("SELECT COUNT(*) AS n FROM guidelines").get() as { n: number }).n;
  const technical_standards = (db.prepare("SELECT COUNT(*) AS n FROM technical_standards").get() as { n: number }).n;
  return { categories, guidelines, technical_standards };
}
