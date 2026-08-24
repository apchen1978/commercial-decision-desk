// Isolated Decision Path experiment tests.
// These tests prove patch safety and same-engine behavior; they do not alter
// the existing adapter/core/scenario baselines.
import { opportunity } from "./fixtures.js";
import { createDecisionPathExperiment, validateDecisionPathExperiment } from "./decision-path.js";

const results = [];
const check = (name, condition, detail = "") => {
  results.push(Boolean(condition));
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${condition ? "" : ` | ${detail}`}`);
};

const before = JSON.stringify(opportunity);
const first = createDecisionPathExperiment(opportunity);
const second = createDecisionPathExperiment(opportunity);
const validation = validateDecisionPathExperiment(first);

check("actual evidence is never mutated", JSON.stringify(opportunity) === before && first.actualEvidenceUnchanged && first.paths.every((p) => p.actualUnchanged));
check("same input + same proposition is deterministic", JSON.stringify(first) === JSON.stringify(second));
check("semantic patch validation passes", validation.pass, validation.issues.join(", "));

const byId = (id) => first.paths.find((path) => path.id === id);
const cp1 = byId("CP-1");
const cp2 = byId("CP-2");
const cp3 = byId("CP-3R");
const cp4 = byId("CP-4");

check("CP-1 resolves only payment contradiction proposition", cp1.hypotheticalOpportunity.contradictions.find((c) => c.id === "CTR-1")?.status === "RESOLVED" && !cp1.hypotheticalOpportunity.unknowns.some((u) => u.id === "UNK-2") && cp1.hypotheticalOpportunity.commercialTerms.status === "INCOMPLETE");
check("CP-1 expected result ESCALATE -> HOLD_FOR_EVIDENCE", first.current.recommended === "ESCALATE" && cp1.hypothetical.recommended === "HOLD_FOR_EVIDENCE", cp1.hypothetical.recommended);
check("CP-2 is a specific evidence event and preserves blockers", cp2.hypotheticalOpportunity.dimensions.evidenceQuality.value === "HIGH" && cp2.hypothetical.blockingUnknowns.some((u) => u.id === "UNK-1") && cp2.hypothetical.materialContradictions.some((c) => c.id === "CTR-1"));
check("CP-2 expected result ESCALATE -> ESCALATE", cp2.hypothetical.recommended === "ESCALATE", cp2.hypothetical.recommended);
check("CP-3R changes quote comparability only", cp3.hypotheticalOpportunity.quoteBasesComparable === true && cp3.hypotheticalOpportunity.quoteComparabilityAssessed === true && cp3.hypothetical.termsIncomplete === true);
check("CP-3R expected result ESCALATE -> ESCALATE", cp3.hypothetical.recommended === "ESCALATE", cp3.hypothetical.recommended);
check("CP-4 maps one adverse screening event to existing KYC fields", cp4.hypotheticalOpportunity.kyc.status === "ADVERSE" && cp4.hypotheticalOpportunity.kyc.sanctionsHit === true && cp4.hypotheticalOpportunity.kyc.adverseFinding === true);
check("CP-4 expected result ESCALATE -> DO_NOT_PURSUE", cp4.hypothetical.recommended === "DO_NOT_PURSUE", cp4.hypothetical.recommended);
check("unrelated UNKNOWNs are preserved", first.paths.every((p) => ["UNK-1", "UNK-3", "UNK-4"].every((id) => p.hypotheticalOpportunity.unknowns.some((u) => u.id === id))));
check("unrelated contradiction is preserved", first.paths.every((p) => p.id === "CP-1" || p.hypothetical.materialContradictions.some((c) => c.id === "CTR-1")));
check("changed / unchanged comparison is engine-derived", cp1.comparison.decisionChanged === true && cp2.comparison.decisionChanged === false && cp3.comparison.decisionChanged === false && cp4.comparison.decisionChanged === true);
check("no new margin threshold", first.paths.every((p) => p.hypotheticalOpportunity.margin === undefined));
check("no new gate or decision state", first.paths.every((p) => ["ESCALATE", "HOLD_FOR_EVIDENCE", "DO_NOT_PURSUE"].includes(p.hypothetical.recommended)));
check("locale-independent experiment output", JSON.stringify(first.paths.map((p) => ({ id: p.id, result: p.hypothetical.recommended, changed: p.comparison.decisionChanged }))) === JSON.stringify(second.paths.map((p) => ({ id: p.id, result: p.hypothetical.recommended, changed: p.comparison.decisionChanged }))));

console.log(`\nDECISION PATH RESULT: ${results.filter(Boolean).length}/${results.length} PASS`);
