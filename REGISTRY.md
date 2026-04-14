# Registry Listing — EIOPA Insurance Guidelines MCP

Copy-ready descriptions for npm, the MCP Registry, Smithery, Glama, and other
catalogues. Keep these aligned with `package.json`, `server.json`, and the
README.

## Identifiers

| Field | Value |
|-------|-------|
| Package name (npm) | `@ansvar/eiopa-insurance-mcp` |
| MCP name (`server.json`) | `eu.ansvar/eiopa-insurance-mcp` |
| Container image | `ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest` |
| Repository | https://github.com/Ansvar-Systems/eiopa-insurance-mcp |
| Homepage | https://ansvar.eu |
| License | BSL-1.1 (converts to Apache-2.0 on 2030-04-13) |
| Category | compliance |

## Short description (one line, <=160 chars)

EIOPA guidelines, opinions, supervisory statements, and ITS/RTS technical standards for Solvency II, DORA insurance, and IORP II pensions.

## Medium description (paragraph, ~400 chars)

MCP server for querying European Insurance and Occupational Pensions Authority
(EIOPA) publications. Covers ~185 documents across Solvency II guidelines, ITS
and RTS technical standards, opinions, and supervisory statements, including
DORA ICT risk guidance for insurers and IORP II requirements for pension funds.
Part of the Ansvar regulatory intelligence platform.

## Long description (registry-ready)

The EIOPA Insurance Guidelines MCP gives AI assistants and agentic compliance
workflows direct access to the European Insurance and Occupational Pensions
Authority's publication library. Six domain tools and three meta-tools cover:

- Solvency II Guidelines (governance, risk management, ORSA, internal models,
  group supervision, supervisory reporting, public disclosure)
- Implementing and Regulatory Technical Standards (ITS/RTS) including
  Commission Delegated Regulation (EU) 2015/35
- DORA ICT risk management guidance for insurers and reinsurers
- IORP II governance, prudent person principle, and supervisory reporting

The server ships an embedded SQLite database (FTS5-indexed) refreshed monthly
from the EIOPA document library. Every tool response includes a `_meta` block
with disclaimer, source URL, and data age. Retrieval tools include a
`_citation` block. Errors carry an `_error_type` discriminator.

Available over both stdio (Claude Desktop, Cursor, Continue) and Streamable
HTTP (Docker, Kubernetes, gateway-routed deployments).

## Tags / keywords

`mcp`, `model-context-protocol`, `eiopa`, `insurance`, `solvency-ii`, `dora`,
`iorp`, `pensions`, `eu`, `compliance`, `regulatory`, `ansvar`

## Tools (9 total)

| Tool | Category |
|------|----------|
| `search_eiopa_guidelines` | search |
| `get_eiopa_guideline` | lookup |
| `search_solvency_ii_rts` | search |
| `list_eiopa_categories` | meta |
| `about` | meta |
| `list_sources` | meta |
| `check_data_freshness` | meta |

## Compatible MCP clients

- Claude Desktop (stdio)
- Cursor (stdio)
- Continue (stdio)
- VS Code GitHub Copilot Chat (stdio via mcp.json)
- Any Streamable HTTP MCP client (Docker `ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest` on port 8382)
- Ansvar MCP Gateway (https://gateway.ansvar.eu)

## Data source

European Insurance and Occupational Pensions Authority — official publications
at https://www.eiopa.europa.eu/publications/guidelines and the EIOPA document
library. Refreshed monthly. See `sources.yml` and `COVERAGE.md` for full
provenance, gaps, and limitations.
