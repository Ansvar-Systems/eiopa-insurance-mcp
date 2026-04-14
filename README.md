# EIOPA Insurance Guidelines MCP

MCP server for querying European Insurance and Occupational Pensions Authority (EIOPA) guidelines, opinions, and technical standards. Part of the [Ansvar](https://ansvar.eu) regulatory intelligence platform.

## What's Included

- **Solvency II Guidelines** — ~80 EIOPA guidelines covering ORSA, system of governance, technical provisions, SCR standard formula, internal models, group supervision, reporting (SFCR/RSR/QRTs), and disclosure (from 2016 onwards)
- **Technical Standards (ITS/RTS)** — ~40 Implementing and Regulatory Technical Standards including Commission Delegated Regulation (EU) 2015/35, QRT templates, SFCR templates, own funds classification, and SCR parameters
- **DORA & IORP II** — ~25 documents covering DORA ICT risk management for insurers, DORA third-party risk, IORP II governance, investment (prudent person principle), and pension fund supervisory reporting

For full coverage details, see [COVERAGE.md](COVERAGE.md). For tool specifications, see [TOOLS.md](TOOLS.md).

## Installation

### npm (stdio transport)

```bash
npm install @ansvar/eiopa-insurance-mcp
```

### Docker (HTTP transport)

```bash
docker pull ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest
docker run -p 8382:8382 ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest
```

## Usage

### stdio (Claude Desktop, Cursor, etc.)

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

### HTTP (Streamable HTTP)

```bash
docker run -p 8382:8382 ghcr.io/ansvar-systems/eiopa-insurance-mcp:latest
# Server available at http://localhost:8382/mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `search_eiopa_guidelines` | Full-text search across EIOPA guidelines, opinions, and technical standards |
| `get_eiopa_guideline` | Get a specific guideline or technical standard by reference ID (e.g., `EIOPA-BoS-14/253`) |
| `search_solvency_ii_rts` | Search technical standards (ITS/RTS) with optional category/domain filters |
| `list_eiopa_categories` | List all EIOPA publication categories with item counts |
| `about` | Server metadata, version, and coverage summary |
| `list_sources` | Data provenance: sources, retrieval method, licensing |

See [TOOLS.md](TOOLS.md) for parameters, return formats, and examples.

## Data Sources

All data is sourced from official EIOPA public publications:

- [EIOPA Publications — Guidelines](https://www.eiopa.europa.eu/publications/guidelines)
- [EIOPA Document Library](https://www.eiopa.europa.eu/document-library)
- [EU Official Journal — Solvency II Level 2 Measures](https://eur-lex.europa.eu/)

See [sources.yml](sources.yml) for full provenance details.

## Development

```bash
git clone https://github.com/Ansvar-Systems/eiopa-insurance-mcp.git
cd eiopa-insurance-mcp
npm install
npm run seed        # Create sample database
npm run build       # Compile TypeScript
npm test            # Run tests
npm run dev         # Start HTTP dev server with hot reload
```

## Disclaimer

This server provides informational reference data only. It does not constitute legal or regulatory advice. Always verify against official EIOPA publications. See [DISCLAIMER.md](DISCLAIMER.md) for full terms.

## License

[BSL-1.1](LICENSE) — Ansvar Systems AB. Converts to Apache-2.0 on 2030-04-13.
