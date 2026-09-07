// boss-three.js — "三問速答" lead for the result view (SME-mode pivot, Batch 1).
// Presentation-only. Re-states EXISTING evidence in the three questions an SME
// owner actually asks first — 收款 (will we get paid), 完工 (can we finish /
// deliver on time), 投入 (should we commit resources now). No engine change,
// no new numbers, no invented capacity or payment guarantees: anything not
// recorded stays UNKNOWN, exactly as the engine/view models already say.
//
// This module returns locale-neutral tokens + counts. Localization happens in
// the render layer (app.js) via i18n keys, matching the other CDD slices.

const UNKNOWN_TERMS = new Set(["", "UNKNOWN", "notAssessed"]);

// --- Q1 收款: derived from recorded payment-term evidence --------------------
// status mirrors buildPaymentEvidenceView(): BINDING / CONFIRMED_NOT_BINDING /
// NOT_CONFIRMED / UNKNOWN. unresolvedCount is the number of evidence items a
// human has not yet confirmed or that remain MENTIONED/PROPOSED/etc.
export function bossCollect(paymentEvidenceView = {}) {
  const status = paymentEvidenceView.status || "UNKNOWN";
  const unresolved = Number.isFinite(paymentEvidenceView.unresolvedCount) ? paymentEvidenceView.unresolvedCount : 0;
  if (status === "BINDING") {
    return { tone: "ok", chipKey: "boss.q1.chip.binding", answerKey: "boss.q1.answer.binding", args: {} };
  }
  if (status === "CONFIRMED_NOT_BINDING") {
    return { tone: "warn", chipKey: "boss.q1.chip.confirmed", answerKey: "boss.q1.answer.confirmed", args: {} };
  }
  if (status === "NOT_CONFIRMED") {
    return { tone: "warn", chipKey: "boss.q1.chip.notConfirmed", answerKey: "boss.q1.answer.notConfirmed", args: { n: unresolved } };
  }
  return { tone: "unk", chipKey: "boss.q1.chip.unknown", answerKey: "boss.q1.answer.unknown", args: {} };
}

// --- Q2 完工: delivery term + recorded target timing; capacity stays honest ---
// CDD does not model factory capacity or production progress. It can only
// restate a declared Incoterm and any recorded target timing; completion
// status therefore remains UNKNOWN (presentation boundary — no inference).
export function bossFinish(delivery = {}, timing = "") {
  const declared = delivery.declaredTerm && !UNKNOWN_TERMS.has(String(delivery.declaredTerm));
  const hasTiming = Boolean(timing && String(timing).trim());
  if (declared && hasTiming) {
    return { tone: "warn", chipKey: "boss.q2.chip.declared", answerKey: "boss.q2.answer.declaredTiming", args: { term: String(delivery.declaredTerm), timing: String(timing) } };
  }
  if (declared) {
    return { tone: "warn", chipKey: "boss.q2.chip.declared", answerKey: "boss.q2.answer.declared", args: { term: String(delivery.declaredTerm) } };
  }
  if (hasTiming) {
    return { tone: "unk", chipKey: "boss.q2.chip.undeclared", answerKey: "boss.q2.answer.timingOnly", args: { timing: String(timing) } };
  }
  return { tone: "unk", chipKey: "boss.q2.chip.undeclared", answerKey: "boss.q2.answer.none", args: {} };
}

// --- Q3 投入: mirrors the engine recommendation in owner language ------------
// controls = number of unresolved control items (contradictions + blocking
// unknowns + incomplete terms + weak evidence) already computed by the view.
export function bossInvest(recommended = "HOLD_FOR_EVIDENCE", controls = 0) {
  const args = { controls };
  switch (recommended) {
    case "PURSUE_NOW":
      return { tone: "ok", chipKey: "boss.q3.chip.now", answerKey: "boss.q3.answer.now", args };
    case "PURSUE_CONDITIONALLY":
      return { tone: "warn", chipKey: "boss.q3.chip.cond", answerKey: "boss.q3.answer.cond", args };
    case "ESCALATE":
      return { tone: "warn", chipKey: "boss.q3.chip.esc", answerKey: "boss.q3.answer.esc", args };
    case "DO_NOT_PURSUE":
      return { tone: "drop", chipKey: "boss.q3.chip.drop", answerKey: "boss.q3.answer.drop", args };
    case "HOLD_FOR_EVIDENCE":
    default:
      return { tone: "unk", chipKey: "boss.q3.chip.hold", answerKey: "boss.q3.answer.hold", args };
  }
}

// --- Row assembly: single entry point for tests ---------------------------------
// economics bridge (buildEconomicsBridge output) optional; when CALCULATED the
// invest row gains a factual net-contribution-vs-minimum line (real numbers).
export function buildBossThree({ paymentEvidence, delivery, timing, recommended, controls, economics, currency = "CNY" }) {
  const rows = [
    { id: "q1", questionKey: "boss.q1.question", traceKey: "boss.trace.payment", ...bossCollect(paymentEvidence) },
    { id: "q2", questionKey: "boss.q2.question", traceKey: "boss.trace.delivery", ...bossFinish(delivery, timing) },
    { id: "q3", questionKey: "boss.q3.question", traceKey: "boss.trace.decision", ...bossInvest(recommended, controls) },
  ];
  const economicsLine = economics && economics.calculationStatus === "CALCULATED"
    ? { net: economics.expectedNetContribution, min: economics.minimumNetContribution, currency }
    : null;
  return { rows, economicsLine };
}
