// workbench-adapter.js — Manual Evidence Adapter for the CDD Workbench.
// Thin layer between business-facing inputs and the existing opportunity contract.
// It NORMALIZES input; it does NOT decide. Decision logic lives exclusively in
// decision-engine.js (which remains unchanged).
//
// Responsibilities:
//   - normalize manual input into the opportunity contract shape
//   - validate allowed vocabulary (fail-closed to UNKNOWN on invalid values)
//   - preserve explicit UNKNOWN ("Not assessed" stays UNKNOWN / absent)
//   - construct contradiction records from user input (never inferred)
//   - normalize payment-event completeness (only complete+finite counts)
//   - pass optional KYC data (absent when "not assessed")
//   - pass optional margin policy data (absent when "not assessed")
//
// MUST NOT: make commercial decisions, duplicate engine rules, invent evidence,
// invent KYC clearance, invent margin thresholds, infer contradictions, infer
// urgency, rank incomparable quotes.
import { PAYMENT_DISCLOSURE } from "./decision-engine.js";
import { normalizePaymentEvidence } from "./payment-evidence.js";

// --- vocabulary maps (business words -> contract values) --------------------
const FIT_MAP = {
  strong: "HIGH",
  some: "MEDIUM",
  weak: "LOW",
  unknown: "UNKNOWN",
};
// category fit has an extra "not our category" level that must veto
const CATEGORY_MAP = {
  strong: "HIGH",
  partial: "MEDIUM",
  weak: "LOW",
  notOurCategory: "WEAK",
  unknown: "UNKNOWN",
};
const TERMS_MAP = {
  agreed: "COMPLETE",
  notAgreed: "INCOMPLETE",
  unknown: "INCOMPLETE", // not-assessed must NOT render as agreed
};
const KYC_MAP = {
  notAssessed: null, // -> field ABSENT (engine sees no KYC data)
  clear: { status: "CLEAR", beneficialOwnerVerified: true, sanctionsHit: false, adverseFinding: false },
  incomplete: { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false, adverseFinding: false },
  sanctionsConcern: { status: "ADVERSE", beneficialOwnerVerified: true, sanctionsHit: true, adverseFinding: true },
};
const MARGIN_STATUS = {
  notAssessed: "NOT_ASSESSED",
  assessed: "ASSESSED",
};

// --- blank-assessment UNKNOWN-safe defaults --------------------------------
// Missing information stays missing. No commercially favorable pre-fill.
export function blankAssessmentDefaults() {
  return {
    name: "",
    buyerFit: "unknown",
    categoryFit: "unknown",
    evidenceQuality: "unknown",
    termsStatus: "unknown",
    termsDetail: "",
    contradictions: [], // { label, detail, material, resolved }
    unknowns: [], // { label, detail, blocks }
    paymentEvents: [], // { label, amountCny, daysFromSign, complete }
    paymentEvidence: [], // { label, state, source, fragment, asOf, humanStatus }
    quotes: [], // { id, basis, complete }
    quotesComparable: "notAssessed",
    why: [],
    whyNot: [],
    kycStatus: "notAssessed",
    marginStatus: "notAssessed",
    marginBps: "",
    marginThresholdBps: "",
    note: "",
  };
}

function fin(v) {
  if (v === "" || v === null || v === undefined) return null; // blank stays blank
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// --- core: normalize business input -> opportunity contract -----------------
export function buildOpportunityFromInput(input) {
  const in_ = { ...blankAssessmentDefaults(), ...(input || {}) };

  // dimension values — validate; invalid/empty fails closed to UNKNOWN
  const buyerFit = FIT_MAP[in_.buyerFit] || "UNKNOWN";
  const categoryFit = CATEGORY_MAP[in_.categoryFit] || "UNKNOWN";
  const evidenceQuality = FIT_MAP[in_.evidenceQuality] || "UNKNOWN";

  // contradiction records — user-supplied only, never inferred
  const contradictions = (in_.contradictions || [])
    .filter((c) => c && c.label && String(c.label).trim())
    .map((c, i) => ({
      id: c.id || `CTR-${i + 1}`,
      label: String(c.label),
      detail: String(c.detail || ""),
      material: c.material === true,
      status: c.resolved === true ? "RESOLVED" : "UNRESOLVED",
    }));

  // unknowns — user-supplied only
  const unknowns = (in_.unknowns || [])
    .filter((u) => u && u.label && String(u.label).trim())
    .map((u, i) => ({
      id: u.id || `UNK-${i + 1}`,
      label: String(u.label),
      detail: String(u.detail || ""),
      blocksPursue: u.blocks === true,
    }));

  // payment events — completeness normalized: only COMPLETE + finite counts
  const paymentEvents = (in_.paymentEvents || [])
    .filter((e) => e && e.label && String(e.label).trim())
    .map((e, i) => ({
      id: e.id || `PE-${i + 1}`,
      label: String(e.label),
      amountCny: fin(e.amountCny),
      daysFromSign: fin(e.daysFromSign),
      status: e.complete === true && fin(e.amountCny) !== null && fin(e.daysFromSign) !== null ? "COMPLETE" : "INCOMPLETE",
    }));

  // quotes — completeness normalized
  const quotes = (in_.quotes || [])
    .filter((q) => q && q.basis && String(q.basis).trim())
    .map((q, i) => ({
      id: q.id || `Q-${i + 1}`,
      basis: String(q.basis),
      status: q.complete === true ? "COMPLETE" : "INCOMPLETE",
    }));

  // KYC — optional; "not assessed" => field ABSENT (never renders as cleared)
  const kyc = KYC_MAP[in_.kycStatus] || null;

  // margin — optional; "not assessed" => field ABSENT (engine invents no threshold)
  let margin = null;
  if (in_.marginStatus === "assessed" || in_.marginStatus === "ASSESSED") {
    const bps = fin(in_.marginBps);
    const threshold = fin(in_.marginThresholdBps);
    if (bps !== null && threshold !== null) {
      margin = { bps, thresholdBps: threshold };
    }
    // if numbers missing/invalid, margin stays null -> ABSENT (no invented threshold)
  }

  // quote comparability — explicit; "not assessed" => not comparable (never ranked)
  const quoteBasesComparable = in_.quotesComparable === "yes";

  return {
    id: in_.id || "WORKBENCH-OPP",
    synthetic: false, // this is MANUAL input, not a fixture
    name: String(in_.name || "Untitled opportunity"),
    summary: String(in_.note || ""),
    source: "Manual workbench input",
    dimensions: {
      buyerFit: { value: buyerFit, evidence: [] },
      categoryFit: { value: categoryFit, evidence: [] },
      evidenceQuality: { value: evidenceQuality, evidence: [] },
      importOpenness: { value: "UNKNOWN", evidence: [] },
      commercialFeasibility: { value: "UNKNOWN", evidence: [] },
    },
    contradictions,
    unknowns,
    whyNot: (in_.whyNot || []).filter((w) => w && String(w).trim()),
    why: (in_.why || []).filter((w) => w && String(w).trim()),
    commercialTerms: {
      status: TERMS_MAP[in_.termsStatus] || "INCOMPLETE",
      detail: String(in_.termsDetail || ""),
      paymentEvidence: normalizePaymentEvidence(in_.paymentEvidence),
    },
    quotes,
    quoteBasesComparable,
    quoteComparabilityAssessed: in_.quotesComparable !== "notAssessed",
    paymentEvents,
    buyers: [{ id: "B1", label: "Manual buyer entry" }],
    paymentDisclosure: PAYMENT_DISCLOSURE,
    ...(kyc ? { kyc } : {}),
    ...(margin ? { margin } : {}),
  };
}

// --- business-facing summary (what the result view needs to render) ---------
// Mirrors input back with NOT-ASSESSED visibility. NOT ASSESSED != CLEARED.
export function summarizeInput(input) {
  const in_ = { ...blankAssessmentDefaults(), ...(input || {}) };
  return {
    buyerFit: in_.buyerFit,
    categoryFit: in_.categoryFit,
    evidenceQuality: in_.evidenceQuality,
    termsStatus: in_.termsStatus,
    kycStatus: in_.kycStatus,
    marginStatus: in_.marginStatus,
    quotesComparable: in_.quotesComparable,
    contradictionCount: (in_.contradictions || []).filter((c) => c && c.label).length,
    unknownCount: (in_.unknowns || []).filter((u) => u && u.label).length,
    paymentCount: (in_.paymentEvents || []).filter((e) => e && e.label).length,
  };
}
