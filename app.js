// app.js — Commercial Decision Workbench controller (Slice #1).
// Manual-first, human-led. No AI, no API key, no backend, no persistence.
// Decision logic stays in decision-engine.js (unchanged); this file only wires
// business-facing input -> adapter -> engine -> result view -> human decision.
import { opportunity, dimensions, SYNTHETIC_LABEL } from "./fixtures.js";
import { DECISION_STATES, dedupePreserveOrder, evaluateDecision, buildBrief, paymentExposure } from "./decision-engine.js";
import { blankAssessmentDefaults, buildOpportunityFromInput, summarizeInput } from "./workbench-adapter.js";
import { DEFAULT_LANGUAGE, localizeEvidenceText, presentReason as localizeReason, stateLabels, t } from "./i18n.js";

const $ = (id) => document.getElementById(id);

// --- mode -------------------------------------------------------------------
let mode = null; // "sample" | "blank"
let current = null; // current normalized opportunity
let engine = null;
let humanDecision = null;
let humanNote = "";
let language = DEFAULT_LANGUAGE;

const tx = (key) => t(key, language);
const stateLabel = (state) => stateLabels(language)[state] || state;

function tagClass(s) {
  return { ESCALATE: "esc", PURSUE_NOW: "now", PURSUE_CONDITIONALLY: "cond", HOLD_FOR_EVIDENCE: "hold", DO_NOT_PURSUE: "drop" }[s] || "";
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
  window.__lastInput = input;
  runAssessment();
  scrollToResult();
});

function runAssessment() {
  engine = evaluateDecision(current);
  humanDecision = null;
  humanNote = "";
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
