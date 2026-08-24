import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { opportunity } from "./fixtures.js";
import { buildEconomicsBridge } from "./economics-bridge.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildCommercialMomentum, buildEvidenceCoverage, momentumPresentationBand } from "./commercial-momentum.js";

function completeEconomics(net = 100) {
  return buildEconomicsBridge({ revenue: 1000, directCost: 500, tradeCost: 100, dealSpecificCost: 100, contingency: 100 + (200 - net) });
}
function check(name, fn) { fn(); console.log(`PASS ${name}`); }

check("A high Momentum can coexist with low Coverage", () => {
  const op = structuredClone(opportunity);
  op.dimensions.importOpenness.value = "UNKNOWN";
  op.dimensions.commercialFeasibility.value = "UNKNOWN";
  const momentum = buildCommercialMomentum(op, buildEconomicsBridge({}));
  const coverage = buildEvidenceCoverage(op, buildEconomicsBridge({}));
  assert.equal(momentum.score, 100);
  assert.ok(coverage.score < 60);
});

check("B low Momentum can coexist with high Coverage", () => {
  const op = structuredClone(opportunity);
  op.dimensions.buyerFit.value = "LOW";
  op.dimensions.categoryFit.value = "LOW";
  op.dimensions.importOpenness.value = "LOW";
  op.dimensions.commercialFeasibility.value = "LOW";
  op.commercialTerms = { status: "COMPLETE" };
  op.paymentEvents = [{ status: "COMPLETE", label: "Deposit", amountCny: 1, daysFromSign: 0 }];
  op.quoteComparabilityAssessed = true;
  op.kyc = { status: "CLEAR" };
  op.commercialContext = { purchasingAuthority: "yes", technicalAuthority: "yes", finalApprover: "yes", accessDecisionMaker: "yes" };
  const bridge = completeEconomics(-10);
  assert.ok(buildCommercialMomentum(op, bridge).score <= 25);
  assert.ok(buildEvidenceCoverage(op, bridge).score >= 95);
});

check("C high Momentum and high Coverage do not clear a hard veto", () => {
  const op = structuredClone(opportunity);
  op.dimensions.commercialFeasibility.value = "HIGH";
  op.commercialTerms = { status: "COMPLETE" };
  op.paymentEvents = [{ status: "COMPLETE", label: "Deposit", amountCny: 1, daysFromSign: 0 }];
  op.quoteComparabilityAssessed = true;
  op.kyc = { status: "ADVERSE", sanctionsHit: true };
  op.commercialContext = { purchasingAuthority: "yes", technicalAuthority: "yes", finalApprover: "yes", accessDecisionMaker: "yes" };
  assert.ok(buildCommercialMomentum(op, completeEconomics(200)).score >= 90);
  assert.ok(buildEvidenceCoverage(op, completeEconomics(200)).score >= 95);
  assert.equal(evaluateDecision(op).recommended, "DO_NOT_PURSUE");
});

check("D many UNKNOWNs do not become negative evidence", () => {
  const op = structuredClone(opportunity);
  op.dimensions = { buyerFit: { value: "HIGH" }, categoryFit: { value: "UNKNOWN" }, importOpenness: { value: "UNKNOWN" }, commercialFeasibility: { value: "UNKNOWN" } };
  const result = buildCommercialMomentum(op, buildEconomicsBridge({}));
  assert.equal(result.score, null);
  assert.equal(result.status, "NOT_ENOUGH_KNOWN_SIGNALS");
  assert.equal(buildEvidenceCoverage(op, buildEconomicsBridge({})).score < 50, true);
});

check("E known negative commercial evidence lowers Momentum", () => {
  const high = structuredClone(opportunity);
  high.dimensions.commercialFeasibility.value = "HIGH";
  const low = structuredClone(high);
  low.dimensions.commercialFeasibility.value = "LOW";
  assert.ok(buildCommercialMomentum(low, buildEconomicsBridge({})).score < buildCommercialMomentum(high, buildEconomicsBridge({})).score);
});

check("F same evidence produces the same score and trace", () => {
  const a = buildCommercialMomentum(opportunity, buildEconomicsBridge({}));
  const b = buildCommercialMomentum(opportunity, buildEconomicsBridge({}));
  assert.deepEqual(a, b);
});

check("G sample score is model-generated and remains compatible with ESCALATE", () => {
  const momentum = buildCommercialMomentum(opportunity, buildEconomicsBridge({}));
  assert.equal(momentum.score, 92);
  assert.equal(momentumPresentationBand(momentum.score), "STRONG");
  assert.equal(evaluateDecision(opportunity).recommended, "ESCALATE");
});

check("presentation bands do not alter the frozen model", () => {
  assert.equal(momentumPresentationBand(null), "NOT_ASSESSED");
  assert.equal(momentumPresentationBand(79), "DEVELOPING");
  assert.equal(momentumPresentationBand(49), "LIMITED");
});

check("H a known signal change has a bounded, traceable score movement", () => {
  const conditional = structuredClone(opportunity);
  conditional.dimensions.commercialFeasibility.value = "CONDITIONAL";
  const high = structuredClone(conditional);
  high.dimensions.commercialFeasibility.value = "HIGH";
  const before = buildCommercialMomentum(conditional, buildEconomicsBridge({}));
  const after = buildCommercialMomentum(high, buildEconomicsBridge({}));
  assert.equal(after.score - before.score, 8);
  assert.equal(after.drivers.find((driver) => driver.id === "commercialFeasibility").evidenceTrace, "dimensions.commercialFeasibility");
});

const source = await readFile(new URL("./commercial-momentum.js", import.meta.url), "utf8");
assert.doesNotMatch(source, /from\s+["']\.\/decision-engine\.js["']/);
console.log("PASS model stays separate from the frozen Decision Core");

console.log("COMMERCIAL MOMENTUM RESULT: 10/10 PASS");
