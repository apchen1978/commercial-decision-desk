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
    "SYNTHETIC / HYPOTHETICAL: a Gulf-region hospitality procurement desk invites international suppliers to quote on a multi-property hotel window-treatment rollout. The current commercial case is attractive, but the released volume and binding payment terms remain unresolved.",
  source: "Synthetic procurement notice + referral call note (both fabricated)",
  commercialContext: {
    product: "Blackout drapery, sheer curtains and decorative valances (synthetic)",
    buyerCompany: "Gulf Coast Hospitality Procurement (synthetic)",
    market: "UAE — Abu Dhabi hospitality projects (synthetic sample)",
    quantity: "12000",
    quantityUnit: "metres",
    timing: "First shipment target: 15 Sep 2026; installation window: Oct–Nov 2026 (synthetic)",
    relationship: "new",
    source: "Synthetic RFP + synthetic referral call note",
    contactRole: "Regional procurement manager (synthetic)",
    purchasingAuthority: "yes",
    technicalAuthority: "yes",
    finalApprover: "unknown",
    accessDecisionMaker: "yes",
  },
  economics: {
    currency: "USD",
    revenue: 480000,
    directCost: 264000,
    tradeCost: 42000,
    dealSpecificCost: 36000,
    contingency: 18000,
    minimumNetContribution: 96000,
  },
  trade: {
    deliveryTerm: "CIF",
    namedPlace: "Khalifa Port, Abu Dhabi (synthetic)",
  },
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
        { tier: "SUPPORTING", note: "MOQ and the Sep 2026 shipment window are feasible at current capacity (synthetic estimate)." },
        { tier: "SUPPORTING", note: "The baseline quote is CIF Khalifa Port; local installation and importer obligations remain outside the baseline supply scope (synthetic)." },
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
      resolveWith: "Written confirmation of binding payment terms (resolves CTR-1 / UNK-2)",
    },
  ],
  unknowns: [
    { id: "UNK-1", label: "Released order volume", detail: "The 12,000-metre planning quantity is an indicative RFP baseline. The released purchase-order quantity remains UNKNOWN until confirmed.", blocksPursue: true, resolveWith: "Buyer-issued purchase order or released quantity schedule" },
    { id: "UNK-2", label: "Final payment terms", detail: "Contradictory sources (CTR-1); the binding terms are UNKNOWN until confirmed in writing.", blocksPursue: true, resolveWith: "Written confirmation of binding payment terms" },
    { id: "UNK-3", label: "Installation and importer liability", detail: "Whether local installation, import clearance, duty and site-side liability can be excluded from the supplier scope remains UNKNOWN.", blocksPursue: false, resolveWith: "Written responsibility matrix for installation, import and site delivery" },
  ],
  whyNot: [
    "Payment-terms contradiction (CTR-1) is unresolved — proceeding on assumed terms would convert UNKNOWN into fact.",
    "Installation + customs-liability scope is requested but outside the standard quoted scope.",
    "Indicative volume figures are unverified (VERIFICATION_REQUIRED tier).",
  ],
  why: [
    "Strong Buyer Fit: the synthetic procurement desk has a defined category, volume baseline and meeting path.",
    "Strong Category Fit: blackout drapery, sheers and valances match the core window-treatment category.",
    "Clear import openness: the synthetic RFP explicitly invites international suppliers for delivery to Abu Dhabi.",
    "The USD 120,000 expected net contribution is above the synthetic owner reference of USD 96,000, before unresolved terms are accepted.",
  ],
  commercialTerms: {
    status: "INCOMPLETE",
    detail:
      "SYNTHETIC planning basis: USD 480,000 CIF Khalifa Port, 60-day quote validity, 12,000-metre MOQ baseline and sample-approved production scope. The buyer's RFP states 90 days after delivery while a referral note suggests 30% advance; binding payment terms are therefore INCOMPLETE. Target price is USD 40/metre; a requested 5% discount and two competing supplier offers require scope-normalized comparison.",
    resolveWith: "Binding commercial terms in writing (payment schedule, CIF named place and excluded installation/import scope)",
    paymentEvidence: [
      { id: "PEV-1", label: "Buyer RFP: 90 days after delivery", state: "PROPOSED", source: "Synthetic buyer RFP", fragment: "Payment at 90 days after delivery", asOf: "2026-06-18 (synthetic)", humanStatus: "PENDING_REVIEW" },
      { id: "PEV-2", label: "Referral note: 30% advance", state: "MENTIONED", source: "Synthetic referral call note", fragment: "Verbal indication of a 30% advance", asOf: "2026-06-20 (synthetic)", humanStatus: "PENDING_REVIEW" },
    ],
  },
  quotes: [
    {
      id: "Q-1",
      basis: "FOB Ningbo — goods, export clearance and on-board delivery only (synthetic competing quote)",
      status: "COMPLETE",
    },
    {
      id: "Q-2",
      basis: "CIF Khalifa Port — goods, ocean freight and cargo insurance; no installation or import duty (synthetic baseline quote)",
      status: "COMPLETE",
    },
    {
      id: "Q-3",
      basis: "DAP project warehouse — local delivery included; installation and duty assumptions require confirmation (synthetic alternative)",
      status: "COMPLETE",
    },
  ],
  quoteBasesComparable: false, // rule 4: non-comparable bases → never ranked
  paymentEvents: [
    { id: "PE-1", label: "Internal factory deposit — 30% of USD 480,000 at synthetic planning FX 7.50 CNY/USD", amountCny: 1080000, daysFromSign: 0, status: "COMPLETE" },
    { id: "PE-2", label: "Internal factory balance — 70% of USD 480,000 at synthetic planning FX 7.50 CNY/USD", amountCny: 2520000, daysFromSign: 45, status: "COMPLETE" },
  ],
  kyc: {
    status: "CLEAR",
    beneficialOwnerVerified: true,
    evidence: "Synthetic screening record: no adverse finding represented in this demo fixture.",
  },
  buyers: [{ id: "BUYER-1", label: "Gulf Coast Hospitality Procurement (synthetic)" }],
  paymentDisclosure:
    "SYNTHETIC planning note: payment exposure is calculated from complete internal supplier-commitment events only, using the stated hypothetical planning FX. It is NOT cash balance, liquidity, affordability, cash shortfall, credit capacity, or binding buyer payment terms.",
};

export const dimensions = [
  { key: "buyerFit", label: "Buyer Fit" },
  { key: "categoryFit", label: "Category Fit" },
  { key: "evidenceQuality", label: "Evidence Quality" },
  { key: "importOpenness", label: "Import Openness / Sourcing" },
  { key: "commercialFeasibility", label: "Commercial Feasibility" },
];
