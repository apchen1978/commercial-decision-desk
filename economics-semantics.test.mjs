import assert from "node:assert/strict";
import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildEconomicsBridge, economicsReading } from "./economics-bridge.js";

const bridge = (revenue, directCost, tradeCost = 0, dealSpecificCost = 0, contingency = 0) => buildEconomicsBridge({ revenue, directCost, tradeCost, dealSpecificCost, contingency });
const reading = (values) => economicsReading(bridge(...values));

assert.equal(reading([100, 20]), "POSITIVE");
assert.equal(reading([100, 100]), "BREAK_EVEN");
assert.equal(reading([100, 100.01]), "NEGATIVE");
assert.equal(reading([100, 500]), "NEGATIVE");
assert.equal(economicsReading(buildEconomicsBridge({ revenue: 100, directCost: 20 })), "UNKNOWN");

const base = evaluateDecision(opportunity);
for (const economics of [
  { revenue: 100, directCost: 20, tradeCost: 0, dealSpecificCost: 0, contingency: 0 },
  { revenue: 100, directCost: 100, tradeCost: 0, dealSpecificCost: 0, contingency: 0 },
  { revenue: 100, directCost: 500, tradeCost: 0, dealSpecificCost: 0, contingency: 0 },
  { revenue: 100, directCost: 20 },
]) {
  const candidate = structuredClone(opportunity);
  candidate.economics = economics;
  assert.equal(evaluateDecision(candidate).recommended, base.recommended);
}

const kycVeto = structuredClone(opportunity);
kycVeto.economics = { revenue: 100, directCost: 500, tradeCost: 0, dealSpecificCost: 0, contingency: 0 };
kycVeto.kyc = { status: "ADVERSE", beneficialOwnerVerified: true, sanctionsHit: true, adverseFinding: true };
assert.equal(evaluateDecision(kycVeto).recommended, "DO_NOT_PURSUE");

console.log("Economics Semantics v0.1: 10/10 PASS");
