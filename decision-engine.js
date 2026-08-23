// decision-engine.js — pure, deterministic decision-support rules + payment math.
// No external calls. No persistence. The engine RECOMMENDS states; it never
// contacts, negotiates, quotes, commits, approves, or rejects anything.

export const DECISION_STATES = ["PURSUE_NOW", "PURSUE_CONDITIONALLY", "HOLD_FOR_EVIDENCE", "ESCALATE", "DO_NOT_PURSUE"];

export const PAYMENT_DISCLOSURE =
  "Payment exposure = committed payment events only. Not cash balance, liquidity, affordability, cash shortfall, or credit capacity. Concentration = payment commitments only.";

// ---------------------------------------------------------------------------
// Deterministic payment exposure — only from COMPLETE events (hard rule 5).
// ---------------------------------------------------------------------------
export function paymentExposure(events, opts = {}) {
  const windowDays = opts.windowDays ?? 7;
  const complete = (events || []).filter((e) => e.status === "COMPLETE" && Number.isFinite(e.amountCny) && Number.isFinite(e.daysFromSign));
  const incomplete = (events || []).filter((e) => e.status !== "COMPLETE" || !Number.isFinite(e.amountCny) || !Number.isFinite(e.daysFromSign));

  if (complete.length === 0) {
    return {
      computed: false,
      reason: "UNKNOWN — no complete payment-event inputs; exposure is NOT calculated.",
      incompleteCount: incomplete.length,
    };
  }

  const total = complete.reduce((a, e) => a + e.amountCny, 0);
  // Deterministic 7-day rolling peak across the event schedule (day 0..max).
  const maxDay = Math.max(...complete.map((e) => e.daysFromSign));
  let peak = 0;
  for (let d = 0; d <= maxDay; d++) {
    const window = complete.filter((e) => e.daysFromSign >= d && e.daysFromSign < d + windowDays);
    const sum = window.reduce((a, e) => a + e.amountCny, 0);
    if (sum > peak) peak = sum;
  }
  const byEvent = complete.map((e) => ({
    label: e.label,
    amountCny: e.amountCny,
    daysFromSign: e.daysFromSign,
    share: total > 0 ? e.amountCny / total : 0,
  }));
  return {
    computed: true,
    totalCommittedCny: total,
    peakWindowCny: peak,
    windowDays,
    byEvent,
    incompleteCount: incomplete.length,
    incompleteLabels: incomplete.map((e) => e.label),
  };
}

// ---------------------------------------------------------------------------
// Decision rules — deterministic guards; no opaque overall score is produced.
// ---------------------------------------------------------------------------
export function evaluateDecision(opp) {
  const d = opp.dimensions;
  const categoryFit = String(d.categoryFit.value || "").toUpperCase();
  const materialContradictions = (opp.contradictions || []).filter((c) => c.material && c.status === "UNRESOLVED");
  const quoteBasesComparable = Boolean(opp.quoteBasesComparable);
  const termsIncomplete = (opp.commercialTerms && opp.commercialTerms.status === "INCOMPLETE") || false;

  const reasons = [];

  // Hard rule 1 — weak/irrelevant Category Fit can never produce PURSUE_NOW.
  const categoryWeak = ["WEAK", "LOW", "IRRELEVANT", "NONE"].includes(categoryFit);
  if (categoryWeak) {
    reasons.push("Rule 1: Weak/irrelevant Category Fit — PURSUE_NOW is not available.");
  }

  // Hard rule 2 — material contradiction must surface and may require ESCALATE.
  if (materialContradictions.length > 0) {
    reasons.push(
      `Rule 2: Material contradiction (${materialContradictions.map((c) => c.id).join(", ")}) is unresolved — it is surfaced visibly; PURSUE_NOW is not available; ESCALATE is recommended.`,
    );
  }

  // Hard rule 3 — missing commercial terms remain UNKNOWN → HOLD_FOR_EVIDENCE candidate.
  if (termsIncomplete) {
    reasons.push("Rule 3: Commercial terms are incomplete — missing items remain UNKNOWN; HOLD_FOR_EVIDENCE is available.");
  }

  // Hard rule 4 — non-comparable quote bases must NOT be ranked.
  if (!quoteBasesComparable) {
    reasons.push("Rule 4: Quote bases are not comparable — quotes are NOT ranked.");
  }

  // Hard rule 5 — exposure only from complete payment-event inputs.
  const exposure = paymentExposure(opp.paymentEvents);
  if (!exposure.computed) {
    reasons.push("Rule 5: Payment exposure is UNKNOWN — no complete payment-event inputs.");
  }

  // Deterministic recommendation (pure decision-support state).
  let recommended = "HOLD_FOR_EVIDENCE";
  if (categoryWeak) {
    recommended = "DO_NOT_PURSUE";
  } else if (materialContradictions.length > 0) {
    recommended = "ESCALATE"; // rule 2
  } else if (termsIncomplete) {
    recommended = "HOLD_FOR_EVIDENCE"; // rule 3
  } else if (!exposure.computed) {
    recommended = "HOLD_FOR_EVIDENCE"; // rule 5
  } else {
    recommended = "PURSUE_CONDITIONALLY";
  }

  // State availability under the hard rules (what the human may select).
  const available = {
    PURSUE_NOW: !categoryWeak && materialContradictions.length === 0 && !termsIncomplete && exposure.computed,
    PURSUE_CONDITIONALLY: !categoryWeak,
    HOLD_FOR_EVIDENCE: true,
    ESCALATE: materialContradictions.length > 0 || true,
    DO_NOT_PURSUE: true,
  };

  return { recommended, available, reasons, categoryWeak, materialContradictions, termsIncomplete, quoteBasesComparable, exposure };
}

// ---------------------------------------------------------------------------
// Decision brief — assembled locally, never persisted.
// ---------------------------------------------------------------------------
export function buildBrief(opp, humanDecision, engine) {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    opportunityId: opp.id,
    opportunityName: opp.name,
    humanDecision,
    engineRecommended: engine.recommended,
    reasons: engine.reasons,
    exposure: engine.exposure,
    unknowns: opp.unknowns.map((u) => ({ id: u.id, label: u.label })),
    contradictions: opp.contradictions.map((c) => ({ id: c.id, label: c.label, material: c.material, status: c.status })),
    boundaryNote: "This brief supports a human decision. It does not approve, reject, quote, or commit. Human approval is always required before any external action.",
    synthetic: opp.id === "OPP-2026-008", // fixture provenance marker
  };
}
