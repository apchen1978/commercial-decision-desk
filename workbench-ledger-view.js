// workbench-ledger-view.js — read-only renderer for the Decision Ledger page.
// Static, local-file-only. It presents snapshot fields verbatim; it NEVER
// recalculates recommendations, re-runs the engine, or reinterprets decisions.
import { parseLedgerSnapshot } from "./workbench-ledger.js";

const $ = (id) => document.getElementById(id);

const STATE_LABELS = {
  PURSUE_NOW: "Pursue now",
  PURSUE_CONDITIONALLY: "Pursue with conditions",
  HOLD_FOR_EVIDENCE: "Hold for evidence",
  ESCALATE: "Escalate for review",
  DO_NOT_PURSUE: "Do not pursue",
  NOT_RECORDED: "尚未記錄（NOT_RECORDED）",
  UNKNOWN: "UNKNOWN",
};
const STATE_CLASS = {
  PURSUE_NOW: "now",
  PURSUE_CONDITIONALLY: "cond",
  HOLD_FOR_EVIDENCE: "hold",
  ESCALATE: "esc",
  DO_NOT_PURSUE: "drop",
  NOT_RECORDED: "unk",
};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderSnapshot(data) {
  const s = data;
  $("ledger-content").hidden = false;
  $("error-box").hidden = true;

  $("l-synthetic").textContent = s.synthetic === true ? "SYNTHETIC" : "MANUAL";
  $("l-name").textContent = s.opportunityName || "UNKNOWN";
  $("l-id").textContent = s.opportunityId || "";

  // snapshot kv — verbatim
  const snap = s.snapshot || {};
  const rows = [
    ["Market", snap.market],
    ["Buyer", snap.buyer],
    ["Product", snap.product],
    ["Quantity", snap.quantity],
    ["Revenue", snap.revenue ? `${snap.revenue}${snap.currency ? " " + snap.currency : ""}` : null],
    ["Timing", snap.timing],
    ["Relationship", snap.relationship],
    ["Source", snap.source],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");
  $("l-snapshot").innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");

  // decision vs human decision — SEPARATE, never merged
  const rec = s.position?.recommendation || "UNKNOWN";
  $("l-rec").innerHTML = `<span class="tag ${STATE_CLASS[rec] || "unk"}">${esc(STATE_LABELS[rec] || rec)}</span>`;
  const human = s.humanDecision || "NOT_RECORDED";
  $("l-human").innerHTML = `<span class="tag human ${STATE_CLASS[human] === "unk" ? "unk" : ""}">${esc(STATE_LABELS[human] || human)}</span>`;
  $("l-human-note").textContent = s.humanNote ? `備註：${s.humanNote}` : "（無備註）";

  // position — verbatim
  const reasons = s.position?.reasons || [];
  $("l-reasons").innerHTML = reasons.length ? reasons.map((r) => `<li>${esc(r)}</li>`).join("") : "<li>（無）</li>";
  const blockers = s.position?.blockers || [];
  $("l-blockers").innerHTML = blockers.length ? blockers.map((b) => `<li>${esc(b.kind)} — ${esc(b.label)}</li>`).join("") : "<li>無開放控制項目</li>";
  const unknowns = s.position?.unknowns || [];
  $("l-unknowns").innerHTML = unknowns.length ? unknowns.map((u) => `<li>${esc(u.label)} — ${esc(u.source)}</li>`).join("") : "<li>無 UNKNOWN</li>";
  const contradictions = s.position?.contradictions || [];
  $("l-contradictions").innerHTML = contradictions.length
    ? contradictions.map((c) => `<li>${esc(c.label)}${c.material ? " (material)" : ""} — ${esc(c.status)}</li>`).join("")
    : "<li>無矛盾</li>";

  // traceability + boundary
  const actionTraces = (s.actions || []).flatMap((a) => a.evidenceTrace || []).map((t) => t.label || t.sourceId || "?");
  const prepTraces = (s.trade?.negotiationPrep || []).flatMap((p) => p.evidenceTrace || []).map((t) => t.label || t.sourceId || "?");
  const allTraces = [...new Set([...actionTraces, ...prepTraces])];
  $("l-trace").textContent = allTraces.length
    ? "證據追溯：" + allTraces.join(" · ")
    : "（快照中無證據追溯條目）";
  $("l-boundary").textContent = s.boundary || "";
}

function showError(msg) {
  $("ledger-content").hidden = true;
  $("error-box").hidden = false;
  $("error-box").textContent = msg;
}

$("file-input").addEventListener("change", (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const result = parseLedgerSnapshot(String(reader.result));
    if (!result.ok) {
      showError(result.error === "INVALID_JSON" ? "無法解析：不是有效的 JSON 檔。" : result.error === "UNSUPPORTED_SCHEMA" ? `不支援的快照版本（schema v${result.schemaVersion}，本頁為 v1）。` : "不是 Decision Ledger 快照檔（缺少 ledger.kind = decision-snapshot）。");
      return;
    }
    renderSnapshot(result.data);
  };
  reader.onerror = () => showError("讀取檔案失敗。");
  reader.readAsText(file);
});
