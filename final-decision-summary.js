// Presentation-only state for the Human Decision summary.
// This deliberately does not create a new decision state or persist anything.
export function buildFinalDecisionSummaryState({ humanDecision = null, humanNote = "", nextAction = null } = {}) {
  if (!humanDecision) return { active: false, decision: null, note: "", nextAction: null };
  return {
    active: true,
    decision: humanDecision,
    note: String(humanNote || ""),
    nextAction: nextAction || null,
  };
}
