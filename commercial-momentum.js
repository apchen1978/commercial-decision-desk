// Commercial Momentum v0.1 — owner-governed, deterministic presentation model.
//
// This module is deliberately separate from decision-engine.js. It answers two
// descriptive questions from the existing opportunity contract:
//   1. How supportive are the *known* commercial signals? (Momentum)
//   2. How much of the important evidence is present? (Coverage)
// It does not predict closing, evaluate gates, or produce a recommendation.

const KNOWN = new Set(["HIGH", "STRONG", "MEDIUM", "CONDITIONAL", "LOW", "WEAK", "NONE", "IRRELEVANT"]);

export const MOMENTUM_DIMENSIONS = Object.freeze([
  { id: "buyerFit", label: "Buyer fit", weight: 30 },
  { id: "categoryFit", label: "Product fit", weight: 30 },
  { id: "importOpenness", label: "Import openness", weight: 15 },
  { id: "commercialFeasibility", label: "Commercial feasibility", weight: 15 },
  { id: "knownEconomics", label: "Known economics", weight: 10 },
]);

export const COVERAGE_DIMENSIONS = Object.freeze([
  { id: "buyerFit", label: "Buyer fit", weight: 12 },
  { id: "categoryFit", label: "Product fit", weight: 12 },
  { id: "importOpenness", label: "Import openness", weight: 10 },
  { id: "commercialFeasibility", label: "Commercial feasibility", weight: 10 },
  { id: "commercialTerms", label: "Commercial terms", weight: 14 },
  { id: "paymentStructure", label: "Payment structure", weight: 12 },
  { id: "quoteComparability", label: "Quote comparability", weight: 10 },
  { id: "kyc", label: "Customer verification", weight: 8 },
  { id: "economics", label: "Deal economics", weight: 8 },
  { id: "buyerAuthority", label: "Buyer authority", weight: 4 },
]);

const VALUE_POINTS = Object.freeze({ HIGH: 100, STRONG: 100, MEDIUM: 65, CONDITIONAL: 50, LOW: 25, WEAK: 0, NONE: 0, IRRELEVANT: 0 });
const clone = (value) => JSON.parse(JSON.stringify(value));

function valueOf(opportunity, id) {
  return String(opportunity?.dimensions?.[id]?.value || "UNKNOWN").toUpperCase();
}

function momentumEvidence(opportunity, economicsBridge) {
  return MOMENTUM_DIMENSIONS.map((dimension) => {
    if (dimension.id === "knownEconomics") {
      const net = economicsBridge?.expectedNetContribution;
      if (economicsBridge?.calculationStatus !== "CALCULATED" || !Number.isFinite(net)) {
        return { ...dimension, value: "UNKNOWN", points: null, source: "economics" };
      }
      const points = net > 0 ? 100 : net === 0 ? 50 : 0;
      return { ...dimension, value: net > 0 ? "POSITIVE" : net === 0 ? "BREAK_EVEN" : "NEGATIVE", points, source: "economics" };
    }
    const value = valueOf(opportunity, dimension.id);
    return { ...dimension, value, points: KNOWN.has(value) ? VALUE_POINTS[value] : null, source: `dimensions.${dimension.id}` };
  });
}

export function buildCommercialMomentum(opportunity = {}, economicsBridge = {}) {
  const dimensions = momentumEvidence(opportunity, economicsBridge);
  const known = dimensions.filter((dimension) => dimension.points !== null);
  const unknown = dimensions.filter((dimension) => dimension.points === null);
  const knownWeight = known.reduce((sum, dimension) => sum + dimension.weight, 0);
  // One favourable data point is not enough to manufacture a 0–100 index.
  const status = known.length >= 2 ? "CALCULATED" : "NOT_ENOUGH_KNOWN_SIGNALS";
  const rawScore = knownWeight ? known.reduce((sum, dimension) => sum + dimension.points * dimension.weight, 0) / knownWeight : null;
  const score = status === "CALCULATED" ? Math.round(rawScore) : null;
  const drivers = known.map((dimension) => ({
    id: dimension.id,
    value: dimension.value,
    direction: dimension.points >= 80 ? "UP" : dimension.points <= 25 ? "DOWN" : "CONDITIONAL",
    contribution: Math.round((dimension.points * dimension.weight / knownWeight) * 10) / 10,
    evidenceTrace: dimension.source,
  }));
  return {
    status,
    score,
    model: "OWNER_GOVERNED_HEURISTIC_NOT_CALIBRATED",
    definition: "Supportiveness of currently known commercial signals; not a close probability or decision recommendation.",
    dimensions: clone(dimensions),
    drivers,
    unknownDimensions: unknown.map((dimension) => ({ id: dimension.id, label: dimension.label, evidenceTrace: dimension.source })),
  };
}

function authorityCoverage(context = {}) {
  const fields = ["purchasingAuthority", "technicalAuthority", "finalApprover", "accessDecisionMaker"];
  const present = fields.filter((field) => ["yes", "no"].includes(context[field])).length;
  return present / fields.length;
}

function paymentCoverage(events = []) {
  if (!events.length) return 0;
  const complete = events.filter((event) => event.status === "COMPLETE").length;
  if (!complete) return 0;
  return complete === events.length ? 1 : 0.5;
}

function economicsCoverage(bridge = {}) {
  const keys = ["revenue", "directCost", "tradeCost", "dealSpecificCost", "contingency"];
  return keys.filter((key) => bridge[key] !== null && bridge[key] !== undefined).length / keys.length;
}

export function buildEvidenceCoverage(opportunity = {}, economicsBridge = {}) {
  const context = opportunity.commercialContext || {};
  const assessed = {
    buyerFit: KNOWN.has(valueOf(opportunity, "buyerFit")) ? 1 : 0,
    categoryFit: KNOWN.has(valueOf(opportunity, "categoryFit")) ? 1 : 0,
    importOpenness: KNOWN.has(valueOf(opportunity, "importOpenness")) ? 1 : 0,
    commercialFeasibility: KNOWN.has(valueOf(opportunity, "commercialFeasibility")) ? 1 : 0,
    commercialTerms: opportunity.commercialTerms?.status === "COMPLETE" ? 1 : opportunity.commercialTerms?.status === "INCOMPLETE" ? 0.5 : 0,
    paymentStructure: paymentCoverage(opportunity.paymentEvents || []),
    quoteComparability: typeof opportunity.quoteComparabilityAssessed === "boolean"
      ? (opportunity.quoteComparabilityAssessed ? 1 : 0)
      : typeof opportunity.quoteBasesComparable === "boolean" ? 1 : 0,
    kyc: Object.keys(opportunity.kyc || {}).length ? 1 : 0,
    economics: economicsCoverage(economicsBridge),
    buyerAuthority: authorityCoverage(context),
  };
  const dimensions = COVERAGE_DIMENSIONS.map((dimension) => ({
    ...dimension,
    coverage: assessed[dimension.id],
    status: assessed[dimension.id] === 1 ? "COVERED" : assessed[dimension.id] > 0 ? "PARTIAL" : "UNKNOWN",
  }));
  const score = Math.round(dimensions.reduce((sum, dimension) => sum + dimension.weight * dimension.coverage, 0));
  return {
    score,
    definition: "Share of the defined commercial evidence set that is recorded or partially recorded; it is not evidence quality or deal attractiveness.",
    dimensions,
    missing: dimensions.filter((dimension) => dimension.coverage < 1).map((dimension) => ({ id: dimension.id, label: dimension.label, status: dimension.status })),
  };
}
