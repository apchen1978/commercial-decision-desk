// Payment Evidence v0.1 — local, presentation-only evidence representation.
// It does not evaluate decisions, calculate exposure, or alter engine gates.
export const PAYMENT_EVIDENCE_STATES = Object.freeze(["UNKNOWN", "MENTIONED", "PROPOSED", "NEGOTIATED", "CONFIRMED", "BINDING"]);
export const PAYMENT_HUMAN_STATUSES = Object.freeze(["PENDING_REVIEW", "CONFIRMED_BY_OWNER"]);
const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;

export function normalizePaymentEvidence(items = []) {
  return (Array.isArray(items) ? items : []).filter((item) => item && (item.label || item.source || item.fragment)).map((item, index) => ({
    id: item.id || `PEV-${index + 1}`,
    label: String(item.label || "Payment terms"),
    state: allowed(item.state, PAYMENT_EVIDENCE_STATES, "UNKNOWN"),
    source: String(item.source || ""), fragment: String(item.fragment || ""), asOf: String(item.asOf || ""),
    humanStatus: allowed(item.humanStatus, PAYMENT_HUMAN_STATUSES, "PENDING_REVIEW"),
  }));
}

export function buildPaymentEvidenceView(opportunity) {
  const items = normalizePaymentEvidence(opportunity?.commercialTerms?.paymentEvidence);
  const binding = items.filter((item) => item.state === "BINDING" && item.humanStatus === "CONFIRMED_BY_OWNER");
  const confirmed = items.filter((item) => item.state === "CONFIRMED" && item.humanStatus === "CONFIRMED_BY_OWNER");
  const unresolved = items.filter((item) => item.humanStatus !== "CONFIRMED_BY_OWNER" || ["UNKNOWN", "MENTIONED", "PROPOSED", "NEGOTIATED"].includes(item.state));
  return { items, status: !items.length ? "UNKNOWN" : binding.length ? "BINDING" : confirmed.length ? "CONFIRMED_NOT_BINDING" : "NOT_CONFIRMED", unresolvedCount: unresolved.length, trace: items.map((item) => ({ sourceType: "payment_evidence", sourceId: item.id, label: item.label })) };
}
