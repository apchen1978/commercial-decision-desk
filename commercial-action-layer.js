// Presentation-only commercial structure and action derivation.
// This module reads the existing opportunity contract, engine result, and
// Decision Path experiment. It does not evaluate, score, infer, or add gates.

export const ACTION_TYPES = Object.freeze([
  "PAYMENT_NEGOTIATION",
  "INCOTERM_CLARIFICATION",
  "QUOTE_NORMALIZATION",
  "MARGIN_PROTECTION",
  "SPECIFICATION_CONFIRMATION",
  "CERTIFICATION_CLARIFICATION",
  "BUYER_AUTHORITY_VERIFICATION",
  "KYC_CREDIT_VERIFICATION",
  "TIMELINE_CONFIRMATION",
  "NEGOTIATION_ESCALATION",
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

function trace(sourceType, sourceId, label) {
  return { sourceType, sourceId, label };
}

function action(actionType, priority, trigger, evidenceTrace, rerunWhen) {
  return { actionType, priority, trigger, evidenceTrace, rerunWhen };
}

function addAction(actions, candidate) {
  if (actions.some((item) => item.actionType === candidate.actionType)) return;
  actions.push(candidate);
}

export function derivePriorityActions(opportunity, engine, decisionPathExperiment = null) {
  const actions = [];
  const contradictions = engine.materialContradictions || [];
  const unknowns = engine.blockingUnknowns || [];

  if (engine.kycGate === "SANCTIONS_VETO") {
    addAction(actions, action(
      "KYC_CREDIT_VERIFICATION",
      1,
      "KYC_GATE",
      [trace("existing_gate", "KYC", "Existing KYC sanctions/adverse gate")],
      "Rerun after a traceable verification result is recorded.",
    ));
  }
  if (engine.marginGate === "BELOW_THRESHOLD") {
    addAction(actions, action(
      "MARGIN_PROTECTION",
      1,
      "MARGIN_GATE",
      [trace("existing_gate", "MARGIN", "Existing margin threshold gate")],
      "Rerun after the margin figure and declared threshold are rechecked.",
    ));
  }
  if (contradictions.length || engine.termsIncomplete) {
    addAction(actions, action(
      "PAYMENT_NEGOTIATION",
      1,
      contradictions.length ? "CONTRADICTION" : "TERMS_UNKNOWN",
      contradictions.length
        ? contradictions.map((item) => trace("contradiction", item.id, item.label))
        : [trace("existing_rule", "COMMERCIAL_TERMS", "Commercial terms remain incomplete")],
      "Rerun after binding payment and delivery terms are confirmed in writing.",
    ));
  }
  if (opportunity.quoteComparabilityAssessed === false || engine.quoteBasesComparable === false) {
    addAction(actions, action(
      "QUOTE_NORMALIZATION",
      2,
      "QUOTE_COMPARABILITY",
      [trace("evidence", "QUOTES", "QUOTE_COMPARABILITY")],
      "Rerun after the submitted quotes share a confirmed comparison basis.",
    ));
  }
  if (unknowns.length) {
    addAction(actions, action(
      "SPECIFICATION_CONFIRMATION",
      2,
      "BLOCKING_UNKNOWN",
      unknowns.map((item) => trace("unknown", item.id, item.label)),
      "Rerun after the blocking UNKNOWN evidence is confirmed or explicitly accepted by the owner.",
    ));
  }
  if (engine.kycGate === "KYC_INCOMPLETE") {
    addAction(actions, action(
      "KYC_CREDIT_VERIFICATION",
      1,
      "KYC_INCOMPLETE",
      [trace("existing_gate", "KYC", "KYC gate is incomplete")],
      "Rerun after customer verification is complete.",
    ));
  }
  if (engine.weakEvidence || engine.strongEvidence === false) {
    addAction(actions, action(
      "SPECIFICATION_CONFIRMATION",
      2,
      "EVIDENCE_QUALITY",
      [trace("existing_rule", "EVIDENCE_QUALITY", "EVIDENCE_QUALITY")],
      "Rerun after primary evidence is obtained and its quality is reassessed.",
    ));
  }
  if (!engine.exposure.computed) {
    addAction(actions, action(
      "PAYMENT_NEGOTIATION",
      2,
      "PAYMENT_EXPOSURE_UNKNOWN",
      [trace("unknown", "PAYMENT_EXPOSURE", "Payment exposure is UNKNOWN because complete payment events are missing")],
      "Rerun after committed payment events include complete amount and timing evidence.",
    ));
  }
  if (decisionPathExperiment?.paths?.some((path) => path.comparison.decisionChanged)) {
    const changed = decisionPathExperiment.paths.filter((path) => path.comparison.decisionChanged).map((path) => path.id);
    addAction(actions, action(
      "NEGOTIATION_ESCALATION",
      3,
      "DECISION_PATH",
      [trace("decision_path", changed.join(","), "Decision Path identifies evidence changes that can alter the recommendation")],
      "Rerun after the owner obtains the selected Decision Path evidence proposition.",
    ));
  }

  return actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((item, index) => ({ ...item, priority: index + 1, evidenceTrace: clone(item.evidenceTrace) }));
}

function status(value, assessedLabel = "ASSESSED") {
  return value === true ? assessedLabel : value === false ? "NOT_COMPARABLE" : "NOT_ASSESSED";
}

export function buildCommercialStructure(opportunity, engine) {
  const paymentEvents = opportunity.paymentEvents || [];
  const completePayments = paymentEvents.filter((item) => item.status === "COMPLETE");
  return {
    terms: opportunity.commercialTerms?.status === "COMPLETE" ? "CONFIRMED" : "INCOMPLETE",
    termsDetail: opportunity.commercialTerms?.detail || "",
    quoteComparability: status(opportunity.quoteComparabilityAssessed === true && engine.quoteBasesComparable === true, "COMPARABLE"),
    quoteCount: (opportunity.quotes || []).length,
    paymentExposure: engine.exposure?.computed ? engine.exposure.totalCommittedCny : null,
    paymentEventStatus: engine.exposure?.computed ? `${completePayments.length}/${paymentEvents.length}` : "UNKNOWN",
    kyc: engine.kycGate,
    margin: engine.marginGate,
    buyerFit: opportunity.dimensions?.buyerFit?.value || "UNKNOWN",
    categoryFit: opportunity.dimensions?.categoryFit?.value || "UNKNOWN",
    evidenceQuality: opportunity.dimensions?.evidenceQuality?.value || "UNKNOWN",
    unknownCount: (opportunity.unknowns || []).length,
    contradictionCount: (opportunity.contradictions || []).filter((item) => item.status === "UNRESOLVED").length,
  };
}

export function buildCommercialViewModel(opportunity, engine, decisionPathExperiment = null) {
  return {
    structure: buildCommercialStructure(opportunity, engine),
    actions: derivePriorityActions(opportunity, engine, decisionPathExperiment),
  };
}
