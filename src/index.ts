#!/usr/bin/env node

/**
 * EIOPA Insurance Guidelines MCP — stdio entry point.
 *
 * Provides MCP tools for querying European Insurance and Occupational Pensions
 * Authority (EIOPA) guidelines, opinions, ITS/RTS technical standards, DORA
 * insurance guidance, and IORP II pension fund requirements.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  searchRegulations,
  searchControls,
  getControl,
  getCircular,
  listFrameworks,
  getStats,
} from "./db.js";
import { buildFreshnessReport } from "./freshness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pkgVersion = "0.1.0";
try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8"),
  ) as { version: string };
  pkgVersion = pkg.version;
} catch {
  // fallback
}

let sourcesYml = "";
try {
  sourcesYml = readFileSync(join(__dirname, "..", "sources.yml"), "utf8");
} catch {
  // fallback
}

const SERVER_NAME = "eiopa-insurance-mcp";

const DISCLAIMER =
  "This data is provided for informational reference only. It does not constitute legal or professional advice. " +
  "Always verify against official EIOPA publications at https://www.eiopa.europa.eu/publications/guidelines. " +
  "EIOPA guidelines and technical standards are subject to change; confirm currency before reliance.";

const SOURCE_URL = "https://www.eiopa.europa.eu/publications/guidelines";

// --- Tool definitions ---------------------------------------------------------

const TOOLS = [
  {
    name: "search_eiopa_guidelines",
    description:
      "Full-text search across EIOPA guidelines, opinions, and technical standards. " +
      "Covers Solvency II guidelines (governance, risk management, SCR, MCR, internal models, " +
      "group supervision, reporting), DORA ICT risk guidance for insurers, and IORP II pension " +
      "fund requirements. Returns matching documents with reference, title, domain, and summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query (e.g., 'ORSA', 'internal model', 'outsourcing', 'ICT risk', 'SCR')",
        },
        domain: {
          type: "string",
          description:
            "Filter by domain or category (e.g., 'Solvency II Guidelines', " +
            "'Technical Standards (ITS/RTS)', 'DORA & IORP II'). Optional.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Defaults to 10, max 50.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_eiopa_guideline",
    description:
      "Get a specific EIOPA guideline or technical standard by its reference identifier. " +
      "For guidelines use the EIOPA reference (e.g., 'EIOPA-BoS-14/253', 'EIOPA-BoS-20/600'). " +
      "For ITS/RTS use the EU regulation reference (e.g., 'EU-2015/35-SCR', 'EU-2015/35-MCR').",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "EIOPA guideline reference or ITS/RTS reference number",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "search_solvency_ii_rts",
    description:
      "Search EIOPA technical standards specifically. Covers Implementing Technical Standards (ITS) " +
      "and Regulatory Technical Standards (RTS) under Solvency II and DORA. " +
      "Includes standards on SCR standard formula, MCR, own funds, reporting templates, " +
      "public disclosure, and ICT risk management. " +
      "Returns standards with their category and implementation status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query (e.g., 'SCR calculation', 'own funds', 'reporting templates', " +
            "'ICT third-party risk', 'public disclosure')",
        },
        framework: {
          type: "string",
          enum: ["solvency-ii-guidelines", "technical-standards", "dora-iorp"],
          description:
            "Filter by category. solvency-ii-guidelines=Solvency II Guidelines, " +
            "technical-standards=ITS/RTS, dora-iorp=DORA & IORP II. Optional.",
        },
        domain: {
          type: "string",
          description:
            "Filter by domain (e.g., 'Solvency II Guidelines', 'Technical Standards (ITS/RTS)'). Optional.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Defaults to 10, max 50.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_eiopa_categories",
    description:
      "List all EIOPA publication categories covered by this server, including version, " +
      "effective date, item count, and coverage domain. " +
      "Use this to understand what regulatory material is available before searching.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "about",
    description:
      "Return metadata about this MCP server: version, data sources, coverage summary, " +
      "and list of available tools.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_sources",
    description:
      "Return data provenance information: which EIOPA sources are indexed, " +
      "how data is retrieved, update frequency, and licensing terms.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "check_data_freshness",
    description:
      "Per-source freshness report. Reads data/coverage.json at runtime and " +
      "returns each source's last_fetched date, refresh frequency, age in days, " +
      "and a Current/Due/OVERDUE status. Use before relying on time-sensitive " +
      "regulatory text.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// --- Zod schemas --------------------------------------------------------------

const SearchRegulationsArgs = z.object({
  query: z.string().min(1),
  domain: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});

const GetRegulationArgs = z.object({
  document_id: z.string().min(1),
});

const SearchControlsArgs = z.object({
  query: z.string().min(1),
  framework: z.enum(["solvency-ii-guidelines", "technical-standards", "dora-iorp"]).optional(),
  domain: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});

// --- Helpers ------------------------------------------------------------------

function textContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

type ErrorType =
  | "validation_error"
  | "not_found"
  | "unknown_tool"
  | "internal_error";

function errorContent(message: string, errorType: ErrorType = "internal_error") {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { error: message, _error_type: errorType, _meta: buildMeta() },
          null,
          2,
        ),
      },
    ],
    isError: true as const,
  };
}

function buildMeta(sourceUrl?: string): Record<string, unknown> {
  return {
    disclaimer: DISCLAIMER,
    data_age: "See coverage.json; refresh frequency: monthly",
    source_url: sourceUrl ?? SOURCE_URL,
  };
}

// --- Server -------------------------------------------------------------------

const server = new Server(
  { name: SERVER_NAME, version: pkgVersion },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "search_eiopa_guidelines": {
        const parsed = SearchRegulationsArgs.parse(args);
        const results = searchRegulations({
          query: parsed.query,
          domain: parsed.domain,
          limit: parsed.limit ?? 10,
        });
        return textContent({
          results,
          count: results.length,
          _meta: buildMeta(),
        });
      }

      case "get_eiopa_guideline": {
        const parsed = GetRegulationArgs.parse(args);
        const docId = parsed.document_id;

        // Try guideline first
        const guideline = getControl(docId);
        if (guideline) {
          return textContent({
            ...guideline,
            _citation: {
              canonical_ref: guideline.control_ref,
              display_text: `EIOPA — ${guideline.title} (${guideline.control_ref})`,
            },
            _meta: buildMeta(),
          });
        }

        // Try technical standard
        const ts = getCircular(docId);
        if (ts) {
          return textContent({
            ...ts,
            _citation: {
              canonical_ref: ts.reference,
              display_text: `EIOPA Technical Standard — ${ts.title} (${ts.reference})`,
            },
            _meta: buildMeta(ts.pdf_url ?? SOURCE_URL),
          });
        }

        return errorContent(
          `No guideline or technical standard found with reference: ${docId}. ` +
            "Use search_eiopa_guidelines to find available references.",
          "not_found",
        );
      }

      case "search_solvency_ii_rts": {
        const parsed = SearchControlsArgs.parse(args);
        const results = searchControls({
          query: parsed.query,
          framework: parsed.framework,
          domain: parsed.domain,
          limit: parsed.limit ?? 10,
        });
        return textContent({
          results,
          count: results.length,
          _meta: buildMeta(),
        });
      }

      case "list_eiopa_categories": {
        const categories = listFrameworks();
        return textContent({
          categories,
          count: categories.length,
          _meta: buildMeta(),
        });
      }

      case "about": {
        const stats = getStats();
        return textContent({
          name: SERVER_NAME,
          version: pkgVersion,
          description:
            "European Insurance and Occupational Pensions Authority (EIOPA) MCP server. " +
            "Provides structured access to EIOPA guidelines, opinions, ITS/RTS technical standards, " +
            "DORA insurance guidance, and IORP II requirements for EU insurance companies, " +
            "reinsurers, insurance groups, pension funds, and national insurance regulators.",
          data_source: "European Insurance and Occupational Pensions Authority (EIOPA)",
          source_url: SOURCE_URL,
          coverage: {
            categories: `${stats.categories} EIOPA publication categories`,
            guidelines: `${stats.guidelines} guidelines and opinions`,
            technical_standards: `${stats.technical_standards} ITS/RTS documents`,
            jurisdictions: ["EU"],
            sectors: ["Insurance", "Reinsurance", "Pensions", "Insurance Groups"],
          },
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
          _meta: buildMeta(),
        });
      }

      case "list_sources": {
        return textContent({
          sources_yml: sourcesYml,
          note: "Data is sourced from official EIOPA public publications. See sources.yml for full provenance.",
          _meta: buildMeta(),
        });
      }

      case "check_data_freshness": {
        const report = buildFreshnessReport();
        return textContent({ ...report, _meta: buildMeta() });
      }

      default:
        return errorContent(`Unknown tool: ${name}`, "unknown_tool");
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorContent(
        `Invalid arguments for ${name}: ${err.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ")}`,
        "validation_error",
      );
    }
    return errorContent(
      `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`,
      "internal_error",
    );
  }
});

// --- Start --------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVER_NAME} v${pkgVersion} running on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
