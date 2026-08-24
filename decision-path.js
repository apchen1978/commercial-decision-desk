// Isolated Decision Path experiment for OPP-2026-008.
// This module is not a second decision engine: every current and hypothetical
// result is produced by the existing evaluateDecision() function.

import { evaluateDecision } from "./decision-engine.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const proposition = (id, manifest, apply) => ({ id, manifest, apply });

export const DECISION_PATH_PROPOSITIONS = [
  proposition("CP-1", {
    proposition: "Authoritative written payment terms received.",
    sourceRequirement: "Buyer-issued binding payment terms or written confirmation from an authorized commercial contact.",
    fieldsAffected: ["contradictions[CTR-1].status", "unknowns[UNK-2]", "commercialTerms.detail"],
    unknownsResolved: ["UNK-2"],
    unknownsPreserved: ["UNK-1", "UNK-3"],
    contradictionsResolved: ["CTR-1"],
    contradictionsPreserved: [],
    unchanged: ["commercialTerms.status", "paymentEvents", "quoteBasesComparable", "evidenceQuality", "kyc", "margin"],
    semanticNote: "Payment terms are confirmed, but delivery and remaining commercial terms stay incomplete.",
  }, (opp) => {
    const patched = clone(opp);
    patched.contradictions = patched.contradictions.map((c) => c.id === "CTR-1" ? { ...c, status: "RESOLVED" } : c);
    patched.unknowns = patched.unknowns.filter((u) => u.id !== "UNK-2");
    patched.commercialTerms = {
      ...patched.commercialTerms,
      detail: "Payment terms are confirmed in writing; delivery and remaining commercial terms remain incomplete.",
    };
    return patched;
  }),
  proposition("CP-2", {
    proposition: "Authoritative product specification evidence received.",
    sourceRequirement: "Buyer-issued specification confirmation covering the product and supply scope, without payment, volume, or authority confirmation.",
    fieldsAffected: ["dimensions.evidenceQuality.value", "dimensions.evidenceQuality.evidence"],
    unknownsResolved: [],
    unknownsPreserved: ["UNK-1", "UNK-2", "UNK-3"],
    contradictionsResolved: [],
    contradictionsPreserved: ["CTR-1"],
    unchanged: ["commercialTerms", "paymentEvents", "quoteBasesComparable", "kyc", "margin"],
    semanticNote: "Evidence quality improves for the defined product scope; unrelated blockers remain unchanged.",
  }, (opp) => {
    const patched = clone(opp);
    patched.dimensions.evidenceQuality = {
      ...patched.dimensions.evidenceQuality,
      value: "HIGH",
      evidence: [
        ...(patched.dimensions.evidenceQuality.evidence || []),
        { tier: "PRIMARY", note: "Authoritative buyer confirmation of product specification and supply scope (hypothetical)." },
      ],
    };
    return patched;
  }),
  proposition("CP-3R", {
    proposition: "Common quote comparison basis formally confirmed.",
    sourceRequirement: "Buyer-provided comparison basis or owner-confirmed scope normalization covering the submitted quotes.",
    fieldsAffected: ["quoteBasesComparable", "quoteComparabilityAssessed"],
    unknownsResolved: [],
    unknownsPreserved: ["UNK-1", "UNK-2", "UNK-3"],
    contradictionsResolved: [],
    contradictionsPreserved: ["CTR-1"],
    unchanged: ["commercialTerms", "paymentEvents", "evidenceQuality", "kyc", "margin"],
    semanticNote: "Quote comparison disclosure is cleared; this does not complete payment or other commercial terms.",
  }, (opp) => {
    const patched = clone(opp);
    patched.quoteBasesComparable = true;
    patched.quoteComparabilityAssessed = true;
    return patched;
  }),
  proposition("CP-4", {
    proposition: "Verified sanctions screening returned an adverse match.",
    sourceRequirement: "Traceable sanctions screening result with a verified adverse match.",
    fieldsAffected: ["kyc.status", "kyc.sanctionsHit", "kyc.adverseFinding"],
    unknownsResolved: [],
    unknownsPreserved: ["UNK-1", "UNK-2", "UNK-3"],
    contradictionsResolved: [],
    contradictionsPreserved: ["CTR-1"],
    unchanged: ["commercialTerms", "paymentEvents", "quoteBasesComparable", "evidenceQuality", "margin"],
    semanticNote: "One verified screening event is represented by the existing KYC fields; no other evidence is inferred.",
  }, (opp) => {
    const patched = clone(opp);
    patched.kyc = { status: "ADVERSE", sanctionsHit: true, adverseFinding: true };
    return patched;
  }),
];

function ids(items) {
  return (items || []).map((item) => item.id).filter(Boolean);
}

function compareResults(current, hypothetical) {
  const changed = [];
  const unchanged = [];
  if (current.recommended !== hypothetical.recommended) {
    changed.push({ type: "recommendation", from: current.recommended, to: hypothetical.recommended });
  } else {
    unchanged.push({ type: "recommendation", value: current.recommended });
  }
  if (JSON.stringify(ids(current.materialContradictions)) !== JSON.stringify(ids(hypothetical.materialContradictions))) {
    changed.push({ type: "materialContradictions", from: ids(current.materialContradictions), to: ids(hypothetical.materialContradictions) });
  } else {
    unchanged.push({ type: "materialContradictions", value: ids(current.materialContradictions) });
  }
  if (JSON.stringify(ids(current.blockingUnknowns)) !== JSON.stringify(ids(hypothetical.blockingUnknowns))) {
    changed.push({ type: "blockingUnknowns", from: ids(current.blockingUnknowns), to: ids(hypothetical.blockingUnknowns) });
  } else {
    unchanged.push({ type: "blockingUnknowns", value: ids(current.blockingUnknowns) });
  }
  if (current.termsIncomplete !== hypothetical.termsIncomplete) {
    changed.push({ type: "termsIncomplete", from: current.termsIncomplete, to: hypothetical.termsIncomplete });
  } else {
    unchanged.push({ type: "termsIncomplete", value: current.termsIncomplete });
  }
  if (current.kycGate !== hypothetical.kycGate) {
    changed.push({ type: "kycGate", from: current.kycGate, to: hypothetical.kycGate });
  } else {
    unchanged.push({ type: "kycGate", value: current.kycGate });
  }
  if (current.marginGate !== hypothetical.marginGate) {
    changed.push({ type: "marginGate", from: current.marginGate, to: hypothetical.marginGate });
  } else {
    unchanged.push({ type: "marginGate", value: current.marginGate });
  }
  if (current.quoteBasesComparable !== hypothetical.quoteBasesComparable) {
    changed.push({ type: "quoteBasesComparable", from: current.quoteBasesComparable, to: hypothetical.quoteBasesComparable });
  } else {
    unchanged.push({ type: "quoteBasesComparable", value: current.quoteBasesComparable });
  }
  return {
    decisionChanged: current.recommended !== hypothetical.recommended,
    changed,
    unchanged,
  };
}

function stillBlocks(result) {
  return [
    ...(result.kycGate === "SANCTIONS_VETO" ? [{ type: "kycVeto", id: "KYC_VETO", label: "An adverse customer-verification finding is a hard veto" }] : []),
    ...result.materialContradictions.map((c) => ({ type: "contradiction", id: c.id, label: c.label })),
    ...result.blockingUnknowns.map((u) => ({ type: "unknown", id: u.id, label: u.label })),
    ...(result.termsIncomplete ? [{ type: "terms", id: "COMMERCIAL_TERMS", label: "Commercial terms remain incomplete" }] : []),
    ...(result.kycGate === "KYC_INCOMPLETE" ? [{ type: "kyc", id: "KYC", label: "Customer verification remains incomplete" }] : []),
    ...(result.marginGate === "BELOW_THRESHOLD" ? [{ type: "margin", id: "MARGIN", label: "Margin is below the declared threshold" }] : []),
    ...(!result.exposure.computed ? [{ type: "payment", id: "PAYMENT_EXPOSURE", label: "Payment evidence remains incomplete" }] : []),
  ];
}

export function createDecisionPathExperiment(opportunity) {
  const actualBefore = clone(opportunity);
  const current = evaluateDecision(actualBefore);
  const paths = DECISION_PATH_PROPOSITIONS.map((definition) => {
    const hypotheticalOpportunity = definition.apply(actualBefore);
    const hypothetical = evaluateDecision(hypotheticalOpportunity);
    const actualUnchanged = sameJson(actualBefore, opportunity);
    return {
      id: definition.id,
      manifest: clone(definition.manifest),
      current,
      hypothetical,
      hypotheticalOpportunity,
      comparison: compareResults(current, hypothetical),
      stillBlocks: stillBlocks(hypothetical),
      actualUnchanged,
      humanBoundary: "The owner decides whether to obtain the evidence, act on it, or stop. The hypothetical result is not an approval or rejection.",
    };
  });
  return { opportunity: actualBefore, current, paths, actualEvidenceUnchanged: sameJson(actualBefore, opportunity) };
}

export function validateDecisionPathExperiment(experiment) {
  const issues = [];
  if (!experiment.actualEvidenceUnchanged) issues.push("actual opportunity changed");
  for (const path of experiment.paths) {
    if (!path.actualUnchanged) issues.push(`${path.id}: actual opportunity changed after hypothetical run`);
    if (!path.manifest.proposition || !path.manifest.sourceRequirement) issues.push(`${path.id}: incomplete evidence manifest`);
    if (!path.hypothetical || !path.hypothetical.recommended) issues.push(`${path.id}: missing same-engine result`);
  }
  return { pass: issues.length === 0, issues };
}
