# Coverage — EIOPA Insurance Guidelines MCP

> Last verified: 2026-04-14 | Database version: 0.1.0

## What's Included

| Source | Items | Version | Last Ingested |
|--------|-------|---------|---------------|
| EIOPA Guidelines | 73 | 2026 | 2026-04-14 |
| EIOPA Technical Standards (ITS/RTS) | 32 | 2026 | 2026-04-14 |
| EIOPA Opinions | 54 | 2026 | 2026-04-14 |
| EIOPA Supervisory Statements | 30 | 2026 | 2026-04-14 |

Documents are scraped from four sections of the EIOPA document library:
`/document-library/guidelines_en`, `/document-library/technical-standards_en`,
`/document-library/opinions_en`, `/document-library/supervisory-statements_en`.

**Total:** 6 tools, 185 ingested publications normalised into 105 guideline rows + 80 technical-standard rows in the database.

## What's NOT Included

| Gap | Reason | Planned? |
|-----|--------|----------|
| EIOPA Q&A documents | Informal guidance, not officially numbered | Yes v2 |
| Non-English EIOPA publications | English is authoritative for EU regulatory purposes | No |
| NCA-level implementation guidance | Out of scope — this covers EIOPA-level publications | No |
| CJEU judgments on insurance law | Legal analysis service, not covered here | No |
| EBA/ESMA solo publications | Separate MCPs cover banking and markets regulation | No |
| Draft consultation papers | Only finalised publications included | Yes v2 |

## Coverage by Category

### Solvency II Guidelines
Key guidelines included in the seed database:
- ORSA (EIOPA-BoS-14/253)
- System of Governance (EIOPA-BoS-14/259)
- Internal Controls (EIOPA-BoS-14/168)
- Outsourcing to Cloud Service Providers (EIOPA-BoS-14/170, EIOPA-BoS-20/600)
- Group Solvency (EIOPA-BoS-14/175)
- Valuation of Technical Provisions (EIOPA-BoS-14/166)
- Supervisory Reporting and Public Disclosure (EIOPA-BoS-14/180)
- SCR Standard Formula — Underwriting Risk (EIOPA-BoS-14/179)
- Internal Models Pre-Application (EIOPA-BoS-14/172)
- Diversity and Inclusion in Governance (EIOPA-BoS-23/295)
- Sustainability Risks in Solvency II Pillar 2 (EIOPA-BoS-23/456)

### Technical Standards (ITS/RTS)
- Commission Delegated Regulation (EU) 2015/35 — SCR standard formula, own funds, technical provisions
- ITS on QRT Supervisory Reporting Templates (EU 2015/2450)
- ITS on SFCR Public Disclosure Templates (EU 2015/2452)
- EIOPA XBRL Taxonomy 2023 Update

### DORA & IORP II
- RTS on ICT Risk Management Framework under DORA
- RTS on ICT Third-Party Risk Management under DORA
- IORP II Governance and Risk Assessment Guidelines (EIOPA-BoS-19/856)
- IORP II Prudent Person Principle Guidelines (EIOPA-BoS-19/855)

## Limitations

- EIOPA publications are primarily PDF-based; text extraction quality depends on PDF structure
- Some guideline versions may lag official EIOPA releases by up to one month
- XBRL taxonomy details are not indexed — consult EIOPA website for current taxonomy files
- Commission Delegated Regulations are very long (900+ articles for EU 2015/35); summaries cover key topics

## Data Freshness

| Source | Refresh Schedule | Last Refresh | Next Expected |
|--------|-----------------|-------------|---------------|
| EIOPA Guidelines | Monthly | 2026-04-14 | 2026-05-14 |
| EIOPA Technical Standards | Monthly | 2026-04-14 | 2026-05-14 |
| EIOPA Opinions | Monthly | 2026-04-14 | 2026-05-14 |
| EIOPA Supervisory Statements | Monthly | 2026-04-14 | 2026-05-14 |

To check freshness programmatically, call the `about` tool.
