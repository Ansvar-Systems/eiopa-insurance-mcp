# Tools — EIOPA Insurance Guidelines MCP

Seven tools across three categories: search (2), lookup (1), meta (4).

Every successful response includes a `_meta` object with `disclaimer`,
`data_age`, and `source_url`. Retrieval tools also include a `_citation` object
with `canonical_ref` and `display_text` for inline citation linking.

Every error response is a JSON object with `error`, `_error_type`
(`validation_error` | `not_found` | `unknown_tool` | `internal_error`), and
`_meta`.

---

## search_eiopa_guidelines

Full-text search across EIOPA guidelines, opinions, and technical standards.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., "ORSA", "internal model", "outsourcing", "ICT risk") |
| `domain` | string | No | Filter by domain or category (e.g., "Solvency II Guidelines", "Technical Standards (ITS/RTS)", "DORA & IORP II") |
| `limit` | number | No | Max results (default 10, max 50) |

### Example Call

```json
{
  "name": "search_eiopa_guidelines",
  "arguments": {
    "query": "ORSA own risk solvency assessment",
    "limit": 5
  }
}
```

### Example Response

```json
{
  "results": [
    {
      "type": "guideline",
      "id": "EIOPA-BoS-14/253",
      "title": "Guidelines on Own Risk and Solvency Assessment (ORSA)",
      "reference": "EIOPA-BoS-14/253",
      "domain": "Solvency II Guidelines",
      "summary": "EIOPA Guidelines on the Own Risk and Solvency Assessment (ORSA) under Solvency II...",
      "rank": -1.23
    }
  ],
  "count": 1,
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.eiopa.europa.eu/publications/guidelines"
  }
}
```

---

## get_eiopa_guideline

Get a specific EIOPA guideline or technical standard by reference identifier.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `document_id` | string | Yes | EIOPA reference (e.g., "EIOPA-BoS-14/253") or ITS/RTS reference (e.g., "EU-2015/35-SCR") |

### Example Call

```json
{
  "name": "get_eiopa_guideline",
  "arguments": {
    "document_id": "EIOPA-BoS-14/253"
  }
}
```

### Example Response

```json
{
  "id": 1,
  "category_id": "solvency-ii-guidelines",
  "control_ref": "EIOPA-BoS-14/253",
  "domain": "Solvency II Guidelines",
  "subdomain": "Governance",
  "title": "Guidelines on Own Risk and Solvency Assessment (ORSA)",
  "description": "EIOPA Guidelines on the Own Risk and Solvency Assessment...",
  "maturity_level": "Mandatory",
  "priority": "High",
  "_citation": {
    "canonical_ref": "EIOPA-BoS-14/253",
    "display_text": "EIOPA — Guidelines on Own Risk and Solvency Assessment (ORSA) (EIOPA-BoS-14/253)"
  },
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.eiopa.europa.eu/publications/guidelines"
  }
}
```

Returns an error if the reference is not found, with a suggestion to use `search_eiopa_guidelines`.

---

## search_solvency_ii_rts

Search EIOPA technical standards (ITS/RTS) with optional category and domain filters.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., "SCR calculation", "own funds", "ICT third-party risk") |
| `framework` | string | No | Filter by category: `solvency-ii-guidelines`, `technical-standards`, or `dora-iorp` |
| `domain` | string | No | Filter by domain |
| `limit` | number | No | Max results (default 10, max 50) |

### Example Call

```json
{
  "name": "search_solvency_ii_rts",
  "arguments": {
    "query": "SCR standard formula own funds",
    "framework": "technical-standards",
    "limit": 5
  }
}
```

### Example Response

```json
{
  "results": [
    {
      "id": 1,
      "category_id": "technical-standards",
      "control_ref": "EU-2015/35-SCR",
      "title": "RTS on SCR Standard Formula — Commission Delegated Regulation (EU) 2015/35",
      "domain": "Technical Standards (ITS/RTS)",
      "subdomain": "SCR Standard Formula",
      "summary": "Commission Delegated Regulation (EU) 2015/35 supplementing Solvency II...",
      "maturity_level": "Mandatory"
    }
  ],
  "count": 1,
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.eiopa.europa.eu/publications/guidelines"
  }
}
```

---

## list_eiopa_categories

List all EIOPA publication categories covered by this server.

### Parameters

None.

### Example Call

```json
{
  "name": "list_eiopa_categories",
  "arguments": {}
}
```

### Example Response

```json
{
  "categories": [
    {
      "id": "solvency-ii-guidelines",
      "name": "Solvency II Guidelines",
      "version": "Consolidated (2016-2024)",
      "domain": "Solvency II",
      "item_count": 80,
      "effective_date": "2016-01-01"
    },
    {
      "id": "technical-standards",
      "name": "Technical Standards (ITS/RTS)",
      "version": "Solvency II Delegated Regulation EU 2015/35",
      "domain": "Technical Standards (ITS/RTS)",
      "item_count": 40,
      "effective_date": "2016-01-01"
    },
    {
      "id": "dora-iorp",
      "name": "DORA & IORP II",
      "version": "DORA (2025), IORP II (2019)",
      "domain": "DORA & IORP II",
      "item_count": 25,
      "effective_date": "2019-01-13"
    }
  ],
  "count": 3,
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.eiopa.europa.eu/publications/guidelines"
  }
}
```

---

## about

Return metadata about this MCP server: version, data sources, coverage summary, and available tools.

### Parameters

None.

### Example Call

```json
{
  "name": "about",
  "arguments": {}
}
```

### Example Response

```json
{
  "name": "eiopa-insurance-mcp",
  "version": "0.1.0",
  "description": "European Insurance and Occupational Pensions Authority (EIOPA) MCP server...",
  "data_source": "European Insurance and Occupational Pensions Authority (EIOPA)",
  "source_url": "https://www.eiopa.europa.eu/publications/guidelines",
  "coverage": {
    "categories": "3 EIOPA publication categories",
    "guidelines": "19 guidelines and opinions",
    "technical_standards": "5 ITS/RTS documents",
    "jurisdictions": ["EU"],
    "sectors": ["Insurance", "Reinsurance", "Pensions", "Insurance Groups"]
  },
  "tools": [
    { "name": "search_eiopa_guidelines", "description": "..." },
    { "name": "get_eiopa_guideline", "description": "..." },
    { "name": "search_solvency_ii_rts", "description": "..." },
    { "name": "list_eiopa_categories", "description": "..." },
    { "name": "about", "description": "..." },
    { "name": "list_sources", "description": "..." }
  ],
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.eiopa.europa.eu/publications/guidelines"
  }
}
```

---

## list_sources

Return data provenance information: which EIOPA sources are indexed, retrieval method, update frequency, and licensing terms.

### Parameters

None.

### Example Call

```json
{
  "name": "list_sources",
  "arguments": {}
}
```

### Example Response

```json
{
  "sources_yml": "schema_version: \"1.0\"\nmcp_name: \"EIOPA Insurance Guidelines MCP\"\n...",
  "note": "Data is sourced from official EIOPA public publications. See sources.yml for full provenance.",
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.eiopa.europa.eu/publications/guidelines"
  }
}
```

---

## check_data_freshness

Per-source freshness report. Reads `data/coverage.json` at runtime and returns
each source's `last_fetched` date, refresh frequency, age in days, and a
Current / Due / OVERDUE / Never fetched status. Use this before relying on
time-sensitive regulatory text.

### Parameters

None.

### Example Call

```json
{
  "name": "check_data_freshness",
  "arguments": {}
}
```

### Example Response

```json
{
  "checked_at": "2026-04-14T10:51:45.910Z",
  "coverage_generated_at": "2026-04-14T10:51:45.910Z",
  "database_built": "2026-04-14T10:46:56.824Z",
  "any_stale": false,
  "sources": [
    {
      "name": "EIOPA Publications",
      "url": "https://www.eiopa.europa.eu/publications/guidelines",
      "last_fetched": "2026-04-14",
      "update_frequency": "monthly",
      "max_age_days": 31,
      "age_days": 0,
      "status": "Current",
      "reason": "within expected refresh window"
    }
  ],
  "refresh_command": "gh workflow run ingest.yml --repo Ansvar-Systems/eiopa-insurance-mcp -f force=true",
  "coverage_path": "/app/data/coverage.json",
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://www.eiopa.europa.eu/publications/guidelines"
  }
}
```

Status values:

| Status | Meaning |
|--------|---------|
| `Current` | Within expected refresh window |
| `Due` | Within 20% of refresh deadline (refresh recommended) |
| `OVERDUE` | Past expected refresh date |
| `Never fetched` | `last_fetched` is null in coverage.json |

---

## Errors

Every tool can return an error response in this shape:

```json
{
  "error": "No guideline or technical standard found with reference: XYZ. Use search_eiopa_guidelines to find available references.",
  "_error_type": "not_found",
  "_meta": { "disclaimer": "...", "data_age": "...", "source_url": "..." }
}
```

| `_error_type` | When raised |
|---------------|-------------|
| `validation_error` | Arguments fail Zod schema (missing required field, wrong type, out-of-range number) |
| `not_found` | `get_eiopa_guideline` cannot resolve the supplied reference |
| `unknown_tool` | Tool name does not exist on this server |
| `internal_error` | Database or other unexpected runtime failure |
