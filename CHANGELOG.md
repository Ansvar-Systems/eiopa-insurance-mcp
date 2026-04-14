# Changelog

All notable changes to the EIOPA Insurance Guidelines MCP are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `check_data_freshness` MCP tool returning per-source age and Current/Due/OVERDUE status.
- `_error_type` tagging on every error response (`validation_error`, `not_found`, `unknown_tool`, `internal_error`).
- `db_metadata` table (schema_version, category, mcp_name, database_version, built_at) populated by build and seed scripts.
- Smoke test suite (`tests/smoke.test.ts`) with 10 vitest assertions covering DB shape, FTS5, and freshness reporting.
- Security CI: `semgrep.yml`, `trivy.yml` (filesystem + image), `scorecard.yml`.
- Supplementary repo docs: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CODEOWNERS`, `REGISTRY.md`, `CHANGELOG.md`.

### Changed
- Shipped SQLite database now uses `journal_mode=delete` and is `VACUUM`ed at build time (golden Gate 5).
- Runtime `getDb()` opens the database read-only when it already exists.
- `data/coverage.json` rewritten to the golden non-law schema with `scope_statement`, `scope_exclusions`, per-source `verification_method`, `measurement_unit`, `last_verified`, `expected_items`, plus `gaps[]` and `summary{}`.

### Fixed
- `scripts/check-freshness.ts` `CoverageFile.totals` type relaxed to match the actual writer (was the cbuae shape).
- One banned word in seed-sample paraphrase replaced (`facilitate` -> `enable`).

## [0.1.0] - 2026-04-14

### Added
- Initial MCP server with stdio and Streamable HTTP transports.
- Six core tools: `search_eiopa_guidelines`, `get_eiopa_guideline`, `search_solvency_ii_rts`, `list_eiopa_categories`, `about`, `list_sources`.
- SQLite + FTS5 backed by an ingestion pipeline that scrapes four EIOPA document-library sections.
- Coverage of 185 publications: 105 guideline rows + 80 technical-standard rows across 3 categories.
- Open-source repo files: `LICENSE` (BSL-1.1), `SECURITY.md`, `DISCLAIMER.md`, `PRIVACY.md`, `TOOLS.md`, `COVERAGE.md`, `sources.yml`, `server.json`.
- Dockerfile with non-root user and the ingested DB baked in.
- GitHub Actions: `ci.yml`, `ghcr-build.yml`, `ingest.yml`, `check-freshness.yml`.
