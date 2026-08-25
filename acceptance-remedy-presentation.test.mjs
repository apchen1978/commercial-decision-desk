import assert from "node:assert/strict";
import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildAcceptanceRemedyPresentation } from "./acceptance-remedy-presentation.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";

const make = (detail, unknowns = []) => ({
  ...structuredClone(opportunity),
  commercialTerms: { ...opportunity.commercialTerms, detail },
  unknowns,
});

const cases = [
  ["explicit acceptance", "ACCEPTANCE_EVIDENCE: buyer acceptance confirmed in signed email", "buyer acceptance evidenced"],
  ["explicit rejection", "REJECTION_EVIDENCE: buyer rejection notice dated 2026-08-25", "buyer rejection evidenced"],
  ["corrective action pending", "CORRECTIVE_ACTION_PENDING: replacement batch due 2026-09-01", "corrective action / replacement pending"],
  ["remedy evidence pending", "REMEDY_EVIDENCE_PENDING: written remedy agreement not yet received", "remedy evidence pending"],
  ["remedy deadline", "REMEDY_DEADLINE: 2026-09-15 written deadline", "remedy deadline requires Owner attention"],
  ["explicit termination", "TERMINATION_EVIDENCE: signed cancellation received", "explicit termination evidence"],
];

for (const [name, detail, condition] of cases) {
  const op = make(detail);
  const presentation = buildAcceptanceRemedyPresentation(op);
  assert.equal(presentation.items.length, 1, name);
  assert.equal(presentation.items[0].condition, condition, name);
  assert.equal(presentation.items[0].evidenceTrace[0].sourceType, "evidence", name);
  const before = evaluateDecision(op);
  const after = evaluateDecision(op);
  assert.equal(after.recommended, before.recommended, `${name}: Decision Core changed`);
  assert.deepEqual(after.reasons, before.reasons, `${name}: Decision Core reasons changed`);
  console.log(`PASS ${name}`);
}

const unknownOp = make("", [{ id: "U-AR", label: "Acceptance status", detail: "Buyer acceptance is not recorded", blocks: true }]);
const unknownPresentation = buildAcceptanceRemedyPresentation(unknownOp);
assert.equal(unknownPresentation.items[0].condition, "acceptance/remedy status UNKNOWN");
assert.equal(unknownPresentation.items[0].evidenceTrace[0].sourceType, "unknown");
console.log("PASS UNKNOWN acceptance/remedy status");

const ambiguous = make("Buyer may reject if the goods are not suitable; remedy could be discussed.");
assert.equal(buildAcceptanceRemedyPresentation(ambiguous).items.length, 0);
console.log("PASS ambiguous narrative creates no condition");

const prep = buildTradeDealViewModel(make("REMEDY_DEADLINE: 2026-09-15 written deadline"), evaluateDecision(opportunity));
assert.ok(prep.negotiationPrep.some((item) => item.type === "ACCEPTANCE_REMEDY"));
console.log("PASS acceptance/remedy control reaches Negotiation Prep");

console.log(`\nACCEPTANCE / REMEDY PRESENTATION RESULT: ${cases.length + 3}/${cases.length + 3} PASS`);
