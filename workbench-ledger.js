// workbench-ledger.js — Decision Ledger: decision-asset snapshot export.
// Reuses the canonical Deal Brief view model (buildDealBriefViewModel output)
// as the snapshot source. It does NOT recalculate, reinterpret, or re-evaluate
// anything — it serializes the brief as-is into one JSON snapshot per
// assessment, preserving UNKNOWN / NOT_RECORDED / human-decision separation /
// synthetic markers / evidence traceability.
//
// Ledger page (ledger.html) is static, local-file-only, read-only.
export const LEDGER_SCHEMA_VERSION = 1;

// --- snapshot shape ----------------------------------------------------------
// One JSON snapshot per assessment. Everything is presentational data lifted
// verbatim from the brief; nothing is inferred here.
export function serializeLedgerSnapshot(brief, extra = {}) {
  return {
    ledger: {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      kind: "decision-snapshot",
      exportedAt: new Date().toISOString(),
    },
    // brief.generatedAt is the assessment time; human decision + note are
    // kept in their own fields so the ledger never confuses them.
    generatedAt: brief.generatedAt,
    opportunityId: brief.opportunityId,
    opportunityName: brief.snapshot?.name ?? "UNKNOWN",
    synthetic: brief.synthetic === true,
    snapshot: brief.snapshot ?? {},
    position: brief.position ?? {},
    economics: brief.economics ?? {},
    trade: brief.trade ?? {},
    actions: brief.actions ?? [],
    decisionPath: brief.decisionPath ?? { available: false, current: null, paths: [] },
    authority: brief.authority ?? {},
    humanDecision: brief.humanDecision ?? "NOT_RECORDED",
    humanNote: brief.humanNote || "",
    boundary: brief.boundary ?? "",
    ...extra,
  };
}

// --- deterministic filename (collision-safe: date + opp id + time) ------------
export function ledgerFilename(brief, extension = "json") {
  const rawName = String(brief?.snapshot?.name || "untitled-opportunity")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60) || "untitled-opportunity";
  const oppId = String(brief?.opportunityId || "opp").replace(/[^\p{L}\p{N}_-]+/gu, "").slice(0, 20) || "opp";
  const date = String(brief?.generatedAt || "").slice(0, 10) || "undated";
  const time = String(brief?.generatedAt || "").slice(11, 19).replace(/:/g, "") || "000000";
  return `CDD-Decision-Ledger-${date}-${time}-${oppId}-${rawName}.${extension}`;
}

// --- download hook (mirrors downloadDealBrief) -------------------------------
export function downloadLedgerSnapshot(brief, extra = {}) {
  const snapshot = serializeLedgerSnapshot(brief, extra);
  const content = JSON.stringify(snapshot, null, 2);
  const filename = ledgerFilename(brief);
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { filename, content, snapshot };
}

// --- parse + validate a snapshot file (ledger page, read-only) ----------------
export function parseLedgerSnapshot(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "INVALID_JSON" };
  }
  if (data?.ledger?.kind !== "decision-snapshot") {
    return { ok: false, error: "NOT_A_LEDGER_SNAPSHOT" };
  }
  if (data.ledger.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    return { ok: false, error: "UNSUPPORTED_SCHEMA", schemaVersion: data.ledger.schemaVersion };
  }
  return { ok: true, data };
}

// --- read-only presentation helpers (never recalculate) -----------------------
export function ledgerHumanDecision(snapshot) {
  return snapshot.humanDecision || "NOT_RECORDED";
}
export function ledgerHumanNote(snapshot) {
  return snapshot.humanNote || "";
}
export function ledgerRecommendation(snapshot) {
  return snapshot.position?.recommendation || "UNKNOWN";
}
export function ledgerUnknowns(snapshot) {
  return snapshot.position?.unknowns || [];
}
export function ledgerBlockers(snapshot) {
  return snapshot.position?.blockers || [];
}
export function ledgerContradictions(snapshot) {
  return snapshot.position?.contradictions || [];
}
