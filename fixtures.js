// fixtures.js — SYNTHETIC fixture for the Commercial Decision Desk prototype.
// EVERY record below is fabricated for demonstration. No real prospect,
// company, person, financial figure, or contact appears here. Do not treat
// any value as real commercial data.

export const SYNTHETIC_LABEL =
  "SYNTHETIC FIXTURE — every record is fabricated for demonstration. No real prospect, company, or financial figure.";

export const opportunity = {
  id: "OPP-2026-008",
  synthetic: true,
  name: "Gulf Coast Hospitality — Window-Treatment Supply Inquiry",
  summary:
    "A Gulf-region hospitality procurement desk invites international suppliers to quote on window treatments for a multi-property hotel rollout. Volume figures are indicative only.",
  source: "Synthetic procurement notice + referral call note (both fabricated)",
  dimensions: {
    buyerFit: {
      value: "HIGH",
      evidence: [
        { tier: "SUPPORTING", note: "Procurement notice names a dedicated buyer persona and states overseas sourcing is standard practice (synthetic)." },
        { tier: "SUPPORTING", note: "Referral call note records a scheduled follow-up with the procurement desk (synthetic)." },
      ],
    },
    categoryFit: {
      value: "HIGH",
      evidence: [
        { tier: "PRIMARY", note: "Product spec (curtains + window hardware) matches the core soft-furnishing category (synthetic spec doc)." },
      ],
    },
    evidenceQuality: {
      value: "MEDIUM",
      evidence: [
        { tier: "PRIMARY", note: "Product specification document reviewed (synthetic)." },
        { tier: "SUPPORTING", note: "Procurement notice + referral note (synthetic)." },
        { tier: "VERIFICATION_REQUIRED", note: "Indicative volume figures copied from a trade-aggregator summary; not yet confirmed against the buyer (synthetic)." },
      ],
    },
    importOpenness: {
      value: "HIGH",
      evidence: [
        { tier: "PRIMARY", note: "RFP text explicitly invites international suppliers and references an overseas delivery point (synthetic)." },
      ],
    },
    commercialFeasibility: {
      value: "CONDITIONAL",
      evidence: [
        { tier: "SUPPORTING", note: "MOQ and lead time are feasible at current capacity (synthetic estimate)." },
        { tier: "SUPPORTING", note: "Buyer requests installation + customs-liability terms that fall outside the standard quoted scope (synthetic)." },
      ],
    },
  },
  contradictions: [
    {
      id: "CTR-1",
      label: "Payment-terms contradiction",
      detail:
        "The procurement notice states payment at 90 days after delivery. The referral call note records a verbal indication of a 30% advance. These cannot both be true as stated.",
      material: true,
      status: "UNRESOLVED",
    },
  ],
  unknowns: [
    { id: "UNK-1", label: "Actual order volume", detail: "Indicative volumes are unverified (VERIFICATION_REQUIRED tier). Volume remains UNKNOWN until confirmed.", blocksPursue: true },
    { id: "UNK-2", label: "Final payment terms", detail: "Contradictory sources (CTR-1); the binding terms are UNKNOWN until confirmed in writing.", blocksPursue: true },
    { id: "UNK-3", label: "Installation liability", detail: "Whether installation + customs liability is negotiable is UNKNOWN.", blocksPursue: false },
    { id: "UNK-4", label: "Buyer payment history", detail: "No public payment-history data exists for this buyer. Payment behavior is UNKNOWN — no credit score is invented.", blocksPursue: false },
  ],
  whyNot: [
    "Payment-terms contradiction (CTR-1) is unresolved — proceeding on assumed terms would convert UNKNOWN into fact.",
    "Installation + customs-liability scope is requested but outside the standard quoted scope.",
    "Indicative volume figures are unverified (VERIFICATION_REQUIRED tier).",
  ],
  why: [
    "Strong Buyer Fit: active procurement desk with an explicit schedule.",
    "Strong Category Fit: window treatments are the core category.",
    "Clear import openness: RFP invites international suppliers.",
    "Feasible MOQ and lead time at current capacity (synthetic estimate).",
  ],
  commercialTerms: {
    status: "INCOMPLETE",
    detail:
      "Payment mode and schedule are referenced but contradictory (CTR-1); delivery window is conditional on sample approval. Terms are INCOMPLETE — missing items remain UNKNOWN.",
  },
  quotes: [
    {
      id: "Q-1",
      basis: "FOB — ex-works plus freight to port",
      status: "COMPLETE",
    },
    {
      id: "Q-2",
      basis: "CIF + installation + customs liability",
      status: "COMPLETE",
    },
    {
      id: "Q-3",
      basis: "DDP with penalty clauses",
      status: "INCOMPLETE",
    },
  ],
  quoteBasesComparable: false, // rule 4: non-comparable bases → never ranked
  paymentEvents: [
    { id: "PE-1", label: "Deposit (30%)", amountCny: 25200, daysFromSign: 0, status: "COMPLETE" },
    { id: "PE-2", label: "Balance (70%)", amountCny: 58800, daysFromSign: 45, status: "COMPLETE" },
    { id: "PE-3", label: "Conditional performance bond", amountCny: 0, daysFromSign: null, status: "INCOMPLETE" },
  ],
  buyers: [{ id: "BUYER-1", label: "Gulf Coast Hospitality Procurement (synthetic)" }],
  paymentDisclosure:
    "Payment exposure is calculated from committed payment events only. It is NOT cash balance, liquidity, affordability, cash shortfall, or credit capacity. Payment concentration refers to payment commitments only.",
};

export const dimensions = [
  { key: "buyerFit", label: "Buyer Fit" },
  { key: "categoryFit", label: "Category Fit" },
  { key: "evidenceQuality", label: "Evidence Quality" },
  { key: "importOpenness", label: "Import Openness / Sourcing" },
  { key: "commercialFeasibility", label: "Commercial Feasibility" },
];
