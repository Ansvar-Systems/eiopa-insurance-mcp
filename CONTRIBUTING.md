# Contributing

Thanks for your interest in the EIOPA Insurance Guidelines MCP. This is part of
the [Ansvar](https://ansvar.eu) regulatory intelligence platform.

## Reporting bugs and requesting features

Open a GitHub issue with a minimal reproduction or a clear description of the
expected behaviour. Tag bugs with `bug` and feature requests with `enhancement`.

For security issues, see [SECURITY.md](SECURITY.md) — do not open a public issue.

## Development setup

```bash
git clone https://github.com/Ansvar-Systems/eiopa-insurance-mcp.git
cd eiopa-insurance-mcp
npm install
npm run seed        # create a sample DB so tests have something to query
npm run build       # tsc must exit 0
npm test            # vitest run, smoke tests must pass
```

To run a fresh ingestion against the live EIOPA document library:

```bash
npm run ingest:full   # fetch -> build:db -> coverage:update
```

This downloads PDFs to `data/raw/` and rebuilds `data/eiopa.db`. Be considerate
of the upstream site — the fetcher rate-limits itself but heavy reruns are
discouraged.

## Pull request rules

1. Branch off `main`. Open a PR back to `main`.
2. Run all gates locally: `npm run build && npm test`.
3. Keep commits focused. One logical change per commit.
4. Update `CHANGELOG.md` under `## [Unreleased]`.
5. If you add or rename a tool, update `TOOLS.md`, the `TOOLS` array in
   `src/index.ts` and `src/http-server.ts`, and bump `summary.total_tools` in
   `scripts/update-coverage.ts`.
6. If you change the database schema, bump `schema_version` in
   `db_metadata` (set in `scripts/build-db.ts` and `scripts/seed-sample.ts`).
7. Follow the project's [Anti-Slop Standard](https://github.com/Ansvar-Systems/Ansvar-Architecture-Documentation/blob/main/docs/adr/ADR-009-anti-slop-standard.md):
   no banned words, no filler preambles, no emojis in technical text.

## Code style

- TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`).
- Parameterised SQL only — never string-concatenate user input into queries.
- Errors must include `_error_type` so callers can branch correctly.
- Tool responses must include `_meta` (disclaimer + data_age + source_url) and,
  for retrieval tools, `_citation` (canonical_ref + display_text).

## Test policy

- The repo ships a smoke suite (`tests/smoke.test.ts`) that asserts on database
  shape and helper invariants. It must stay passing through ingestion refreshes.
- Contract tests are tracked separately (under `vitest.contract.config.ts` once
  authored) and must not be folded into the smoke suite.

## License

By contributing you agree your code is licensed under the project's
[BSL-1.1 license](LICENSE), which converts to Apache-2.0 on 2030-04-13.
