// Acceptance / remedy presentation slice v0.1.
// Derived only from explicit owner-entered evidence in existing fields.
// It is not a lifecycle state, legal interpretation, gate, score, or persistence model.

const MARKERS = Object.freeze([
  { marker: "ACCEPTANCE_EVIDENCE", condition: "buyer acceptance evidenced", action: "Confirm the acceptance record and any remaining exceptions." },
  { marker: "REJECTION_EVIDENCE", condition: "buyer rejection evidenced", action: "Obtain the rejection scope and owner decision on the next commercial response." },
  { marker: "CORRECTIVE_ACTION_PENDING", condition: "corrective action / replacement pending", action: "Confirm the corrective-action owner, due date, and completion evidence." },
  { marker: "REMEDY_EVIDENCE_PENDING", condition: "remedy evidence pending", action: "Obtain the written remedy agreement or completion evidence." },
  { marker: "REMEDY_DEADLINE", condition: "remedy deadline requires Owner attention", action: "Review the explicit remedy deadline and decide the next escalation or renegotiation step." },
  { marker: "TERMINATION_EVIDENCE", condition: "explicit termination evidence", action: "Owner reviews the explicit termination record before stopping further commitment." },
]);

const trace = (sourceId, label) => ({ sourceType: "evidence", sourceId, label });

function markerLine(detail, marker) {
  const pattern = new RegExp(`(?:^|\\n)\\s*${marker.marker}\\s*:\\s*([^\\n]+)`, "i");
  const match = String(detail || "").match(pattern);
  if (!match) return null;
  const text = match[1].trim();
  if (!text) return null;
  if (marker.marker === "REMEDY_DEADLINE" && !/\b20\d{2}-\d{2}-\d{2}\b/.test(text)) return null;
  return text;
}

export function buildAcceptanceRemedyPresentation(opportunity = {}) {
  const termsDetail = opportunity.commercialTerms?.detail || "";
  const items = [];
  for (const marker of MARKERS) {
    const evidence = markerLine(termsDetail, marker);
    if (evidence) {
      items.push({
        condition: marker.condition,
        evidence,
        action: marker.action,
        evidenceTrace: [trace(`ACCEPTANCE_REMEDY_${marker.marker}`, evidence)],
        rerunWhen: "Rerun after the explicit acceptance/remedy evidence or Owner decision is recorded.",
        boundary: "Presentation evidence only; it does not establish legal defect, waiver, liability, expiry, or automatic termination.",
      });
    }
  }

  const unknown = (opportunity.unknowns || []).find((item) => /acceptance|remedy/i.test(`${item.label || ""} ${item.detail || ""}`));
  if (!items.length && unknown) {
    items.push({
      condition: "acceptance/remedy status UNKNOWN",
      evidence: unknown.detail || unknown.label,
      action: "Obtain explicit acceptance, rejection, remedy, or termination evidence; do not infer status from silence.",
      evidenceTrace: [{ sourceType: "unknown", sourceId: unknown.id || "ACCEPTANCE_REMEDY_UNKNOWN", label: unknown.label || "Acceptance/remedy status UNKNOWN" }],
      rerunWhen: "Rerun after explicit acceptance/remedy evidence is recorded or the Owner confirms the UNKNOWN boundary.",
      boundary: "UNKNOWN is not negative and does not imply rejection or termination.",
    });
  }
  return { items, hasExplicitEvidence: items.some((item) => item.evidenceTrace[0]?.sourceType === "evidence") };
}
