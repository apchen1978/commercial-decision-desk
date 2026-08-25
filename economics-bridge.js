// Deal Economics Bridge — presentation-only owner view.
// Missing numeric evidence remains UNKNOWN; no accounting or decision rule is
// inferred here, and the result never enters evaluateDecision().

const numeric = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export function buildEconomicsBridge(input = {}) {
  const values = {
    revenue: numeric(input.revenue),
    directCost: numeric(input.directCost),
    tradeCost: numeric(input.tradeCost),
    dealSpecificCost: numeric(input.dealSpecificCost),
    contingency: numeric(input.contingency),
    minimumNetContribution: numeric(input.minimumNetContribution),
  };
  const required = ["revenue", "directCost", "tradeCost", "dealSpecificCost", "contingency"];
  const complete = required.every((key) => values[key] !== null);
  const totalKnownCosts = required.slice(1).every((key) => values[key] !== null)
    ? values.directCost + values.tradeCost + values.dealSpecificCost + values.contingency
    : null;
  const expectedNetContribution = complete ? values.revenue - totalKnownCosts : null;
  const gap = expectedNetContribution !== null && values.minimumNetContribution !== null
    ? expectedNetContribution - values.minimumNetContribution
    : null;
  return {
    ...values,
    totalKnownCosts,
    expectedNetContribution,
    gap,
    calculationStatus: complete ? "CALCULATED" : "NOT_CALCULATED",
  };
}

export function economicsEvidenceTrace(bridge) {
  return [
    bridge.revenue === null ? "revenue" : null,
    bridge.directCost === null ? "directCost" : null,
    bridge.tradeCost === null ? "tradeCost" : null,
    bridge.dealSpecificCost === null ? "dealSpecificCost" : null,
    bridge.contingency === null ? "contingency" : null,
  ].filter(Boolean);
}

// Presentation-only reading. This never enters evaluateDecision() and carries
// no threshold or approval meaning.
export function economicsReading(bridge = {}) {
  if (bridge.calculationStatus !== "CALCULATED" || !Number.isFinite(bridge.expectedNetContribution)) return "UNKNOWN";
  if (bridge.expectedNetContribution > 0) return "POSITIVE";
  if (bridge.expectedNetContribution === 0) return "BREAK_EVEN";
  return "NEGATIVE";
}
