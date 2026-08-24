// app.js — Commercial Decision Workbench controller (Slice #1).
// Manual-first, human-led. No AI, no API key, no backend, no persistence.
// Decision logic stays in decision-engine.js (unchanged); this file only wires
// business-facing input -> adapter -> engine -> result view -> human decision.
import { opportunity, dimensions, SYNTHETIC_LABEL } from "./fixtures.js";
import { DECISION_STATES, dedupePreserveOrder, evaluateDecision, buildBrief, paymentExposure } from "./decision-engine.js";
import { blankAssessmentDefaults, buildOpportunityFromInput, summarizeInput } from "./workbench-adapter.js";
import { DEFAULT_LANGUAGE, localizeEvidenceText, presentReason as localizeReason, stateLabels, t } from "./i18n.js";
import { createDecisionPathExperiment } from "./decision-path.js";
import { buildCommercialViewModel } from "./commercial-action-layer.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";

const $ = (id) => document.getElementById(id);

// --- mode -------------------------------------------------------------------
let mode = null; // "sample" | "blank"
let current = null; // current normalized opportunity
let engine = null;
let humanDecision = null;
let humanNote = "";
let language = DEFAULT_LANGUAGE;
let selectedPathId = null;
let decisionPathExperiment = null;

const tx = (key) => t(key, language);
const stateLabel = (state) => stateLabels(language)[state] || state;
const pathText = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), tx(key));

function tagClass(s) {
  return { ESCALATE: "esc", PURSUE_NOW: "now", PURSUE_CONDITIONALLY: "cond", HOLD_FOR_EVIDENCE: "hold", DO_NOT_PURSUE: "drop" }[s] || "";
}

function structureLabel(value) {
  const labels = {
    INCOMPLETE: "structure.incomplete", CONFIRMED: "status.agreed", COMPARABLE: "structure.comparable",
    NOT_COMPARABLE: "structure.notComparable", NOT_ASSESSED: "structure.notAssessed", UNKNOWN: "structure.unknown",
    ABSENT: "structure.kycAbsent", KYC_INCOMPLETE: "structure.kycIncomplete", CLEAR: "structure.kycClear",
    SANCTIONS_VETO: "structure.kycVeto", BELOW_THRESHOLD: "structure.marginBelow", COST_SHIFT: "reason.marginShift",
  };
  return tx(labels[value] || "structure.unknown");
}

function structureFit(value) {
  return { HIGH: tx("status.strongSignal"), MEDIUM: tx("status.someSignal"), LOW: tx("status.weakSignal"), WEAK: tx("status.weakSignal"), UNKNOWN: tx("structure.unknown") }[value] || tx("structure.unknown");
}

function structureQuality(value) {
  return { HIGH: tx("status.highConfidence"), MEDIUM: tx("status.someConfidence"), LOW: tx("status.lowConfidence"), UNKNOWN: tx("structure.unknown") }[value] || tx("structure.unknown");
}

function traceText(item) {
  const source = tx(`trace.${item.sourceType}`);
  const label = localizeEvidenceText(item.label, language);
  const generic = {
    KYC: tx("structure.kyc"), MARGIN: tx("structure.margin"), COMMERCIAL_TERMS: tx("structure.terms"),
    QUOTES: tx("structure.quotes"), QUOTE_COMPARABILITY: tx("structure.quotes"), EVIDENCE_QUALITY: tx("structure.evidence"), PAYMENT_EXPOSURE: tx("structure.payment"),
    "SANCTIONS": tx("structure.kyc"),
  }[item.label] || label;
  return `${source}: ${generic}`;
}

function actionTitle(action) { return tx(`action.${action.actionType}`); }
function actionWhy(action) { return tx(`action.why.${action.actionType}`); }

function tradeTermLabel(term) {
  return term === "UNKNOWN" || term === "notAssessed" ? tx("trade.notConfirmed") : term;
}

function tradeTraceText(item) {
  const source = tx("trade.trace." + item.sourceType);
  const label = item.sourceId === "DELIVERY_TERM"
    ? tx("trade.deliveryTerm")
    : item.sourceId === "CTR-1"
      ? tx("trade.paymentContradiction")
      : item.sourceId === "QUOTE_COMPARABILITY"
        ? tx("trade.quoteComparability")
        : item.label;
  return source + ": " + label;
}

function tradeTermCopyKey(term) {
  return term === "UNKNOWN" || term === "notAssessed" ? "UNKNOWN" : term;
}

function prepCopyKey(item, deliveryConfirmed) {
  return item.type === "DELIVERY" ? (deliveryConfirmed ? "DELIVERY_CONFIRMED" : "DELIVERY_UNKNOWN") : item.type;
}

function renderTradeDeal(view) {
  const p = view.structure.payment;
  const d = view.structure.delivery;
  const exposure = p.exposure === null ? tx("trade.unknown") : p.exposure.toLocaleString() + " " + tx("trade.cny");
  const events = p.events.length ? p.events.map((event) => esc(event.label) + " · " + (event.status === "COMPLETE" ? tx("trade.confirmed") : tx("trade.unknown"))).join("<br>") : tx("trade.noPaymentEvents");
  $("trade-deal-structure").innerHTML = [
    '<div class="trade-grid">',
    '<div class="trade-block"><h3>' + tx("trade.paymentHeading") + '</h3><dl>',
    '<dt>' + tx("trade.paymentTerms") + '</dt><dd>' + (p.termsStatus === "COMPLETE" ? tx("trade.confirmed") : tx("trade.notConfirmed")) + '</dd>',
    '<dt>' + tx("trade.paymentEvents") + '</dt><dd>' + events + '</dd>',
    '<dt>' + tx("trade.exposure") + '</dt><dd>' + exposure + '</dd>',
    '</dl></div>',
    '<div class="trade-block"><h3>' + tx("trade.deliveryHeading") + '</h3><dl>',
    '<dt>' + tx("trade.declaredTerm") + '</dt><dd>' + tradeTermLabel(d.declaredTerm) + '</dd>',
    '<dt>' + tx("trade.responsibility") + '</dt><dd>' + tx("trade.boundary." + tradeTermCopyKey(d.declaredTerm)) + '</dd>',
    '<dt>' + tx("trade.evidenceRequired") + '</dt><dd>' + tx("trade.evidence." + tradeTermCopyKey(d.declaredTerm)) + '</dd>',
    '</dl></div></div>',
    '<p class="trade-boundary">' + tx("trade.boundary") + '</p>',
  ].join("");
}

function renderNegotiationPrep(view) {
  $("negotiation-prep").innerHTML = view.negotiationPrep.length
    ? view.negotiationPrep.map((item) => [
      '<article class="prep-item"><div class="action-topline"><span class="action-priority">0' + item.priority + '</span><h3>' + tx("trade.prep." + item.type) + '</h3></div>',
      '<p><strong>' + tx("trade.question") + '</strong> ' + tx("trade.prep.question." + prepCopyKey(item, view.structure.delivery.confirmed)) + '</p>',
      '<p><strong>' + tx("trade.request") + '</strong> ' + tx("trade.prep.request." + prepCopyKey(item, view.structure.delivery.confirmed)) + '</p>',
      '<p><strong>' + tx("trade.doNotCommit") + '</strong> ' + tx("trade.prep.avoid." + prepCopyKey(item, view.structure.delivery.confirmed)) + '</p>',
      '<p><strong>' + tx("trade.ownerInput") + '</strong> ' + tx("trade.prep.owner." + prepCopyKey(item, view.structure.delivery.confirmed)) + '</p>',
      '<p><strong>' + tx("trade.rerun") + '</strong> ' + tx("trade.prep.rerun." + prepCopyKey(item, view.structure.delivery.confirmed)) + '</p>',
      '<p class="trade-trace"><strong>' + tx("trade.trace") + '</strong> ' + item.evidenceTrace.map(tradeTraceText).join(" · ") + '</p></article>',
    ].join("")).join("")
    : '<p class="muted">' + tx("trade.noPrep") + '</p>';
}

function renderCommercialStructure(view) {
  const s = view.structure;
  const exposure = s.paymentExposure === null ? tx("structure.exposureUnknown") : `${s.paymentExposure.toLocaleString()} ${tx("structure.exposureUnit")}`;
  $("commercial-structure").innerHTML = `
    <p class="muted structure-intro">${tx("structure.intro")}</p>
    <div class="structure-grid">
      <div class="structure-item"><span>${tx("structure.terms")}</span><strong>${structureLabel(s.terms)}</strong></div>
      <div class="structure-item"><span>${tx("structure.quotes")}</span><strong>${structureLabel(s.quoteComparability)}</strong><small>${s.quoteCount} ${tx("input.quotes")}</small></div>
      <div class="structure-item"><span>${tx("structure.payment")}</span><strong>${exposure}</strong><small>${s.paymentEventStatus === "UNKNOWN" ? tx("structure.notAssessed") : `${s.paymentEventStatus} ${tx("input.payments")}`}</small></div>
      <div class="structure-item"><span>${tx("structure.kyc")}</span><strong>${structureLabel(s.kyc)}</strong></div>
      <div class="structure-item"><span>${tx("structure.margin")}</span><strong>${structureLabel(s.margin)}</strong></div>
      <div class="structure-item"><span>${tx("structure.evidence")}</span><strong>${structureQuality(s.evidenceQuality)}</strong></div>
      <div class="structure-item"><span>${tx("structure.buyer")}</span><strong>${structureFit(s.buyerFit)}</strong></div>
      <div class="structure-item"><span>${tx("structure.category")}</span><strong>${structureFit(s.categoryFit)}</strong></div>
    </div>
    <p class="structure-open-items">${tx("structure.openItems")}: ${s.unknownCount} ${tx("structure.unknown")} · ${s.contradictionCount} ${tx("result.contradictions")}</p>
  `;
}

function renderPriorityActions(view) {
  const actions = view.actions;
  $("priority-actions").innerHTML = actions.length
    ? actions.map((item) => `
      <article class="action-item">
        <div class="action-topline"><span class="action-priority">0${item.priority}</span><h3>${actionTitle(item)}</h3></div>
        <p class="action-why"><strong>${tx("actions.why")}</strong> ${actionWhy(item)}</p>
        <p><strong>${tx("actions.trace")}</strong> ${item.evidenceTrace.map(traceText).join(" · ")}</p>
        <p><strong>${tx("actions.rerun")}</strong> ${tx(`action.rerun.${item.actionType}`)}</p>
        <p class="action-human"><strong>${tx("actions.human")}</strong> ${tx("action.humanBoundary")}</p>
      </article>`).join("")
    : `<p class="muted">${tx("result.noneRequired")}</p>`;
}

// --- entry ------------------------------------------------------------------
function showModeScreen() {
  $("mode-screen").hidden = false;
  $("workbench").hidden = true;
}
function showWorkbench() {
  $("mode-screen").hidden = true;
  $("workbench").hidden = false;
}

function applyLanguage() {
  document.documentElement.lang = language === "zh-TW" ? "zh-Hant" : "en";
  document.title = tx("document.title");
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = tx(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = `<b>${tx("result.humanBoundaryTitle")}</b>${tx("result.humanBoundary")}`;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = tx(el.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => { el.setAttribute("aria-label", tx(el.dataset.i18nAriaLabel)); });
  $("lang-zh").classList.toggle("active", language === "zh-TW");
  $("lang-en").classList.toggle("active", language === "en");
  $("lang-zh").setAttribute("aria-pressed", String(language === "zh-TW"));
  $("lang-en").setAttribute("aria-pressed", String(language === "en"));
  if (mode === "sample") {
    $("workbench-title").textContent = tx("workbench.sampleTitle");
    $("workbench-sub").textContent = tx("workbench.sampleSubtitle");
  } else if (mode === "blank") {
    $("workbench-title").textContent = tx("workbench.blankTitle");
    $("workbench-sub").textContent = tx("workbench.blankSubtitle");
    rerenderLists();
  }
  if (engine) renderResult();
}

function setLanguage(nextLanguage) {
  if (nextLanguage === language) return;
  language = nextLanguage;
  applyLanguage();
}

$("lang-zh").addEventListener("click", () => setLanguage("zh-TW"));
$("lang-en").addEventListener("click", () => setLanguage("en"));

$("mode-sample").addEventListener("click", () => {
  mode = "sample";
  $("workbench-title").textContent = tx("workbench.sampleTitle");
  $("workbench-sub").textContent = tx("workbench.sampleSubtitle");
  // sample mode: reuse the existing synthetic opportunity exactly as-is
  current = JSON.parse(JSON.stringify(opportunity));
  $("intake-area").hidden = true;
  $("run-area").hidden = false;
  showWorkbench();
  runAssessment();
  scrollToResult();
});

$("mode-blank").addEventListener("click", () => {
  mode = "blank";
  $("workbench-title").textContent = tx("workbench.blankTitle");
  $("workbench-sub").textContent = tx("workbench.blankSubtitle");
  current = null;
  engine = null;
  humanDecision = null;
  humanNote = "";
  selectedPathId = null;
  decisionPathExperiment = null;
  fillBlankIntake();
  $("intake-area").hidden = false;
  $("run-area").hidden = false;
  $("result-area").hidden = true;
  showWorkbench();
});

// --- blank intake form -------------------------------------------------------
function fillBlankIntake() {
  const d = blankAssessmentDefaults();
  $("in-name").value = d.name;
  $("in-buyer").value = d.buyerFit;
  $("in-category").value = d.categoryFit;
  $("in-evidence").value = d.evidenceQuality;
  $("in-terms").value = d.termsStatus;
  $("in-delivery-term").value = d.deliveryTerm || "notAssessed";
  $("in-terms-detail").value = d.termsDetail;
  $("in-kyc").value = d.kycStatus;
  $("in-margin-status").value = d.marginStatus;
  $("in-margin-bps").value = d.marginBps;
  $("in-margin-thr").value = d.marginThresholdBps;
  $("in-quotes-comp").value = d.quotesComparable;
  $("in-why").value = "";
  $("in-whynot").value = "";
  $("in-note").value = d.note;
  // dynamic lists
  window.__contradictions = [];
  window.__unknowns = [];
  window.__payments = [];
  window.__quotes = [];
  renderContradictionList();
  renderUnknownList();
  renderPaymentList();
  renderQuoteList();
}

function collectBlankInput() {
  return {
    name: $("in-name").value.trim() || tx("input.untitled"),
    buyerFit: $("in-buyer").value,
    categoryFit: $("in-category").value,
    evidenceQuality: $("in-evidence").value,
    termsStatus: $("in-terms").value,
    deliveryTerm: $("in-delivery-term").value,
    termsDetail: $("in-terms-detail").value.trim(),
    kycStatus: $("in-kyc").value,
    marginStatus: $("in-margin-status").value,
    marginBps: $("in-margin-bps").value,
    marginThresholdBps: $("in-margin-thr").value,
    quotesComparable: $("in-quotes-comp").value,
    contradictions: window.__contradictions || [],
    unknowns: window.__unknowns || [],
    paymentEvents: window.__payments || [],
    quotes: window.__quotes || [],
    why: ($("in-why").value.split("\n") || []).map((s) => s.trim()).filter(Boolean),
    whyNot: ($("in-whynot").value.split("\n") || []).map((s) => s.trim()).filter(Boolean),
    note: $("in-note").value.trim(),
  };
}

// --- dynamic list helpers (contradictions / unknowns / payments / quotes) ---
function listTemplate(title, rows, addLabel, addId) {
  return `
    <div class="card">
      <h3>${title}</h3>
      <div id="${addId}-rows"></div>
      <div style="margin-top:10px"><button type="button" class="secondary" data-add="${addId}">+ ${addLabel}</button></div>
    </div>`;
}

function renderContradictionList() {
  const rows = (window.__contradictions || []).map((c, i) => `
    <div class="list-row">
      <input placeholder="${tx("input.whatContradicts")}" value="${esc(c.label)}" data-c-label="${i}">
      <input placeholder="${tx("input.detail")}" value="${esc(c.detail)}" data-c-detail="${i}">
      <label><input type="checkbox" data-c-material="${i}" ${c.material ? "checked" : ""}> ${tx("input.material")}</label>
      <label><input type="checkbox" data-c-resolved="${i}" ${c.resolved ? "checked" : ""}> ${tx("input.resolved")}</label>
      <button type="button" class="x" data-c-del="${i}" aria-label="${tx("input.delete")}">✕</button>
    </div>`).join("");
  $("contradiction-rows").innerHTML = rows;
  wireList("c", ["label", "detail", "material", "resolved", "del"]);
}

function renderUnknownList() {
  const rows = (window.__unknowns || []).map((u, i) => `
    <div class="list-row">
      <input placeholder="${tx("input.whatUnknown")}" value="${esc(u.label)}" data-u-label="${i}">
      <input placeholder="${tx("input.detail")}" value="${esc(u.detail)}" data-u-detail="${i}">
      <label><input type="checkbox" data-u-blocks="${i}" ${u.blocks ? "checked" : ""}> ${tx("input.blocks")}</label>
      <button type="button" class="x" data-u-del="${i}" aria-label="${tx("input.delete")}">✕</button>
    </div>`).join("");
  $("unknown-rows").innerHTML = rows;
  wireList("u", ["label", "detail", "blocks", "del"]);
}

function renderPaymentList() {
  const rows = (window.__payments || []).map((p, i) => `
    <div class="list-row">
      <input placeholder="${tx("input.paymentLabel")}" value="${esc(p.label)}" data-p-label="${i}">
      <input placeholder="${tx("input.amount")}" type="number" value="${p.amountCny ?? ""}" data-p-amount="${i}">
      <input placeholder="${tx("input.days")}" type="number" value="${p.daysFromSign ?? ""}" data-p-days="${i}">
      <label><input type="checkbox" data-p-complete="${i}" ${p.complete ? "checked" : ""}> ${tx("input.committed")}</label>
      <button type="button" class="x" data-p-del="${i}" aria-label="${tx("input.delete")}">✕</button>
    </div>`).join("");
  $("payment-rows").innerHTML = rows;
  wireList("p", ["label", "amount", "days", "complete", "del"]);
}

function renderQuoteList() {
  const rows = (window.__quotes || []).map((q, i) => `
    <div class="list-row">
      <input placeholder="${tx("input.quoteBasis")}" value="${esc(q.basis)}" data-q-basis="${i}">
      <label><input type="checkbox" data-q-complete="${i}" ${q.complete ? "checked" : ""}> ${tx("input.complete")}</label>
      <button type="button" class="x" data-q-del="${i}" aria-label="${tx("input.delete")}">✕</button>
    </div>`).join("");
  $("quote-rows").innerHTML = rows;
  wireList("q", ["basis", "complete", "del"]);
}

function wireList(prefix, fields) {
  fields.forEach((f) => {
    document.querySelectorAll(`[data-${prefix}-${f}]`).forEach((el) => {
      el.addEventListener("change", (ev) => {
        const i = Number(ev.target.dataset[`${prefix}${f[0].toUpperCase()}${f.slice(1)}`] ?? ev.target.dataset[`${prefix}${f}`]);
        const arr = { c: window.__contradictions, u: window.__unknowns, p: window.__payments, q: window.__quotes }[prefix];
        if (!arr || arr[i] == null) return;
        if (f === "label" || f === "detail" || f === "basis") arr[i][f] = ev.target.value;
        else if (f === "amount" || f === "days") arr[i][f === "amount" ? "amountCny" : "daysFromSign"] = ev.target.value === "" ? "" : Number(ev.target.value);
        else if (f === "complete" || f === "material" || f === "resolved" || f === "blocks") arr[i][f] = ev.target.checked;
        else if (f === "del") { arr.splice(i, 1); rerenderLists(); }
      });
    });
  });
  document.querySelectorAll(`[data-add="${prefix}"]`).forEach((el) => {
    el.addEventListener("click", () => {
      const arr = { c: window.__contradictions, u: window.__unknowns, p: window.__payments, q: window.__quotes }[prefix];
      arr.push(prefix === "q" ? { basis: "", complete: false } : prefix === "p" ? { label: "", amountCny: "", daysFromSign: "", complete: false } : { label: "", detail: "", ...(prefix === "c" ? { material: false, resolved: false } : { blocks: false }) });
      rerenderLists();
    });
  });
}
function rerenderLists() {
  renderContradictionList();
  renderUnknownList();
  renderPaymentList();
  renderQuoteList();
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- run ---------------------------------------------------------------------
$("btn-run").addEventListener("click", () => {
  const input = collectBlankInput();
  current = buildOpportunityFromInput(input);
  current.trade = { deliveryTerm: input.deliveryTerm };
  window.__lastInput = input;
  runAssessment();
  scrollToResult();
});

function runAssessment() {
  engine = evaluateDecision(current);
  humanDecision = null;
  humanNote = "";
  selectedPathId = null;
  decisionPathExperiment = current?.id === "OPP-2026-008" ? createDecisionPathExperiment(current) : null;
  renderResult();
}

function scrollToResult() {
  const el = $("result-area");
  if (el && !el.hidden) el.scrollIntoView({ behavior: "smooth", block: "start" });
  else $("workbench").scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- result view -------------------------------------------------------------
function renderResult() {
  $("result-area").hidden = false;
  const g = engine;
  const next = dedupePreserveOrder([
    ...g.materialContradictions.map((c) => c.resolveWith),
    ...g.blockingUnknowns.map((u) => u.resolveWith),
    ...(g.termsIncomplete && current.commercialTerms.resolveWith ? [current.commercialTerms.resolveWith] : []),
    ...(g.weakEvidence ? [tx("next.evidence")] : []),
    ...(current.quoteComparabilityAssessed === false ? [tx("next.compareQuotes")] : []),
  ].filter(Boolean));

  // what would change this decision — derived from blockers, business language
  const wouldChange = [];
  if (g.materialContradictions.length) wouldChange.push(tx("next.pursueMayOpen"));
  if (g.blockingUnknowns.length) wouldChange.push(tx("next.resolveUnknown"));
  if (g.termsIncomplete) wouldChange.push(tx("next.resolveTerms"));
  if (g.weakEvidence || g.strongEvidence === false) wouldChange.push(tx("next.evidence"));
  if (g.kycGate === "SANCTIONS_VETO") wouldChange.push(tx("next.resolveKyc"));
  if (g.kycGate === "KYC_INCOMPLETE") wouldChange.push(tx("next.completeKyc"));
  if (g.marginGate === "BELOW_THRESHOLD") wouldChange.push(tx("next.recheckMargin"));
  if (!wouldChange.length && g.recommended === "HOLD_FOR_EVIDENCE") wouldChange.push(tx("next.missing"));
  if (!wouldChange.length) wouldChange.push(tx("next.nothingBlocks"));

  $("result-rec").innerHTML = `
    <div class="glance-rec">
      <span class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.08em">${tx("result.recommendation")}</span>
      <span class="rec-tag ${tagClass(g.recommended)}">${stateLabel(g.recommended)}</span>
      <span class="muted" style="font-size:12px">${tx("result.deterministic")}</span>
    </div>
    <hr class="glance-hr">
    <div class="glance-grid">
      <div class="glance-col"><h4>${tx("result.why")}</h4><ul>${g.reasons.map((r) => `<li>${esc(localizeReason(r, language, current.quoteComparabilityAssessed !== false))}</li>`).join("")}</ul></div>
      <div class="glance-col"><h4>${tx("result.blockers")}</h4>${g.materialContradictions.length || g.termsIncomplete || g.blockingUnknowns.length ? `<ul>${[
        ...g.materialContradictions.map((c) => `<li>${tx("result.materialContradiction")}: ${esc(c.label)} (${tx("result.unresolved")})</li>`),
        ...(g.termsIncomplete ? [`<li>${tx("result.termsIncomplete")}</li>`] : []),
        ...g.blockingUnknowns.map((u) => `<li>${tx("result.blockingUnknown")}: ${esc(u.label)}</li>`),
        ...(g.weakEvidence ? [`<li>${tx("result.evidenceLow")}</li>`] : []),
      ].join("")}</ul>` : `<span class="muted">${tx("result.noBlockers")}</span>`}</div>
    </div>
    <div class="glance-grid">
      <div class="glance-col"><h4>${tx("result.missing")}</h4><ul>${[
        ...g.blockingUnknowns.map((u) => `<li>${esc(u.label)}</li>`),
        ...(g.weakEvidence || g.strongEvidence === false ? [`<li>Evidence quality not strong</li>`] : []),
        ...(g.kycGate === "ABSENT" && mode === "blank" ? [`<li>${tx("input.kyc")} — ${tx("result.notAssessed")}</li>`] : []),
        ...(g.marginGate === "ABSENT" && mode === "blank" ? [`<li>${tx("input.margin")} — ${tx("result.notAssessed")}</li>`] : []),
        ...(current.quoteComparabilityAssessed === false ? [`<li>${tx("input.quoteComparability")} — ${tx("result.notAssessed")}</li>`] : []),
      ].join("") || `<span class="muted">${tx("result.none")}</span>`}</ul></div>
      <div class="glance-col"><h4>${tx("result.contradictions")}</h4>${current.contradictions.length ? `<ul>${current.contradictions.map((c) => `<li>${esc(c.label)}${c.material ? ` (${tx("input.material")})` : ""} — ${c.status === "RESOLVED" ? tx("input.resolved") : tx("result.unresolved")}</li>`).join("")}</ul>` : `<span class="muted">${tx("result.noneRecorded")}</span>`}</div>
    </div>
    <div class="glance-grid">
      <div class="glance-col"><h4>${tx("result.verifyNext")}</h4>${next.length ? `<ul>${next.map((n) => `<li>${esc(localizeEvidenceText(n, language))}</li>`).join("")}</ul>` : `<span class="muted">${tx("result.noFurtherEvidence")}</span>`}</div>
      <div class="glance-col"><h4>${tx("result.wouldChange")}</h4><ul>${wouldChange.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
    </div>
    <p class="glance-note">${tx("boundary.note")}</p>
  `;

  renderDecisionPath();
  const commercialView = buildCommercialViewModel(current, g, decisionPathExperiment);
  renderCommercialStructure(commercialView);
  renderPriorityActions(commercialView);
  const tradeView = buildTradeDealViewModel(current, g);
  renderTradeDeal(tradeView);
  renderNegotiationPrep(tradeView);

  // human decision — separate from the engine recommendation
  $("human-state-buttons").innerHTML = DECISION_STATES.map(
    (s) => `<button type="button" data-hstate="${s}" class="${humanDecision === s ? "sel" : ""}">${stateLabel(s)}</button>`,
  ).join("");
  $("human-state-buttons").querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      humanDecision = b.dataset.hstate;
      renderHumanDecision();
    });
  });
  $("human-note").value = humanNote;
  renderHumanDecision();
}

const pathTitleKey = { "CP-1": "path.cp1", "CP-2": "path.cp2", "CP-3R": "path.cp3", "CP-4": "path.cp4" };
const pathSourceKey = { "CP-1": "path.cp1Source", "CP-2": "path.cp2Source", "CP-3R": "path.cp3Source", "CP-4": "path.cp4Source" };

function decisionPathControlItems(result) {
  return [
    ...result.materialContradictions.map((c) => pathText("path.control.contradiction", { label: localizeEvidenceText(c.label, language) })),
    ...result.blockingUnknowns.map((u) => pathText("path.control.unknown", { label: localizeEvidenceText(u.label, language) })),
    ...(result.termsIncomplete ? [tx("path.control.terms")] : []),
    ...(result.kycGate === "KYC_INCOMPLETE" ? [tx("path.control.kyc")] : []),
    ...(result.marginGate === "BELOW_THRESHOLD" ? [tx("path.control.margin")] : []),
    ...(!result.exposure.computed ? [tx("path.control.payment")] : []),
  ];
}

function pathChangeType(type) {
  return {
    quoteBasesComparable: "quote",
    materialContradictions: "contradiction",
    blockingUnknowns: "unknown",
    termsIncomplete: "terms",
    kycGate: "kyc",
    marginGate: "margin",
  }[type] || type;
}

function decisionPathChangeText(change, changed) {
  const key = `${changed ? "path.changed" : "path.unchanged"}.${pathChangeType(change.type)}`;
  return tx(key);
}

function pathBlockText(item) {
  const key = { terms: "path.control.terms", kyc: "path.control.kyc", kycVeto: "path.control.kycVeto", margin: "path.control.margin", payment: "path.control.payment" }[item.type];
  return key ? tx(key) : localizeEvidenceText(item.label, language);
}

function renderDecisionPath() {
  const area = $("decision-path-area");
  if (!area) return;
  if (!decisionPathExperiment || !current || current.id !== "OPP-2026-008") {
    area.hidden = true;
    return;
  }
  area.hidden = false;
  const experiment = decisionPathExperiment;
  const controls = decisionPathControlItems(experiment.current);
  $("decision-path-current").innerHTML = `
    <div class="path-current"><span class="muted">${tx("path.currentDecision")}</span><span class="rec-tag ${tagClass(experiment.current.recommended)}">${stateLabel(experiment.current.recommended)}</span></div>
    <h4>${tx("path.currentControls")}</h4>
    ${controls.length ? `<ul class="path-list">${controls.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p class="muted">${tx("path.noOpenGates")}</p>`}
  `;
  $("decision-path-options").innerHTML = experiment.paths.map((path) => `
    <button type="button" class="secondary ${selectedPathId === path.id ? "sel" : ""}" data-path-id="${path.id}">
      <span class="path-option-id">${path.id}</span>${tx(pathTitleKey[path.id])}
    </button>
  `).join("");
  $("decision-path-options").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPathId = button.dataset.pathId;
      renderDecisionPath();
    });
  });
  $("decision-path-empty").hidden = Boolean(selectedPathId);
  const selected = experiment.paths.find((path) => path.id === selectedPathId);
  const detail = $("decision-path-detail");
  if (!selected) {
    detail.hidden = true;
    return;
  }
  detail.hidden = false;
  const changed = selected.comparison.changed.map((item) => decisionPathChangeText(item, true));
  const unchanged = selected.comparison.unchanged.map((item) => decisionPathChangeText(item, false));
  const blocks = selected.stillBlocks.map(pathBlockText);
  detail.innerHTML = `
    <p class="path-warning">${tx("path.hypotheticalWarning")}</p>
    <h3>${tx("path.evidenceChange")}</h3>
    <p><strong>${tx(pathTitleKey[selected.id])}</strong><br>${tx(pathSourceKey[selected.id])}</p>
    <div class="path-columns">
      <div><h4>${tx("path.current")}</h4><p><span class="rec-tag ${tagClass(selected.current.recommended)}">${stateLabel(selected.current.recommended)}</span></p></div>
      <div><h4>${tx("path.hypothetical")}</h4><p><span class="rec-tag ${tagClass(selected.hypothetical.recommended)}">${stateLabel(selected.hypothetical.recommended)}</span></p></div>
    </div>
    <p><strong>${selected.comparison.decisionChanged ? tx("path.changed") : tx("path.unchanged")}</strong><br>${selected.comparison.decisionChanged ? pathText("path.recommendationChanged", { from: stateLabel(selected.current.recommended), to: stateLabel(selected.hypothetical.recommended) }) : pathText("path.recommendationUnchanged", { state: stateLabel(selected.current.recommended) })}</p>
    <div class="path-columns">
      <div><h4>${tx("path.whatChanged")}</h4><ul>${(changed.length ? changed : [tx("path.noFact")]).map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
      <div><h4>${tx("path.whatDidNotChange")}</h4><ul>${unchanged.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
    </div>
    <div class="path-detail"><h4>${tx("path.stillBlocks")}</h4>${blocks.length ? `<ul>${blocks.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>${tx("path.noOpenGates")}</p>`}</div>
    <div class="path-detail"><h4>${tx("path.human")}</h4><p>${tx("path.humanBoundary")}</p></div>
    <details class="path-trace"><summary>${tx("path.trace")}</summary><p>${esc(selected.manifest.semanticNote)}</p><p>${esc(selected.manifest.fieldsAffected.join(", "))}</p></details>
  `;
}

function renderHumanDecision() {
  const note = $("human-note").value;
  $("human-decision-status").innerHTML = humanDecision
    ? `<span class="ok-tag">${tx("result.humanDecision")}${stateLabel(humanDecision)}${note ? " — " + esc(note) : ""}</span>`
    : `<span class="muted">${tx("result.noHumanDecision")}</span>`;
  $("human-state-buttons").querySelectorAll("button").forEach((button) => {
    button.classList.toggle("sel", button.dataset.hstate === humanDecision);
  });
}

$("human-note").addEventListener("input", (e) => { humanNote = e.target.value; renderHumanDecision(); });

// --- reset -------------------------------------------------------------------
$("btn-reset").addEventListener("click", () => {
  if (mode === "blank") {
    fillBlankIntake();
    current = null;
    engine = null;
    humanDecision = null;
    humanNote = "";
    $("result-area").hidden = true;
  } else {
    current = JSON.parse(JSON.stringify(opportunity));
    runAssessment();
  }
});
$("btn-reset-2").addEventListener("click", () => $("btn-reset").click());

$("btn-home").addEventListener("click", () => {
  mode = null;
  showModeScreen();
});

// --- boot --------------------------------------------------------------------
applyLanguage();
showModeScreen();
