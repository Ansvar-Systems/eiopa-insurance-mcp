# EIOPA Insurance Guidelines MCP

> Structured access to European Insurance and Occupational Pensions Authority (EIOPA) guidelines, opinions, and technical standards covering Solvency II, DORA for insurance, and IORP II.

[![npm](https://img.shields.io/npm/v/@ansvar/eiopa-insurance-mcp)](https://www.npmjs.com/package/@ansvar/eiopa-insurance-mcp)
[![License](https://img.shields.io/badge/license-BSL--1.1-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/eiopa-insurance-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/eiopa-insurance-mcp/actions/workflows/ci.yml)

Part of the [Ansvar](https://ansvar.eu) regulatory intelligence platform.

## Quick Start

### Remote (Hetzner)

Use the hosted endpoint — no installation needed:

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "eiopa-insurance": {
      "url": "https://mcp.ansvar.eu/eu/eiopa-insurance/mcp"
    }
  }
}
```

**Cursor / VS Code** (`.cursor/mcp.json` or `.vscode/mcp.json`):
```json
{
  "servers": {
    "eiopa-insurance": {
      "url": "https://mcp.ansvar.eu/eu/eiopa-insurance/mcp"
    }
  }
}
```

For authenticated multi-MCP access across the Ansvar fleet, use the gateway at `https://gateway.ansvar.eu`.

### Local (npm)

Run entirely on your machine:

```bash
npx @ansvar/eiopa-insurance-mcp
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "eiopa-insurance": {
      "command": "npx",
      "args": ["-y", "@ansvar/eiopa-insurance-mcp"]
    }
  }
}
```

### Docker

```bash
docker pull ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest
docker run -p 8382:8382 ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest
# MCP endpoint: http://localhost:8382/mcp
# Health:       http://localhost:8382/health
```

The Docker image uses Streamable HTTP transport on port 8382 at `/mcp`.

## What's Included

| Source | Items | Version | Completeness |
|--------|-------|---------|--------------|
| EIOPA Guidelines | 105 | Consolidated 2016-2024 | Full (database rows) |
| EIOPA Technical Standards (ITS/RTS) | 80 | Solvency II Delegated Regulation EU 2015/35 | Full (database rows) |
| EIOPA Publication Categories | 3 | 2026 snapshot | Full |

**Total: 185 publications normalised into 105 guideline rows + 80 technical-standard rows across 3 categories.**

**Publication categories ingested:**

| Category ID | Name | Scope |
|-------------|------|-------|
| `solvency-ii-guidelines` | Solvency II Guidelines | ORSA, governance, technical provisions, SCR standard formula, internal models, group supervision, reporting, disclosure |
| `technical-standards` | Technical Standards (ITS/RTS) | Commission Delegated Regulation (EU) 2015/35, QRT templates, SFCR templates, own funds, SCR parameters |
| `dora-iorp` | DORA & IORP II | DORA ICT risk, DORA third-party risk, IORP II governance, prudent-person principle, pension-fund supervisory reporting |

**Representative guidelines indexed:**

- ORSA (`EIOPA-BoS-14/253`)
- System of Governance (`EIOPA-BoS-14/253`)
- Internal Controls (`EIOPA-BoS-14/168`)
- Outsourcing to Cloud Service Providers (`EIOPA-BoS-14/170`, `EIOPA-BoS-20/600`)
- Group Solvency (`EIOPA-BoS-14/175`)
- Valuation of Technical Provisions (`EIOPA-BoS-14/166`)
- Supervisory Reporting and Public Disclosure (`EIOPA-BoS-14/180`)
- SCR Standard Formula — Underwriting Risk (`EIOPA-BoS-14/179`)
- Internal Models Pre-Application (`EIOPA-BoS-14/172`)
- Diversity and Inclusion in Governance (`EIOPA-BoS-23/295`)
- Sustainability Risks in Solvency II Pillar 2 (`EIOPA-BoS-23/456`)

## What's NOT Included

- EIOPA Q&A documents — informal guidance, not officially numbered or versioned
- Non-English EIOPA publications — English is the authoritative language for EU regulatory purposes
- National competent authority (NCA) implementation guidance — per-jurisdiction MCPs cover NCA material
- CJEU judgments interpreting EU insurance law — legal analysis is out of scope
- EBA / ESMA solo publications — covered by sibling MCPs (`eba-banking`, `esma-securities`)
- Draft consultation papers — only finalised publications are indexed
- XBRL taxonomy file contents — consult the EIOPA website for current taxonomy files directly

See [COVERAGE.md](COVERAGE.md) for the full per-source breakdown.

## Installation

### npm (stdio transport)

```bash
npm install @ansvar/eiopa-insurance-mcp
```

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "eiopa-insurance": {
      "command": "npx",
      "args": ["-y", "@ansvar/eiopa-insurance-mcp"]
    }
  }
}
```

### Docker (HTTP transport)

```bash
docker pull ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest
docker run -p 8382:8382 ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest
```

### Hosted

- Public MCP: `https://mcp.ansvar.eu/eu/eiopa-insurance/mcp`
- Gateway (OAuth, multi-MCP): `https://gateway.ansvar.eu`

## Tools

7 tools are available. See [TOOLS.md](TOOLS.md) for full parameter documentation.

| Tool | Description |
|------|-------------|
| `search_eiopa_guidelines` | Full-text search across EIOPA guidelines, opinions, and technical standards |
| `get_eiopa_guideline` | Get a specific guideline or technical standard by reference (e.g., `EIOPA-BoS-14/253`) |
| `search_solvency_ii_rts` | Search technical standards (ITS/RTS) with optional category/domain filters |
| `list_eiopa_categories` | List all EIOPA publication categories with item counts and effective dates |
| `about` | Server metadata, version, and coverage summary |
| `list_sources` | Data provenance: sources, retrieval method, update frequency, licensing |
| `check_data_freshness` | Per-source `last_fetched` date, age in days, and Current / Due / OVERDUE status |

Every successful response includes a `_meta` object with `disclaimer`, `data_age`, and `source_url`. Retrieval tools also include a `_citation` object with `canonical_ref` and `display_text`. Error responses include `_error_type` (`validation_error` | `not_found` | `unknown_tool` | `internal_error`).

## Example Queries

```
# Search for ORSA guidance
search_eiopa_guidelines(query="own risk solvency assessment", limit=5)

# Fetch a specific Solvency II governance guideline
get_eiopa_guideline(document_id="EIOPA-BoS-14/253")

# Search technical standards filtered to the ITS/RTS category
search_solvency_ii_rts(query="SCR standard formula own funds", framework="technical-standards", limit=10)

# Find DORA-related ICT risk guidance
search_eiopa_guidelines(query="ICT third-party risk management", domain="DORA & IORP II")

# Enumerate all publication categories
list_eiopa_categories()
```

## Development

```bash
git clone https://github.com/Ansvar-Systems/eiopa-insurance-mcp.git
cd eiopa-insurance-mcp
npm install
npm run build        # Compile TypeScript
npm run seed         # Create sample database for development
npm test             # Run Vitest smoke + contract tests
npm run dev          # Start HTTP dev server on port 8382 with hot reload
```

### Full ingestion (requires live EIOPA portal access)

```bash
npm run ingest:full   # fetch -> build:db -> coverage:update
```

Subcommands: `npm run ingest:fetch`, `npm run ingest:diff`, `npm run build:db`, `npm run coverage:update`, `npm run freshness:check`.

Branching: `feature/* -> dev -> main`. Direct pushes to `main` are blocked by branch protection.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

## Authority

**European Insurance and Occupational Pensions Authority (EIOPA)**
European Union
https://www.eiopa.europa.eu

EIOPA is the independent EU authority for insurance and occupational pensions supervision. Its guidelines, opinions, and technical standards bind national competent authorities and supervised undertakings across the EU/EEA under Solvency II, the DORA regulation for insurers, and the IORP II directive.

## License

BSL-1.1. See [LICENSE](LICENSE). Converts to Apache-2.0 on 2030-04-13.

## Disclaimer

This server provides informational reference data only. It does not constitute legal, regulatory, or professional advice. EIOPA publications are primarily PDF-based and some guideline versions may lag official EIOPA releases by up to one month. Always verify against the authoritative source at https://www.eiopa.europa.eu/publications/guidelines and engage qualified compliance professionals for regulatory decisions. See [DISCLAIMER.md](DISCLAIMER.md) for full terms.
