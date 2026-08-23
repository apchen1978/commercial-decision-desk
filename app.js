// app.js — UI wiring for the Commercial Decision Desk prototype.
// Pure client-side rendering; no framework, no persistence, no network calls.
import { opportunity, dimensions, SYNTHETIC_LABEL } from "./fixtures.js";
import {
  DECISION_STATES,
  PAYMENT_DISCLOSURE,
  dedupePreserveOrder,
  paymentExposure,
  evaluateDecision,
  buildBrief,
} from "./decision-engine.js";

const $ = (id) => document.getElementById(id);

// --- synthetic banner ---
$("synthetic-banner").textContent = SYNTHETIC_LABEL;

// --- 01 opportunity ---
$("opp-card").innerHTML = `
  <h3>${opportunity.name} <span class="tag hi">${opportunity.id}</span></h3>
  <p class="muted">${opportunity.summary}</p>
  <p class="muted" style="margin-top:6px">Source: ${opportunity.source}</p>
`;

// --- Decision at a glance (compact; derived from the engine + fixture data) ---
function renderGlance() {
  const blockers = [];
  engine.materialContradictions.forEach((c) => blockers.push(`Material contradiction ${c.id} (${c.label}) — unresolved`));
  if (engine.termsIncomplete) blockers.push("Commercial terms incomplete");
  if (engine.blockingUnknowns.length > 0) blockers.push(`Blocking UNKNOWN: ${engine.blockingUnknowns.map((u) => `${u.id} ${u.label}`).join(", ")}`);
  if (engine.weakEvidence || engine.strongEvidence === false) blockers.push(engine.weakEvidence ? "Evidence Quality LOW" : "Evidence Quality not strong");

  const next = [];
  const pushUnique = (v) => { if (v) next.push(v); };
  engine.materialContradictions.forEach((c) => pushUnique(c.resolveWith));
  engine.blockingUnknowns.forEach((u) => pushUnique(u.resolveWith));
  if (engine.termsIncomplete && opportunity.commercialTerms.resolveWith) pushUnique(opportunity.commercialTerms.resolveWith);
  if (engine.weakEvidence) pushUnique("Upgrade evidence to PRIMARY sources (spec review / site visit)");
  const nextDeduped = dedupePreserveOrder(next);

  const tagClass = { ESCALATE: "esc", PURSUE_NOW: "now", PURSUE_CONDITIONALLY: "cond", HOLD_FOR_EVIDENCE: "hold", DO_NOT_PURSUE: "drop" }[engine.recommended] || "";
  $("glance-panel").innerHTML = `
    <div class="glance-rec">
      <span class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.08em">Recommended state</span>
      <span class="rec-tag ${tagClass}">${engine.recommended}</span>
      <span class="muted" style="font-size:12px">· deterministic rules, no score</span>
    </div>
    <hr class="glance-hr">
    <div class="glance-grid">
      <div class="glance-col"><h4>Top blockers</h4>${blockers.length ? `<ul>${blockers.map((b) => `<li>${b}</li>`).join("")}</ul>` : `<span class="muted">None — all gates are clear.</span>`}</div>
      <div class="glance-col"><h4>Next evidence needed</h4>${nextDeduped.length ? `<ul>${nextDeduped.map((n) => `<li>${n}</li>`).join("")}</ul>` : `<span class="muted">No further evidence required by the desk.</span>`}</div>
    </div>
    <p class="glance-note">The decision belongs to the human. The desk only narrows the options with evidence and deterministic rules.</p>
  `;
}

// --- 02 evidence ---
$("evidence-body").innerHTML = dimensions
  .map(
    (d) => `
    <div class="evidence-item">
      <b>${d.label}</b>
      <span class="tag ${oppValueClass(opportunity.dimensions[d.key].value)}">${opportunity.dimensions[d.key].value}</span>
      <div class="muted" style="margin-top:4px">${opportunity.dimensions[d.key].evidence.map((e) => `<div>· ${e.note} <span class="tier ${e.tier}">${e.tier}</span></div>`).join("")}</div>
    </div>`,
  )
  .join("");

$("contradiction-box").innerHTML =
  `<b>Material contradiction — surfaced.</b> ` +
  opportunity.contradictions.map((c) => `${c.label}: ${c.detail} (${c.status})`).join(" ") +
  ` — unresolved contradictions block PURSUE_NOW.`;

$("unknown-box").innerHTML =
  `<b>UNKNOWN — stays UNKNOWN.</b> ` +
  opportunity.unknowns.map((u) => `· ${u.label}: ${u.detail}`).join("<br>");

function oppValueClass(v) {
  if (["HIGH", "CONDITIONAL"].includes(v)) return v === "CONDITIONAL" ? "med" : "hi";
  if (["MEDIUM", "MED"].includes(v)) return "med";
  return "unk";
}

// --- 03 commercial ---
$("dims-table").innerHTML = dimensions
  .map(
    (d) => `<tr><th>${d.label}</th><td><span class="tag ${oppValueClass(opportunity.dimensions[d.key].value)}">${opportunity.dimensions[d.key].value}</span></td></tr>`,
  )
  .join("");
$("terms-line").textContent = `Commercial terms: ${opportunity.commercialTerms.status} — ${opportunity.commercialTerms.detail}`;
$("quotes-line").textContent = `Quote bases: ${opportunity.quotes.map((q) => `${q.id} (${q.basis})`).join(" · ")} — bases are ${opportunity.quoteBasesComparable ? "comparable" : "NOT comparable → NOT ranked (rule 4)"}.`;

// --- 04 payment exposure (toggle) ---
let exposureOn = false;
const exposure = () => paymentExposure(opportunity.paymentEvents);
function renderExposure() {
  const e = exposure();
  if (!exposureOn) {
    $("exposure-nums").innerHTML = `<div class="muted" style="margin-top:10px">Not included. Toggle to include this opportunity's committed payment events.</div>`;
  } else if (!e.computed) {
    $("exposure-nums").innerHTML = `<div class="unk-box" style="margin-top:10px">${e.reason}</div>`;
  } else {
    // Single-buyer concentration = this buyer's share of ALL committed payments.
    // Fixture has one buyer, so concentration is 100% of commitments.
    const concentration = opportunity.buyers && opportunity.buyers.length === 1 ? 100 : Math.round(Math.max(...e.byEvent.map((x) => x.share)) * 100);
    $("exposure-nums").innerHTML = `
      <div class="num-box"><div class="n">¥${e.totalCommittedCny.toLocaleString()}</div><div class="l">total committed (CNY, synthetic)</div></div>
      <div class="num-box"><div class="n">¥${e.peakWindowCny.toLocaleString()}</div><div class="l">peak ${e.windowDays}-day window</div></div>
      <div class="num-box"><div class="n">${concentration}%</div><div class="l">single-buyer concentration (commitments only)</div></div>
      <div class="num-box"><div class="n">${e.byEvent.length}</div><div class="l">complete events / ${e.incompleteCount} incomplete → UNKNOWN</div></div>
    `;
  }
}
$("pay-disclosure").textContent = opportunity.paymentDisclosure || PAYMENT_DISCLOSURE;
$("toggle-exposure").addEventListener("click", () => {
  exposureOn = !exposureOn;
  renderExposure();
});
renderExposure();

// --- 05 why grid ---
$("why-grid").innerHTML = `
  <div class="why-col ok"><h4>WHY</h4><ul>${opportunity.why.map((w) => `<li>${w}</li>`).join("")}</ul></div>
  <div class="why-col bad"><h4>WHY NOT</h4><ul>${opportunity.whyNot.map((w) => `<li>${w}</li>`).join("")}</ul></div>
`;

// --- 06 decision ---
let engine = evaluateDecision(opportunity);
let humanDecision = null;

function renderEngine() {
  engine = evaluateDecision(opportunity);
  renderGlance();
  $("engine-reasoning").innerHTML = `
    <div class="rec-box"><b>Desk recommendation: ${engine.recommended}</b><br>${engine.reasons.map((r) => `· ${r}`).join("<br>")}</div>
  `;
  const btns = $("state-buttons");
  btns.innerHTML = DECISION_STATES.map(
    (s) =>
      `<button type="button" data-state="${s}" class="${humanDecision === s ? "sel" : ""}" ${engine.available[s] ? "" : "disabled title='blocked by hard rule'"} title="${engine.available[s] ? "" : "not available under current hard rules"}">${s}</button>`,
  ).join("");
  btns.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      if (!engine.available[b.dataset.state]) return;
      humanDecision = b.dataset.state;
      renderEngine();
    }),
  );
}
renderEngine();

$("issue-brief").addEventListener("click", () => {
  if (!humanDecision) {
    $("brief-output").hidden = false;
    $("brief-output").textContent = "Select a human decision first. The desk never decides for you.";
    return;
  }
  const brief = buildBrief(opportunity, humanDecision, engine);
  $("brief-output").hidden = false;
  $("brief-output").textContent = [
    `DECISION BRIEF — ${brief.opportunityId} (synthetic fixture)`,
    `Generated: ${brief.generatedAt}`,
    `Opportunity: ${brief.opportunityName}`,
    `Human decision: ${brief.humanDecision}`,
    `Desk recommendation: ${brief.engineRecommended}`,
    "",
    "Reasons (deterministic rules):",
    ...brief.reasons.map((r) => `  - ${r}`),
    "",
    "Payment exposure:",
    brief.exposure.computed
      ? `  total committed ¥${brief.exposure.totalCommittedCny.toLocaleString()} · peak ${brief.exposure.windowDays}-day ¥${brief.exposure.peakWindowCny.toLocaleString()} · incomplete events: ${brief.exposure.incompleteCount} (UNKNOWN)`
      : `  UNKNOWN — ${brief.exposure.reason}`,
    "",
    "UNKNOWNs:",
    ...brief.unknowns.map((u) => `  - ${u.id} ${u.label}`),
    "Contradictions:",
    ...brief.contradictions.map((c) => `  - ${c.id} ${c.label} [${c.material ? "material" : "minor"}/${c.status}]`),
    "",
    brief.boundaryNote,
  ].join("\n");
});
