/**
 * Seed the EIOPA database with sample categories, guidelines, and technical standards.
 *
 * Usage:
 *   npx tsx scripts/seed-sample.ts
 *   npx tsx scripts/seed-sample.ts --force
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["EIOPA_DB_PATH"] ?? "data/eiopa.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);
console.log(`Database initialised at ${DB_PATH}`);

// --- Categories ---------------------------------------------------------------

interface CategoryRow {
  id: string;
  name: string;
  version: string;
  domain: string;
  description: string;
  item_count: number;
  effective_date: string;
  pdf_url: string;
}

const categories: CategoryRow[] = [
  {
    id: "solvency-ii-guidelines",
    name: "Solvency II Guidelines",
    version: "Consolidated (2016-2024)",
    domain: "Solvency II",
    description:
      "EIOPA Guidelines on the implementation of Solvency II, covering all five pillars: " +
      "quantitative requirements (SCR, MCR, technical provisions), governance and risk management " +
      "(ORSA, internal control, actuarial function), reporting and disclosure (QRT, SFCR, RSR), " +
      "third-country equivalence, and group supervision. Guidelines are addressed to national " +
      "competent authorities (NCAs) and apply to insurance and reinsurance undertakings in the EU.",
    item_count: 80,
    effective_date: "2016-01-01",
    pdf_url: "https://www.eiopa.europa.eu/publications/guidelines",
  },
  {
    id: "technical-standards",
    name: "Technical Standards (ITS/RTS)",
    version: "Solvency II Delegated Regulation EU 2015/35",
    domain: "Technical Standards (ITS/RTS)",
    description:
      "Implementing Technical Standards (ITS) and Regulatory Technical Standards (RTS) adopted " +
      "by the European Commission under Solvency II, DORA, and IORP II. These are legally binding " +
      "EU regulations specifying precise technical requirements for own funds classification, SCR " +
      "standard formula parameters, MCR calculation, reporting templates (QRTs), public disclosure " +
      "(SFCR), supervisory reporting (RSR), and ICT risk management under DORA.",
    item_count: 40,
    effective_date: "2016-01-01",
    pdf_url: "https://www.eiopa.europa.eu/publications/guidelines",
  },
  {
    id: "dora-iorp",
    name: "DORA & IORP II",
    version: "DORA (2025), IORP II (2019)",
    domain: "DORA & IORP II",
    description:
      "EIOPA guidelines and opinions under the Digital Operational Resilience Act (DORA) for " +
      "insurance and reinsurance undertakings, and EIOPA guidelines on the IORP II Directive " +
      "(Institutions for Occupational Retirement Provision). DORA guidance covers ICT risk " +
      "management, incident reporting, digital operational resilience testing, ICT third-party " +
      "risk, and information sharing. IORP II guidelines cover pension fund governance, investment " +
      "and risk management, and member communications.",
    item_count: 25,
    effective_date: "2019-01-13",
    pdf_url: "https://www.eiopa.europa.eu/publications/guidelines",
  },
];

const insertCategory = db.prepare(
  "INSERT OR IGNORE INTO categories (id, name, version, domain, description, item_count, effective_date, pdf_url) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const c of categories) {
  insertCategory.run(
    c.id, c.name, c.version, c.domain, c.description, c.item_count, c.effective_date, c.pdf_url,
  );
}
console.log(`Inserted ${categories.length} categories`);

// --- Guidelines ---------------------------------------------------------------

interface GuidelineRow {
  category_id: string;
  control_ref: string;
  domain: string;
  subdomain: string;
  title: string;
  description: string;
  maturity_level: string;
  priority: string;
}

const guidelines: GuidelineRow[] = [
  // Solvency II — Governance & Risk Management
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/253",
    domain: "Solvency II Guidelines",
    subdomain: "Governance",
    title: "Guidelines on Own Risk and Solvency Assessment (ORSA)",
    description:
      "EIOPA Guidelines on the Own Risk and Solvency Assessment (ORSA) under Solvency II. " +
      "The ORSA is a key element of the system of governance and risk management. Undertakings " +
      "must conduct the ORSA as part of their risk management system and submit the ORSA supervisory " +
      "report to the NCA. The ORSA must cover: the overall solvency needs assessment; compliance " +
      "with SCR and MCR on an ongoing basis; the significance of divergence from the standard formula " +
      "assumptions for the undertaking's risk profile. The ORSA must be performed at least annually " +
      "and after any significant change in the risk profile. Guideline 1 sets out the internal process " +
      "requirements; Guideline 2 covers documentation; Guidelines 3-5 address the overall solvency " +
      "needs; Guidelines 6-7 cover compliance with capital requirements; Guideline 8 covers the " +
      "supervisory report. Internal model users must assess their model limitations in the ORSA.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/259",
    domain: "Solvency II Guidelines",
    subdomain: "Governance",
    title: "Guidelines on System of Governance",
    description:
      "EIOPA Guidelines on the System of Governance under Article 41 of Solvency II. " +
      "Insurance and reinsurance undertakings must have in place an effective system of governance " +
      "that provides for sound and prudent management of the business. The system of governance must " +
      "include: an adequate transparent organisational structure with clear allocation of responsibilities; " +
      "an effective system for ensuring the transmission of information; effective internal control system; " +
      "an internal audit function; an actuarial function; outsourcing policies; remuneration policy. " +
      "The four key functions (risk management, compliance, internal audit, actuarial) must be operationally " +
      "independent. All persons who effectively run the undertaking or hold key functions must be fit and proper. " +
      "Guidelines cover: general governance requirements; fit and proper; risk management system; " +
      "ORSA; internal control; internal audit; actuarial function; outsourcing.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/168",
    domain: "Solvency II Guidelines",
    subdomain: "Governance",
    title: "Guidelines on Internal Controls",
    description:
      "EIOPA Guidelines on the internal control system under Solvency II. The internal control system " +
      "must at least include: administrative and accounting procedures; an internal control framework; " +
      "a compliance function; appropriate reporting procedures at all levels of the undertaking. " +
      "The guidelines require undertakings to establish a control environment, risk assessment processes, " +
      "control activities, information and communication systems, and monitoring activities. " +
      "The compliance function must advise the administrative, management or supervisory body (AMSB) " +
      "on compliance with laws, regulations and administrative provisions. The compliance function must " +
      "assess the possible impact of any changes in the legal environment on the operations of the " +
      "undertaking and identify and assess compliance risk.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/170",
    domain: "Solvency II Guidelines",
    subdomain: "Risk Management",
    title: "Guidelines on Outsourcing to Cloud Service Providers",
    description:
      "EIOPA Guidelines on outsourcing to cloud service providers for insurance and reinsurance " +
      "undertakings. These guidelines apply when an undertaking outsources any function or activity " +
      "to a cloud service provider (CSP). Key requirements: prior notification to NCA for critical or " +
      "important cloud outsourcing; written agreement including audit rights, data security, business " +
      "continuity, sub-outsourcing controls, and exit provisions; ongoing monitoring of CSP performance " +
      "and security; concentration risk assessment where multiple undertakings use the same CSP; " +
      "documented exit strategy with tested exit plan. The undertaking remains fully responsible for " +
      "compliance with Solvency II regardless of the cloud arrangement. The guidelines align with " +
      "EBA cloud guidelines and anticipate DORA requirements.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-20/600",
    domain: "Solvency II Guidelines",
    subdomain: "Risk Management",
    title: "Guidelines on Outsourcing to Cloud Service Providers (2020)",
    description:
      "Updated EIOPA Guidelines on outsourcing to cloud service providers (2020 version). " +
      "Replaces the 2014 outsourcing guidelines with specific cloud-focused requirements. " +
      "Covers: due diligence before cloud adoption; contractual requirements for cloud agreements; " +
      "ongoing monitoring and audit rights; exit strategy and portability requirements; " +
      "concentration and systemic risk from cloud providers; data location and access by supervisors; " +
      "sub-outsourcing and supply chain risk; business continuity and disaster recovery requirements. " +
      "Undertakings must maintain a register of all cloud outsourcing arrangements and notify the NCA " +
      "before outsourcing critical or important operational functions to the cloud. The NCA may object " +
      "within 30 days of notification. Guidelines apply to Solvency II undertakings and supplement " +
      "the general outsourcing guidelines.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/175",
    domain: "Solvency II Guidelines",
    subdomain: "Group Supervision",
    title: "Guidelines on Group Solvency",
    description:
      "EIOPA Guidelines on group solvency calculation and group supervisory reporting. " +
      "Insurance groups must calculate group solvency using the default method (accounting " +
      "consolidation-based method) or the alternative method (deduction and aggregation method). " +
      "The group SCR can be calculated using the standard formula, an approved group internal model, " +
      "or a partial internal model. Group supervisory reporting covers: group SFCR (public); " +
      "group RSR (supervisory); group ORSA report; group QRTs. The group supervisor coordinates " +
      "with the college of supervisors. Intra-group transactions must be reported above materiality " +
      "thresholds. Risk concentration at group level must be monitored and reported. " +
      "The group support regime allows eligible own funds to count at group level subject to NCA approval.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/166",
    domain: "Solvency II Guidelines",
    subdomain: "Quantitative Requirements",
    title: "Guidelines on the Valuation of Technical Provisions",
    description:
      "EIOPA Guidelines on the actuarial valuation of technical provisions under Solvency II. " +
      "Technical provisions comprise the best estimate (discounted probability-weighted average of " +
      "future cash flows) plus the risk margin. The best estimate must use a risk-free interest rate " +
      "term structure published by EIOPA (with or without volatility adjustment or matching adjustment). " +
      "Simplifications are permitted where proportionate. The actuarial function is responsible for the " +
      "calculation of technical provisions. Guidelines cover: data quality standards; methodology for " +
      "non-life and life best estimates; the risk margin calculation using cost-of-capital method at 6%; " +
      "the volatility adjustment; the matching adjustment for long-term liabilities; contract boundaries; " +
      "contract recognition; treatment of expenses; contract options and guarantees.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/180",
    domain: "Solvency II Guidelines",
    subdomain: "Reporting & Disclosure",
    title: "Guidelines on Supervisory Reporting and Public Disclosure",
    description:
      "EIOPA Guidelines on supervisory reporting (RSR) and public disclosure (SFCR) under Solvency II. " +
      "The Solvency and Financial Condition Report (SFCR) must be published annually and cover: " +
      "business and performance; system of governance; risk profile; valuation for solvency purposes; " +
      "capital management. The Regular Supervisory Report (RSR) is submitted to the NCA every three years " +
      "(or on request) and provides more detailed information than the SFCR. Quantitative Reporting " +
      "Templates (QRTs) must be submitted annually and quarterly (for large undertakings). The EIOPA " +
      "taxonomy defines the XBRL/XML format for QRT submission. Guidelines clarify the content " +
      "requirements, materiality thresholds, and timing. NCAs must make the SFCR publicly available.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/179",
    domain: "Solvency II Guidelines",
    subdomain: "Quantitative Requirements",
    title: "Guidelines on the SCR Standard Formula — Underwriting Risk",
    description:
      "EIOPA Guidelines on the standard formula calculation of the Solvency Capital Requirement (SCR) " +
      "for non-life and life underwriting risk. The SCR under the standard formula covers: market risk; " +
      "counterparty default risk; life underwriting risk (mortality, longevity, disability, lapse, " +
      "expense, revision, catastrophe); non-life underwriting risk (premium and reserve risk, lapse, " +
      "catastrophe); health underwriting risk; operational risk. The Basic SCR (BSCR) is calculated " +
      "by aggregating module SCRs using a correlation matrix. The SCR must include a capital add-on " +
      "if the standard formula does not adequately reflect the risk profile. Undertakings may use " +
      "undertaking-specific parameters (USPs) for premium and reserve risk after NCA approval.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-14/172",
    domain: "Solvency II Guidelines",
    subdomain: "Internal Models",
    title: "Guidelines on Internal Models — Pre-Application Process",
    description:
      "EIOPA Guidelines on the pre-application process for full and partial internal models under " +
      "Solvency II. Undertakings wishing to use an internal model to calculate the SCR must obtain " +
      "prior approval from the NCA. The pre-application process involves: preliminary assessment of " +
      "model readiness; submission of documentation package; NCA assessment against the six tests and " +
      "standards (use test, statistical quality, calibration, profit and loss attribution, validation, " +
      "documentation standards); and approval decision. The use test requires the internal model to " +
      "play an important role in the system of governance and decision-making. Partial internal models " +
      "cover only certain risk modules or business units. The college of supervisors is involved for groups.",
    maturity_level: "Conditional",
    priority: "Medium",
  },
  {
    category_id: "solvency-ii-guidelines",
    control_ref: "EIOPA-BoS-23/295",
    domain: "Solvency II Guidelines",
    subdomain: "Risk Management",
    title: "Guidelines on Diversity and Inclusion in Governance",
    description:
      "EIOPA Guidelines on diversity and inclusion in governance for insurance and reinsurance " +
      "undertakings (2023). The guidelines recommend that undertakings consider diversity of skills, " +
      "knowledge, experience, gender, age and geographical provenance when composing the administrative, " +
      "management or supervisory body (AMSB). Undertakings should adopt a diversity policy covering " +
      "the target composition of the AMSB and measures to achieve it. The diversity policy should be " +
      "reviewed regularly. NCAs should assess diversity as part of fit and proper supervision. " +
      "Larger undertakings should set specific diversity targets. The guidelines supplement the " +
      "general governance requirements and align with ESMA guidelines on the same topic.",
    maturity_level: "Recommended",
    priority: "Medium",
  },

  // Technical Standards
  {
    category_id: "technical-standards",
    control_ref: "EU-2015/35-SCR",
    domain: "Technical Standards (ITS/RTS)",
    subdomain: "SCR Standard Formula",
    title: "RTS on SCR Standard Formula — Commission Delegated Regulation (EU) 2015/35",
    description:
      "Commission Delegated Regulation (EU) 2015/35 supplementing Solvency II on the calculation " +
      "of regulatory capital requirements for insurance and reinsurance undertakings. This is the " +
      "primary Solvency II level 2 measure, running to over 900 articles. Key areas: calculation " +
      "of technical provisions (best estimate methodology, risk margin); SCR standard formula " +
      "(all modules: market, counterparty default, life, non-life, health, operational, intangible); " +
      "MCR calculation and corridor (25%-45% of SCR); own funds classification (Tier 1, 2, 3); " +
      "matching adjustment eligibility; volatility adjustment; transitional measures; group solvency; " +
      "reporting and disclosure requirements. This regulation is directly applicable in all EU member " +
      "states. Amended several times including by EU 2019/981 (2020 Solvency II review).",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "technical-standards",
    control_ref: "EU-2015/35-OwnFunds",
    domain: "Technical Standards (ITS/RTS)",
    subdomain: "Own Funds",
    title: "RTS on Own Funds Classification — Articles 69-78 of EU 2015/35",
    description:
      "The own funds classification rules in Commission Delegated Regulation (EU) 2015/35, Articles 69-78. " +
      "Own funds items are classified into three tiers based on their loss-absorbing capacity: " +
      "Tier 1 (best quality — permanent availability, full subordination, no mandatory servicing costs); " +
      "Tier 2 (subordinated, available under going concern and wind-up); " +
      "Tier 3 (limited quality — deferred tax assets, net future profits). " +
      "Basic own funds include: paid-in share capital; initial fund; subordinated liabilities; " +
      "surplus funds; preference shares. Ancillary own funds (off-balance-sheet) require NCA approval. " +
      "Limits: Tier 1 eligible > 50% of SCR; Tier 3 eligible < 15% of SCR. " +
      "Deductions include participations in financial and credit institutions.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "technical-standards",
    control_ref: "ITS-QRT-2016",
    domain: "Technical Standards (ITS/RTS)",
    subdomain: "Reporting Templates",
    title: "ITS on Supervisory Reporting — Quantitative Reporting Templates (QRTs)",
    description:
      "Commission Implementing Regulation (EU) 2015/2450 laying down implementing technical standards " +
      "with regard to the templates for the submission of information to the supervisory authorities " +
      "(Quantitative Reporting Templates). QRTs are standardised reporting forms submitted in XBRL " +
      "format using the EIOPA taxonomy. Annual solo QRTs include: S.01 (basic information); S.02 " +
      "(balance sheet); S.05 (premiums, claims, expenses by line of business); S.12-S.16 (life " +
      "technical provisions); S.17-S.19 (non-life technical provisions); S.22-S.26 (own funds, SCR, MCR); " +
      "S.28 (MCR). Quarterly QRTs for large undertakings cover balance sheet and SCR. Group QRTs add " +
      "intra-group transactions and risk concentration. The EIOPA XBRL taxonomy is updated annually.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "technical-standards",
    control_ref: "ITS-SFCR-2016",
    domain: "Technical Standards (ITS/RTS)",
    subdomain: "Public Disclosure",
    title: "ITS on Public Disclosure — SFCR Template Requirements",
    description:
      "Commission Implementing Regulation (EU) 2015/2452 laying down implementing technical standards " +
      "with regard to the procedures, formats and templates of the Solvency and Financial Condition Report " +
      "(SFCR). The SFCR must be published on the undertaking's website within 14 weeks after the financial " +
      "year end (20 weeks for groups). The SFCR follows a prescribed structure covering five sections: " +
      "A — Business and performance; B — System of governance; C — Risk profile; " +
      "D — Valuation for solvency purposes; E — Capital management. " +
      "The SFCR must include quantitative templates from the QRT set (e.g., S.02, S.05, S.22-S.23, S.25-S.26). " +
      "The report must be signed by the CEO or equivalent. NCAs may allow undertakings to omit information " +
      "that is not material or could prejudice competitive position.",
    maturity_level: "Mandatory",
    priority: "High",
  },

  // DORA & IORP II
  {
    category_id: "dora-iorp",
    control_ref: "EIOPA-DORA-ICT-2024",
    domain: "DORA & IORP II",
    subdomain: "DORA — ICT Risk Management",
    title: "EIOPA Opinion on DORA Implementation for Insurance Undertakings",
    description:
      "EIOPA Opinion on the implementation of the Digital Operational Resilience Act (DORA, " +
      "Regulation (EU) 2022/2554) for insurance and reinsurance undertakings. DORA applies to " +
      "insurance undertakings from 17 January 2025 alongside Solvency II ICT risk requirements. " +
      "DORA requires: ICT risk management framework (Chapter II); ICT incident classification and " +
      "reporting to NCA within strict deadlines (Chapter III); digital operational resilience testing " +
      "including threat-led penetration testing (TLPT) for significant entities (Chapter IV); " +
      "ICT third-party risk management with mandatory contractual provisions (Chapter V); " +
      "information sharing arrangements (Chapter VI). Relationship with Solvency II: DORA is lex " +
      "specialis for ICT risk and operational resilience; Solvency II system of governance " +
      "requirements continue to apply. Joint RTS on ICT risk management adopted by ESAs.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "dora-iorp",
    control_ref: "EIOPA-DORA-TPPM-2024",
    domain: "DORA & IORP II",
    subdomain: "DORA — ICT Third-Party Risk",
    title: "RTS on ICT Third-Party Risk Management under DORA",
    description:
      "Joint RTS (ESAs — EIOPA, EBA, ESMA) on ICT third-party risk management under DORA. " +
      "Insurance undertakings must maintain a register of all ICT third-party service providers " +
      "and distinguish between critical (CTPP) and non-critical providers. Key contractual requirements " +
      "for ICT third-party agreements: full description of services and SLAs; audit rights; data " +
      "location disclosure; business continuity and exit provisions; incident notification obligations; " +
      "termination rights. Critical ICT third-party providers designated by the Joint Committee of " +
      "ESAs are subject to an EU-level oversight framework led by a Lead Overseer. Concentration risk " +
      "must be assessed. Sub-outsourcing chains must be disclosed. The register must be submitted to " +
      "the NCA annually and upon request.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "dora-iorp",
    control_ref: "EIOPA-BoS-19/856",
    domain: "DORA & IORP II",
    subdomain: "IORP II — Governance",
    title: "Guidelines on Governance and Risk Assessment under IORP II",
    description:
      "EIOPA Guidelines on governance and risk assessment for institutions for occupational retirement " +
      "provision (IORPs) under the IORP II Directive (2016/2341/EU). IORPs must have an effective " +
      "system of governance including: sound and prudent management; adequate transparent organisational " +
      "structure with clear allocation of responsibilities; effective system for ensuring transmission " +
      "of information; an effective internal control system; an internal audit function; an actuarial " +
      "function (where applicable); a risk management function; an outsourcing policy. " +
      "The own risk assessment (ORA) must be performed at least every three years and after any " +
      "significant change in the risk profile. Key functions must be held by fit and proper persons. " +
      "Member states may exempt small IORPs from certain governance requirements.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    category_id: "dora-iorp",
    control_ref: "EIOPA-BoS-19/855",
    domain: "DORA & IORP II",
    subdomain: "IORP II — Investment",
    title: "Guidelines on the Prudent Person Principle for IORPs",
    description:
      "EIOPA Guidelines on the prudent person principle for investment by IORPs under IORP II. " +
      "IORPs must invest solely in the interest of members and beneficiaries. Assets must be invested " +
      "in a manner appropriate to the nature and duration of the expected future retirement benefits. " +
      "IORPs must: ensure the security, quality, liquidity, and profitability of the portfolio as a whole; " +
      "only invest in derivative instruments insofar as they contribute to a reduction of investment " +
      "risks or facilitate efficient portfolio management; invest predominantly in regulated markets; " +
      "document their investment decision-making process; have an investment policy statement reviewed " +
      "at least every three years. ESG integration: IORPs must consider how investment decisions are " +
      "based on long-term factors including environmental, social, and governance factors.",
    maturity_level: "Mandatory",
    priority: "High",
  },
];

const insertGuideline = db.prepare(
  "INSERT OR IGNORE INTO guidelines " +
    "(category_id, control_ref, domain, subdomain, title, description, maturity_level, priority) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const g of guidelines) {
  insertGuideline.run(
    g.category_id, g.control_ref, g.domain, g.subdomain, g.title,
    g.description, g.maturity_level, g.priority,
  );
}
console.log(`Inserted ${guidelines.length} guidelines`);

// --- Technical Standards (ITS/RTS as supplementary documents) -----------------

interface TechnicalStandardRow {
  reference: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  full_text: string;
  pdf_url: string;
  status: string;
}

const technicalStandards: TechnicalStandardRow[] = [
  {
    reference: "EIOPA-BoS-14/253-ANNEX",
    title: "ORSA Supervisory Report — Template and Guidance",
    date: "2014-11-19",
    category: "Solvency II Guidelines",
    summary:
      "Template and guidance for the ORSA supervisory report to be submitted by insurance and " +
      "reinsurance undertakings to their national competent authority. The report must cover the " +
      "overall solvency needs assessment, compliance with SCR and MCR requirements, and an assessment " +
      "of how the risk profile differs from the assumptions underlying the SCR standard formula.",
    full_text:
      "EIOPA-BoS-14/253 ORSA Supervisory Report Guidance. " +
      "The ORSA report must include: " +
      "(1) Overall solvency needs — The undertaking must assess whether the SCR adequately reflects " +
      "its overall solvency needs over the business planning period, considering all material risks " +
      "including those not captured in the standard formula (e.g., strategic risk, reputation risk, " +
      "liquidity risk). The assessment must use appropriate and sound methodologies. " +
      "(2) Compliance assessment — Forward-looking compliance with SCR and MCR over the business plan " +
      "period under base case and stress scenarios. The undertaking must demonstrate how it monitors " +
      "and manages compliance on an ongoing basis. " +
      "(3) Standard formula divergence — If using the standard formula, the undertaking must assess " +
      "the significance of the deviation of its risk profile from the standard formula assumptions. " +
      "Where significant deviation is found, the undertaking must consider whether an internal model " +
      "or undertaking-specific parameters would be more appropriate. " +
      "(4) Frequency — The ORSA must be performed at least annually and after any significant change " +
      "in risk profile. The NCA may require more frequent ORSAs. " +
      "(5) Documentation — The ORSA process, results, and conclusions must be documented and the " +
      "supervisory report submitted to the NCA after each ORSA.",
    pdf_url:
      "https://www.eiopa.europa.eu/document-library/guidelines/guidelines-own-risk-and-solvency-assessment_en",
    status: "active",
  },
  {
    reference: "EIOPA-DORA-RTS-ICT-2024",
    title: "RTS on ICT Risk Management Framework under DORA",
    date: "2024-01-17",
    category: "DORA & IORP II",
    summary:
      "Joint RTS by EBA, EIOPA and ESMA specifying the ICT risk management framework elements that " +
      "financial entities including insurers must implement under DORA. Covers ICT governance, " +
      "identification, protection, detection, response and recovery, and ICT business continuity.",
    full_text:
      "Joint RTS on ICT Risk Management Framework under DORA (Regulation (EU) 2022/2554). " +
      "ICT Risk Management Framework requirements: " +
      "(1) ICT Governance — The management body must be responsible for ICT risk management. " +
      "It must approve the ICT risk management framework, allocate adequate budget for ICT security, " +
      "and receive regular reporting on ICT risks and incidents. The management body members must " +
      "maintain sufficient knowledge and skills to understand ICT risks. " +
      "(2) ICT Risk Identification — Financial entities must identify and classify ICT assets, " +
      "map information flows, identify ICT-related dependencies and single points of failure. " +
      "A comprehensive ICT asset register must be maintained. " +
      "(3) ICT Protection — Technical and organisational measures must protect ICT systems and data: " +
      "access controls (privileged access management, MFA for critical systems); encryption of data " +
      "in transit and at rest; network segmentation; patch management (critical patches within 30 days); " +
      "endpoint protection; data backup and recovery tested at least annually. " +
      "(4) ICT Detection — Financial entities must implement continuous monitoring and logging of " +
      "ICT infrastructure, network anomaly detection, and SIEM or equivalent capabilities. " +
      "(5) ICT Response and Recovery — Documented ICT incident response plan; RTO and RPO for critical " +
      "functions; alternative processing arrangements; recovery procedures tested at least annually. " +
      "(6) ICT Business Continuity — Business continuity plans must cover ICT disruption scenarios " +
      "including cyber attacks, third-party failures, and infrastructure outages.",
    pdf_url:
      "https://www.eiopa.europa.eu/publications/rts-ict-risk-management-framework-dora_en",
    status: "active",
  },
  {
    reference: "EIOPA-RTS-QRT-2023",
    title: "ITS on QRT Taxonomy Update 2023 — XBRL Reporting",
    date: "2023-01-01",
    category: "Technical Standards (ITS/RTS)",
    summary:
      "EIOPA 2023 update to the XBRL taxonomy for Quantitative Reporting Templates (QRTs). " +
      "Updates reflect the 2020 Solvency II review changes including volatility adjustment reform, " +
      "long-term equity investments, and new reporting requirements for climate risk exposure.",
    full_text:
      "EIOPA XBRL Taxonomy 2023 Update for Solvency II QRT Reporting. " +
      "The 2023 taxonomy update introduces: " +
      "(1) Climate risk exposure reporting — New templates S.30 series capturing exposure to " +
      "climate-sensitive assets and liabilities. Undertakings must report physical and transition " +
      "risk exposures by asset class. Mandatory for large undertakings from 2024 reporting year. " +
      "(2) Volatility adjustment reform — Updated S.22 template reflecting the revised volatility " +
      "adjustment calculation methodology following the 2021 Solvency II review (Directive 2021/L/270). " +
      "(3) Long-term equity sub-module — New reporting fields in S.25 for undertakings applying the " +
      "long-term equity investment sub-module of the SCR. " +
      "(4) Matching adjustment — Enhanced reporting in S.14 for matching adjustment portfolios " +
      "including spread risk and credit quality distribution. " +
      "(5) Group reporting — Updated G.01 and G.20 templates for intra-group transactions and " +
      "risk concentration reporting to align with the revised group supervision framework. " +
      "The taxonomy is published in XBRL format on the EIOPA website and must be used from " +
      "the Q4 2023 reporting reference date onwards.",
    pdf_url:
      "https://www.eiopa.europa.eu/tools-and-data/supervisory-reporting-solvency-ii_en",
    status: "active",
  },
  {
    reference: "EIOPA-IORP-QRT-2019",
    title: "ITS on IORP II Supervisory Reporting — QRT Templates",
    date: "2019-01-13",
    category: "DORA & IORP II",
    summary:
      "EIOPA Implementing Technical Standard on IORP II supervisory reporting. Sets out the " +
      "templates and formats for the annual and ad-hoc supervisory reports that IORPs must submit " +
      "to national competent authorities. Covers membership data, assets, liabilities, and governance.",
    full_text:
      "ITS on IORP II Supervisory Reporting (Directive 2016/2341/EU). " +
      "IORPs (Institutions for Occupational Retirement Provision) must submit annual supervisory " +
      "reports to their NCA covering: " +
      "(1) Membership data — Number of active members, deferred members, and beneficiaries; " +
      "contributions received and benefits paid; sponsor undertaking information. " +
      "(2) Balance sheet — Market value of assets by asset class (equities, bonds, property, " +
      "alternatives); technical provisions calculated using the member states' actuarial methodology; " +
      "liabilities to sponsors and members. " +
      "(3) Investment — Asset allocation; duration profile; currency exposure; use of derivatives; " +
      "ESG investment policy compliance. " +
      "(4) Risk assessment — Results of the own risk assessment (ORA); key risks identified; " +
      "risk mitigation measures in place; stress test results. " +
      "(5) Governance — Fit and proper assessment of key function holders; outsourcing arrangements " +
      "including critical service providers; conflicts of interest disclosures. " +
      "NCAs may require quarterly reporting for large IORPs. " +
      "Cross-border IORPs must report to the home state NCA with copy to host state NCAs.",
    pdf_url:
      "https://www.eiopa.europa.eu/publications/supervisory-reporting-iorp-ii_en",
    status: "active",
  },
  {
    reference: "EIOPA-BoS-23/456",
    title: "EIOPA Opinion on Sustainability Risks in Solvency II Pillar 2",
    date: "2023-09-20",
    category: "Solvency II Guidelines",
    summary:
      "EIOPA Opinion recommending that NCAs require insurance undertakings to integrate " +
      "sustainability risks — including climate, environmental, social, and governance risks — " +
      "into their ORSA, risk management system, and governance arrangements under Solvency II Pillar 2.",
    full_text:
      "EIOPA Opinion on Sustainability Risks in Solvency II Pillar 2 (2023). " +
      "The Opinion addresses the integration of sustainability risks into the Solvency II framework. " +
      "Key recommendations: " +
      "(1) ORSA integration — Undertakings must include an assessment of material sustainability risks " +
      "in the ORSA. The assessment must cover short-term (1-3 year business plan horizon) and long-term " +
      "(10+ year) perspectives. Climate scenario analysis must be conducted using at least two scenarios " +
      "covering physical and transition risks. Results must be reported to the AMSB. " +
      "(2) Risk management — Sustainability risks must be explicitly integrated into the risk management " +
      "framework. The risk management function must assess how sustainability risks affect the main risk " +
      "categories (underwriting, market, credit, liquidity, operational). " +
      "(3) Investment — The prudent person principle requires consideration of sustainability risks. " +
      "Undertakings must assess whether their investment strategy is consistent with a climate scenario " +
      "aligned with the Paris Agreement goals. " +
      "(4) Underwriting — Undertakings must assess how climate change affects their underwriting risks, " +
      "particularly for natural catastrophe lines. Pricing models must be updated to reflect " +
      "climate-related loss trends. " +
      "(5) Reporting — NCAs should require undertakings to report on sustainability risks in the SFCR " +
      "and RSR. EIOPA will develop standardised templates for sustainability risk reporting.",
    pdf_url:
      "https://www.eiopa.europa.eu/publications/opinion-sustainability-risks-solvency-ii_en",
    status: "active",
  },
];

const insertTS = db.prepare(
  "INSERT OR IGNORE INTO technical_standards (reference, title, date, category, summary, full_text, pdf_url, status) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const ts of technicalStandards) {
  insertTS.run(
    ts.reference, ts.title, ts.date, ts.category, ts.summary, ts.full_text, ts.pdf_url, ts.status,
  );
}
console.log(`Inserted ${technicalStandards.length} technical standards`);

// --- Summary ------------------------------------------------------------------

const fc = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
const gc = (db.prepare("SELECT COUNT(*) AS n FROM guidelines").get() as { n: number }).n;
const tsc = (db.prepare("SELECT COUNT(*) AS n FROM technical_standards").get() as { n: number }).n;

console.log(`
Database summary:
  Categories          : ${fc}
  Guidelines          : ${gc}
  Technical Standards : ${tsc}

Seed complete.`);
