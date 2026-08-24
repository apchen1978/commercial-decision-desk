import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { createDecisionPathExperiment } from "./decision-path.js";
import { buildCommercialViewModel, derivePriorityActions } from "./commercial-action-layer.js";

const results = [];
const check = (name, condition, detail = "") => {
  results.push(Boolean(condition));
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${condition ? "" : ` | ${detail}`}`);
};

const engine = evaluateDecision(opportunity);
const path = createDecisionPathExperiment(opportunity);
const view = buildCommercialViewModel(opportunity, engine, path);

check("structure uses existing payment exposure", view.structure.paymentExposure === 3600000);
check("structure preserves incomplete terms", view.structure.terms === "INCOMPLETE");
check("structure preserves non-comparable quotes", view.structure.quoteComparability === "NOT_COMPARABLE");
check("actions are bounded to 1-3", view.actions.length >= 1 && view.actions.length <= 3);
check("sample actions are context-relevant", view.actions.every((item) => ["PAYMENT_NEGOTIATION", "QUOTE_NORMALIZATION", "SPECIFICATION_CONFIRMATION", "KYC_CREDIT_VERIFICATION", "MARGIN_PROTECTION", "NEGOTIATION_ESCALATION"].includes(item.actionType)));
check("every action has trace and rerun condition", view.actions.every((item) => item.evidenceTrace.length > 0 && item.rerunWhen));
check("Decision Path can trigger a traced action", view.actions.some((item) => item.trigger === "CONTRADICTION" || item.trigger === "DECISION_PATH"));

const clearOpportunity = {
  ...opportunity,
  contradictions: [],
  unknowns: [],
  commercialTerms: { status: "COMPLETE", detail: "Confirmed" },
  quoteBasesComparable: true,
  quoteComparabilityAssessed: true,
  paymentEvents: [{ id: "PE-1", label: "Deposit", amountCny: 100, daysFromSign: 0, status: "COMPLETE" }],
  dimensions: { ...opportunity.dimensions, evidenceQuality: { value: "HIGH", evidence: [] }, buyerFit: { value: "HIGH", evidence: [] } },
};
const clearEngine = evaluateDecision(clearOpportunity);
check("no evidence trigger produces no action", derivePriorityActions(clearOpportunity, clearEngine, null).length === 0);

console.log(`\nCOMMERCIAL ACTION LAYER RESULT: ${results.filter(Boolean).length}/${results.length} PASS`);
process.exitCode = results.every(Boolean) ? 0 : 1;
