// app.js — Commercial Decision Workbench controller (Slice #1).
// Manual-first, human-led. No AI, no API key, no backend, no persistence.
// Decision logic stays in decision-engine.js (unchanged); this file only wires
// business-facing input -> adapter -> engine -> result view -> human decision.
import { opportunity, dimensions, SYNTHETIC_LABEL } from "./fixtures.js";
import { DECISION_STATES, dedupePreserveOrder, evaluateDecision, buildBrief, paymentExposure } from "./decision-engine.js";
import { blankAssessmentDefaults, buildOpportunityFromInput, summarizeInput } from "./workbench-adapter.js";
import { localizeEvidenceText, presentReason as localizeReason, stateLabels, t } from "./i18n.js";
import { createDecisionPathExperiment } from "./decision-path.js";
import { buildCommercialViewModel } from "./commercial-action-layer.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";
import { buildEconomicsBridge, economicsEvidenceTrace, economicsReading } from "./economics-bridge.js";
import { buildCommercialMomentum, buildEvidenceCoverage, momentumPresentationBand } from "./commercial-momentum.js";
import { buildDealBriefViewModel, downloadDealBrief } from "./deal-brief.js";

const $ = (id) => document.getElementById(id);

// --- mode -------------------------------------------------------------------
let mode = null; // "sample" | "blank"
let current = null; // current normalized opportunity
let engine = null;
let humanDecision = null;
let humanNote = "";
// Language resolution priority: URL ?lang= → saved choice → browser language → default.
// English-friendly for international visitors; only the UI preference is remembered
// (localStorage) — all business/decision data stays in-session, never persisted.
let language = initialLanguage();
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
      : item.sourceId === "PAYMENT"
        ? tx("trade.paymentIncomplete")
        : item.sourceId === "BUYER_AUTHORITY"
          ? tx("trade.authorityUnknown")
        : item.label;
  return source + ": " + label;
}

function tradeTermCopyKey(term) {
  return term === "UNKNOWN" || term === "notAssessed" ? "UNKNOWN" : term;
}

function prepCopyKey(item, deliveryConfirmed) {
  return item.type === "DELIVERY" ? (deliveryConfirmed ? "DELIVERY_CONFIRMED" : "DELIVERY_UNKNOWN") : item.type;
}

function economicsValue(value, currency) {
  return value === null ? tx("economics.unknown") : value.toLocaleString() + " " + currency;
}

function renderEconomicsBridge(bridge, currency) {
  $("blank-economics-result").hidden = mode !== "blank";
  const rows = [
    ["economics.revenue", bridge.revenue],
    ["economics.directCost", bridge.directCost],
    ["economics.tradeCost", bridge.tradeCost],
    ["economics.dealSpecificCost", bridge.dealSpecificCost],
    ["economics.contingency", bridge.contingency],
  ];
  $("economics-bridge").innerHTML = [
    '<div class="economics-flow">',
    rows.map((row, index) => '<div class="economics-row"><span>' + tx(row[0]) + '</span><strong>' + economicsValue(row[1], currency) + '</strong>' + (index === 0 ? "" : '<small>−</small>') + '</div>').join(""),
    '<div class="economics-divider"></div>',
    '<div class="economics-row economics-result"><span>' + tx("economics.netContribution") + '</span><strong>' + (bridge.expectedNetContribution === null ? tx("economics.notCalculated") : economicsValue(bridge.expectedNetContribution, currency)) + '</strong></div>',
    '</div>',
    '<div class="economics-owner-input"><span>' + tx("economics.minimum") + '</span><strong>' + economicsValue(bridge.minimumNetContribution, currency) + '</strong></div>',
    '<p class="economics-gap"><strong>' + tx("economics.gap") + '</strong> ' + (bridge.gap === null ? tx("economics.notCalculated") : economicsValue(bridge.gap, currency)) + '</p>',
    '<div class="economics-reading"><span>' + tx("economics.readingLabel") + '</span><strong>' + tx("economics.reading." + economicsReading(bridge)) + '</strong><p>' + tx("economics.interpretation." + economicsReading(bridge)) + '</p></div>',
    '<p class="economics-note">' + tx("economics.note") + '</p>',
  ].join("");
  $("economics-trace").innerHTML = economicsEvidenceTrace(bridge).length
    ? tx("economics.missing") + ": " + economicsEvidenceTrace(bridge).map((key) => tx("economics." + key)).join(" · ")
    : tx("economics.complete");
}

function contextDisplay(value) {
  return value === "" || value === undefined || value === null || value === "unknown" ? tx("context.unknown") : value;
}

// Quantity + unit presentation semantics (Commercial Context evidence only):
//   quantity + unit      -> "120 metres"
//   quantity, no unit    -> "120 (unit UNKNOWN)"
//   unit, no quantity    -> UNKNOWN
//   neither              -> UNKNOWN
// Never inferred into a value; never enters Decision Core.
function contextQuantityDisplay(qty, unit) {
  const hasQty = qty !== "" && qty !== undefined && qty !== null;
  const hasUnit = unit !== "" && unit !== undefined && unit !== null;
  if (hasQty && hasUnit) return qty + " " + unit;
  if (hasQty) return qty + " (" + tx("context.unitUnknown") + ")";
  return tx("context.unknown");
}

function contextStatus(value) {
  if (value === "yes") return tx("context.yes");
  if (value === "no") return tx("context.no");
  if (value === "new") return tx("context.newBuyer");
  if (value === "existing") return tx("context.existingBuyer");
  return tx("context.unknown");
}

function snapshotValue(value) {
  return esc(value === "" || value === undefined || value === null ? tx("context.unknown") : value);
}

function momentumDimensionLabel(id) { return tx(`momentum.dimension.${id}`); }

function momentumValueLabel(value) {
  const labels = {
    HIGH: "status.strongSignal", STRONG: "status.strongSignal", MEDIUM: "status.someSignal",
    CONDITIONAL: "momentum.conditional", LOW: "status.weakSignal", WEAK: "status.weakSignal",
    POSITIVE: "momentum.positiveEconomics", BREAK_EVEN: "momentum.breakEvenEconomics", NEGATIVE: "momentum.negativeEconomics",
  };
  return tx(labels[value] || "context.unknown");
}

function renderExecutiveSnapshot({ economics, tradeView, control, momentum, coverage, nextBestAction }) {
  const context = current.commercialContext || {};
  const buyer = context.buyerCompany || current.buyers?.[0]?.label || tx("context.unknown");
  const currency = current.economics?.currency || "CNY";
  const revenue = economics.revenue === null ? tx("context.unknown") : economicsValue(economics.revenue, currency);
  const netContribution = economics.expectedNetContribution === null
    ? tx("snapshot.notCalculated")
    : economicsValue(economics.expectedNetContribution, currency);
  const reading = economicsReading(economics);
  const delivery = tradeTermLabel(tradeView.structure.delivery.declaredTerm);
  const fields = [
    ["snapshot.buyer", buyer],
    ["snapshot.market", context.market || tx("context.unknown")],
    ["snapshot.product", context.product || tx("context.unknown")],
    ["snapshot.quantity", contextQuantityDisplay(context.quantity, context.quantityUnit)],
    ["snapshot.dealValue", revenue],
    ["snapshot.delivery", delivery],
  ];
  $("executive-deal-snapshot").hidden = false;
  const momentumValue = momentum.score === null ? "—" : String(momentum.score);
  const momentumBand = momentumPresentationBand(momentum.score);
  const momentumStatus = momentum.status === "CALCULATED" ? tx("momentum.definition") : tx("momentum.notEnough");
  const positiveDrivers = momentum.drivers.filter((driver) => driver.direction === "UP").slice(0, 3);
  const limitingDrivers = momentum.drivers.filter((driver) => driver.direction !== "UP").slice(0, 2);
  const coverageGaps = momentum.unknownDimensions.slice(0, 2);
  const driverLine = (driver) => {
    const symbol = driver.direction === "UP" ? "↑" : driver.direction === "DOWN" ? "↓" : "?";
    const value = driver.direction === "UNKNOWN" ? tx("status.unknown") : momentumValueLabel(driver.value);
    return `<li class="snapshot-driver ${driver.direction.toLowerCase()}"><b>${symbol}</b> ${momentumDimensionLabel(driver.id)}: ${value}</li>`;
  };
  $("executive-deal-snapshot").innerHTML = `
    <div class="snapshot-heading-row">
      <div>
        <span class="snapshot-kicker">${tx("snapshot.heading")}</span>
        <h2>${snapshotValue(current.name || tx("context.unknown"))}</h2>
      </div>
    </div>
    <div class="snapshot-signals" aria-label="${tx("momentum.ariaLabel")}">
      <div class="snapshot-signal snapshot-momentum"><span>${tx("momentum.label")}</span><strong>${momentumValue}<small>/ 100</small></strong><em class="momentum-band ${momentumBand.toLowerCase()}">${tx(`momentum.band.${momentumBand}`)}</em><p>${momentumStatus}</p><details class="snapshot-method"><summary>${tx("momentum.methodSummary")}</summary><p>${tx("momentum.methodDetail")}</p></details></div>
      <div class="snapshot-signal snapshot-coverage"><span>${tx("coverage.label")}</span><strong>${coverage.score}<small>%</small></strong><div class="snapshot-coverage-track" aria-hidden="true"><i style="width:${coverage.score}%"></i></div><p>${tx("coverage.definition")}</p></div>
      <div class="snapshot-signal snapshot-position"><span>${tx("snapshot.decision")}</span><strong class="rec-tag ${tagClass(engine.recommended)}">${stateLabel(engine.recommended)}</strong><p>${tx("momentum.positionNote")}</p></div>
    </div>
    <p class="snapshot-story">${pathText(`momentum.story.${momentumBand}`, { position: stateLabel(engine.recommended) })}</p>
    <div class="snapshot-economics-reading"><span>${tx("economics.readingLabel")}</span><strong>${tx("economics.reading." + reading)}</strong><p>${tx("economics.interpretation." + reading)}</p></div>
    <div class="snapshot-next-action"><span>${tx("result.nextBestAction")}</span><strong>${esc(nextBestAction)}</strong></div>
    <div class="snapshot-drivers">
      <div><span>${tx("momentum.supports")}</span><ul>${positiveDrivers.map(driverLine).join("") || `<li>${tx("momentum.noKnownDrivers")}</li>`}</ul></div>
      <div><span>${tx("momentum.limits")}</span><ul>${limitingDrivers.map(driverLine).join("") || `<li>${tx("momentum.noKnownLimits")}</li>`}</ul>${coverageGaps.length ? `<p class="snapshot-coverage-gap"><b>${tx("coverage.gaps")}</b> ${coverageGaps.map((dimension) => momentumDimensionLabel(dimension.id)).join(" · ")}</p>` : ""}</div>
    </div>
    <div class="snapshot-grid">
      ${fields.map(([label, value]) => `<div class="snapshot-field"><span>${tx(label)}</span><strong>${snapshotValue(value)}</strong></div>`).join("")}
      <div class="snapshot-field snapshot-economics"><span>${tx("snapshot.netContribution")}</span><strong>${snapshotValue(netContribution)}</strong></div>
    </div>
    <div class="snapshot-control"><span>${tx("snapshot.control")}</span><strong>${snapshotValue(control)}</strong></div>
  `;
}

function renderCommercialContext(context = {}) {
  $("blank-context-result").hidden = mode !== "blank";
  if (mode !== "blank") return;
  $("blank-commercial-context").innerHTML = [
    '<div class="context-grid">',
    '<div><span>' + tx("context.product") + '</span><strong>' + contextDisplay(context.product) + '</strong></div>',
    '<div><span>' + tx("context.buyerCompany") + '</span><strong>' + contextDisplay(context.buyerCompany) + '</strong></div>',
    '<div><span>' + tx("context.market") + '</span><strong>' + contextDisplay(context.market) + '</strong></div>',
    '<div><span>' + tx("context.quantity") + '</span><strong>' + contextQuantityDisplay(context.quantity, context.quantityUnit) + '</strong></div>',
    '<div><span>' + tx("context.revenue") + '</span><strong>' + contextDisplay(context.revenue) + ' ' + contextDisplay(context.currency) + '</strong></div>',
    '<div><span>' + tx("context.timing") + '</span><strong>' + contextDisplay(context.timing) + '</strong></div>',
    '<div><span>' + tx("context.relationship") + '</span><strong>' + contextStatus(context.relationship) + '</strong></div>',
    '<div><span>' + tx("context.source") + '</span><strong>' + contextDisplay(context.source) + '</strong></div>',
    '</div>',
    '<details class="context-authority"><summary>' + tx("context.authoritySummary") + '</summary>',
    '<div class="context-grid authority-grid">',
    '<div><span>' + tx("context.contactRole") + '</span><strong>' + contextDisplay(context.contactRole) + '</strong></div>',
    '<div><span>' + tx("context.purchasingAuthority") + '</span><strong>' + contextStatus(context.purchasingAuthority) + '</strong></div>',
    '<div><span>' + tx("context.technicalAuthority") + '</span><strong>' + contextStatus(context.technicalAuthority) + '</strong></div>',
    '<div><span>' + tx("context.finalApprover") + '</span><strong>' + contextStatus(context.finalApprover) + '</strong></div>',
    '<div><span>' + tx("context.accessDecisionMaker") + '</span><strong>' + contextStatus(context.accessDecisionMaker) + '</strong></div>',
    '</div></details>',
  ].join("");
}

function renderTradeDeal(view) {
  const p = view.structure.payment;
  const d = view.structure.delivery;
  const exposure = p.exposure === null ? tx("trade.unknown") : p.exposure.toLocaleString() + " " + tx("trade.cny");
  const events = p.events.length ? p.events.map((event) => esc(event.label) + " · " + (event.status === "COMPLETE" ? tx("trade.confirmed") : tx("trade.unknown"))).join("<br>") : tx("trade.noPaymentEvents");
  const paymentEvidence = view.structure.paymentEvidence;
  const acceptanceRemedy = view.structure.acceptanceRemedy;
  const evidenceRows = paymentEvidence.items.length ? paymentEvidence.items.map((item) => `<div class="payment-evidence-item"><strong>${esc(item.label)}</strong><span>${tx("trade.paymentState." + item.state)}</span><small>${esc(item.source || tx("trade.unknown"))}${item.asOf ? " · " + esc(item.asOf) : ""}</small><small>${item.humanStatus === "CONFIRMED_BY_OWNER" ? tx("trade.ownerConfirmed") : tx("trade.pendingOwnerConfirmation")}${item.fragment ? " · " + esc(item.fragment) : ""}</small></div>`).join("") : `<p class="muted">${tx("trade.noPaymentEvidence")}</p>`;
  $("trade-deal-structure").innerHTML = [
    '<div class="trade-grid">',
    '<div class="trade-block"><h3>' + tx("trade.paymentHeading") + '</h3><dl>',
    '<dt>' + tx("trade.paymentTerms") + '</dt><dd>' + (p.termsStatus === "COMPLETE" ? tx("trade.confirmed") : tx("trade.notConfirmed")) + '</dd>',
    '<dt>' + tx("trade.paymentEvents") + '</dt><dd>' + events + '</dd>',
    '<dt>' + tx("trade.exposure") + '</dt><dd>' + exposure + '</dd>',
    '</dl></div>',
    '<div class="trade-block"><h3>' + tx("trade.paymentEvidenceHeading") + '</h3>' + evidenceRows + '<p class="trade-boundary">' + tx("trade.paymentEvidenceBoundary") + '</p></div>',
    '<div class="trade-block"><h3>' + tx("trade.acceptanceRemedyHeading") + '</h3>' + (acceptanceRemedy.items.length ? acceptanceRemedy.items.map((item) => '<div class="acceptance-remedy-item"><strong>' + esc(item.condition) + '</strong><small>' + esc(item.evidence) + '</small><small>' + esc(item.boundary) + '</small></div>').join("") : '<p class="muted">' + tx("trade.acceptanceRemedyUnknown") + '</p>') + '</div>',
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
      '<p><strong>' + tx("trade.question") + '</strong> ' + (item.type === "ACCEPTANCE_REMEDY" ? esc(item.question) : tx("trade.prep.question." + prepCopyKey(item, view.structure.delivery.confirmed))) + '</p>',
      '<p><strong>' + tx("trade.request") + '</strong> ' + (item.type === "ACCEPTANCE_REMEDY" ? esc(item.request) : tx("trade.prep.request." + prepCopyKey(item, view.structure.delivery.confirmed))) + '</p>',
      '<p><strong>' + tx("trade.doNotCommit") + '</strong> ' + (item.type === "ACCEPTANCE_REMEDY" ? esc(item.avoidCommitment) : tx("trade.prep.avoid." + prepCopyKey(item, view.structure.delivery.confirmed))) + '</p>',
      '<p><strong>' + tx("trade.ownerInput") + '</strong> ' + (item.type === "ACCEPTANCE_REMEDY" ? esc(item.ownerInput) : tx("trade.prep.owner." + prepCopyKey(item, view.structure.delivery.confirmed))) + '</p>',
      '<p><strong>' + tx("trade.rerun") + '</strong> ' + (item.type === "ACCEPTANCE_REMEDY" ? esc(item.rerunWhen) : tx("trade.prep.rerun." + prepCopyKey(item, view.structure.delivery.confirmed))) + '</p>',
      '<p class="trade-trace"><strong>' + tx("trade.trace") + '</strong> ' + item.evidenceTrace.map(tradeTraceText).join(" · ") + '</p></article>',
    ].join("")).join("")
    : '<p class="muted">' + tx("trade.noPrep") + '</p>';
}

function renderCommercialStructure(view) {
  const s = view.structure;
  const exposure = s.paymentExposure === null ? tx("structure.exposureUnknown") : `${s.paymentExposure.toLocaleString()} ${tx("structure.exposureUnit")}`;
  const acceptanceRemedy = s.acceptanceRemedy;
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
    <div class="structure-controls"><h3>${tx("structure.acceptanceRemedy")}</h3>${acceptanceRemedy?.items?.length ? acceptanceRemedy.items.map((item) => `<div class="control-item"><strong>${esc(item.condition)}</strong><small>${esc(item.action)}</small><small>${esc(item.rerunWhen)}</small></div>`).join("") : `<p class="muted">${tx("structure.acceptanceRemedyUnknown")}</p>`}</div>
  `;
}

function renderPriorityActions(view) {
  const actions = view.actions;
  const controls = view.structure.acceptanceRemedy?.items || [];
  const actionHtml = actions.length
    ? actions.map((item) => `
      <article class="action-item">
        <div class="action-topline"><span class="action-priority">0${item.priority}</span><h3>${actionTitle(item)}</h3></div>
        <p class="action-why"><strong>${tx("actions.why")}</strong> ${actionWhy(item)}</p>
        <p><strong>${tx("actions.trace")}</strong> ${item.evidenceTrace.map(traceText).join(" · ")}</p>
        <p><strong>${tx("actions.rerun")}</strong> ${tx(`action.rerun.${item.actionType}`)}</p>
        <p class="action-human"><strong>${tx("actions.human")}</strong> ${tx("action.humanBoundary")}</p>
      </article>`).join("")
    : `<p class="muted">${tx("result.noneRequired")}</p>`;
  const controlHtml = controls.map((item) => `<article class="action-item acceptance-remedy-control"><div class="action-topline"><span class="action-priority">G6</span><h3>${esc(item.condition)}</h3></div><p class="action-why"><strong>${tx("actions.why")}</strong> ${esc(item.evidence)}</p><p><strong>${tx("actions.rerun")}</strong> ${esc(item.rerunWhen)}</p><p class="action-human"><strong>${tx("actions.human")}</strong> ${esc(item.boundary)}</p></article>`).join("");
  $("priority-actions").innerHTML = actionHtml + controlHtml;
}

function currentDealBrief() {
  if (!current || !engine) return null;
  const commercialView = buildCommercialViewModel(current, engine, decisionPathExperiment);
  const tradeView = buildTradeDealViewModel(current, engine);
  const economicsBridge = buildEconomicsBridge(current.economics || {});
  return buildDealBriefViewModel({
    opportunity: current,
    engine,
    commercialView,
    tradeView,
    economicsBridge,
    decisionPathExperiment,
    humanDecision,
    humanNote,
    language,
  });
}

function exportCurrentDealBrief(format) {
  const brief = currentDealBrief();
  if (!brief) {
    $("export-status").textContent = tx("export.beforeRun");
    return;
  }
  const result = downloadDealBrief(brief, format, language);
  window.__lastDealBriefExport = { format, ...result, brief };
  $("export-status").textContent = tx("export.downloaded") + " " + result.filename;
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

function initialLanguage() {
  const param = new URLSearchParams(window.location.search).get("lang");
  if (param === "en") return "en";
  if (param === "zh" || param === "zh-TW") return "zh-TW";
  try {
    const saved = window.localStorage.getItem("cdd-lang");
    if (saved === "en" || saved === "zh-TW") return saved;
  } catch (_) { /* storage unavailable */ }
  const nav = (navigator.language || "en").toLowerCase();
  return nav.startsWith("zh") ? "zh-TW" : "en";
}

function persistLanguage(nextLanguage) {
  try { window.localStorage.setItem("cdd-lang", nextLanguage); } catch (_) { /* ignore */ }
  const url = new URL(window.location.href);
  url.searchParams.set("lang", nextLanguage === "en" ? "en" : "zh");
  window.history.replaceState(null, "", url.toString());
}

function setLanguage(nextLanguage) {
  if (nextLanguage === language) return;
  language = nextLanguage;
  persistLanguage(nextLanguage);
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
// Locale decides the INITIAL default currency for a new blank assessment only
// (ZH -> TWD, else USD). Language switching never touches the user's choice,
// and Sample data keeps its own currency.
function defaultCurrency() {
  return language === "zh-TW" ? "TWD" : "USD";
}

function fillBlankIntake() {
  const d = blankAssessmentDefaults();
  $("in-name").value = d.name;
  $("in-product").value = "";
  $("in-buyer-company").value = "";
  $("in-market").value = "";
  $("in-quantity").value = "";
  $("in-quantity-unit").value = "";
  $("in-revenue").value = "";
  $("in-currency").value = defaultCurrency();
  $("in-timing").value = "";
  $("in-relationship").value = "unknown";
  $("in-source").value = "";
  $("in-contact-role").value = "";
  $("in-purchasing-authority").value = "unknown";
  $("in-technical-authority").value = "unknown";
  $("in-final-approver").value = "unknown";
  $("in-access-decision-maker").value = "unknown";
  $("in-direct-cost").value = "";
  $("in-trade-cost").value = "";
  $("in-deal-cost").value = "";
  $("in-contingency").value = "";
  $("in-min-net").value = "";
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
  window.__paymentEvidence = [];
  window.__quotes = [];
  renderContradictionList();
  renderUnknownList();
  renderPaymentList();
  renderQuoteList();
}

function collectBlankInput() {
  return {
    name: $("in-name").value.trim() || tx("input.untitled"),
    commercialContext: {
      product: $("in-product").value.trim(),
      buyerCompany: $("in-buyer-company").value.trim(),
      market: $("in-market").value.trim(),
      quantity: $("in-quantity").value,
      quantityUnit: $("in-quantity-unit").value.trim(),
      timing: $("in-timing").value.trim(),
      relationship: $("in-relationship").value,
      source: $("in-source").value.trim(),
      contactRole: $("in-contact-role").value.trim(),
      purchasingAuthority: $("in-purchasing-authority").value,
      technicalAuthority: $("in-technical-authority").value,
      finalApprover: $("in-final-approver").value,
      accessDecisionMaker: $("in-access-decision-maker").value,
    },
    economics: {
      revenue: $("in-revenue").value,
      currency: $("in-currency").value,
      directCost: $("in-direct-cost").value,
      tradeCost: $("in-trade-cost").value,
      dealSpecificCost: $("in-deal-cost").value,
      contingency: $("in-contingency").value,
      minimumNetContribution: $("in-min-net").value,
    },
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
    paymentEvidence: window.__paymentEvidence || [],
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
  const evidenceRows = (window.__paymentEvidence || []).map((e, i) => `
    <div class="list-row">
      <input placeholder="${tx("input.paymentEvidenceLabel")}" value="${esc(e.label)}" data-pe-label="${i}">
      <select data-pe-state="${i}">${["UNKNOWN", "MENTIONED", "PROPOSED", "NEGOTIATED", "CONFIRMED", "BINDING"].map((state) => `<option value="${state}" ${e.state === state ? "selected" : ""}>${tx("trade.paymentState." + state)}</option>`).join("")}</select>
      <input placeholder="${tx("input.paymentEvidenceSource")}" value="${esc(e.source)}" data-pe-source="${i}">
      <input placeholder="${tx("input.paymentEvidenceFragment")}" value="${esc(e.fragment)}" data-pe-fragment="${i}">
      <input placeholder="${tx("input.paymentEvidenceAsOf")}" value="${esc(e.asOf)}" data-pe-asof="${i}">
      <label><input type="checkbox" data-pe-confirmed="${i}" ${e.humanStatus === "CONFIRMED_BY_OWNER" ? "checked" : ""}> ${tx("input.ownerConfirmed")}</label>
      <button type="button" class="x" data-pe-del="${i}" aria-label="${tx("input.delete")}">✕</button>
    </div>`).join("");
  $("payment-evidence-rows").innerHTML = evidenceRows;
  wirePaymentEvidenceList();
}

function wirePaymentEvidenceList() {
  document.querySelectorAll("[data-pe-state],[data-pe-label],[data-pe-source],[data-pe-fragment],[data-pe-asof],[data-pe-confirmed]").forEach((el) => el.addEventListener("change", (event) => {
    const key = Object.keys(event.target.dataset).find((item) => item.startsWith("pe"));
    const i = Number(event.target.dataset[key]);
    const item = window.__paymentEvidence[i];
    if (!item) return;
    const field = key.replace(/^pe/, "").replace(/^./, (char) => char.toLowerCase());
    if (field === "state") item.state = event.target.value;
    else if (["label", "source", "fragment", "asof"].includes(field)) item[field === "asof" ? "asOf" : field] = event.target.value;
    else if (field === "confirmed") item.humanStatus = event.target.checked ? "CONFIRMED_BY_OWNER" : "PENDING_REVIEW";
  }));
  document.querySelectorAll("[data-pe-del]").forEach((el) => el.addEventListener("click", (event) => { const i = Number(event.target.dataset.peDel); window.__paymentEvidence.splice(i, 1); rerenderLists(); }));
  const add = document.querySelector('[data-add="pe"]');
  if (add) add.addEventListener("click", () => { window.__paymentEvidence.push({ label: "", state: "UNKNOWN", source: "", fragment: "", humanStatus: "PENDING_REVIEW" }); rerenderLists(); });
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
  current.commercialContext = input.commercialContext;
  current.economics = input.economics;
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

  // memo-style status counts (presentation only — derived from existing engine output)
  // "Control items" is precise: contradictions / weak evidence / UNKNOWNs govern the
  // position but are not all vetoes — the term avoids implying every item blocks.
  const nControl = g.materialContradictions.length + (g.termsIncomplete ? 1 : 0) + g.blockingUnknowns.length + (g.weakEvidence || g.strongEvidence === false ? 1 : 0);
  const nUnknown = g.blockingUnknowns.length;
  const nextBestAction = next.length ? localizeEvidenceText(next[0], language) : tx("next.nothingBlocks");

  $("result-rec").innerHTML = `
    <div id="result-decision" class="dl-decision">
      <div class="glance-rec">
        <span class="muted dl-label">${tx("result.recommendation")}</span>
        <span class="rec-tag ${tagClass(g.recommended)}">${stateLabel(g.recommended)}</span>
        <span class="muted dl-deterministic">${tx("result.deterministic")}</span>
      </div>
      <div class="dl-counts"><b>${nControl}</b> ${tx("result.controlItems")} · <b>${nUnknown}</b> ${tx("status.unknown")}</div>
    </div>
    <div id="result-control" class="dl-grid">
      <div class="glance-col"><h4>${tx("result.why")}</h4><ul>${g.reasons.map((r) => `<li>${esc(localizeReason(r, language, current.quoteComparabilityAssessed !== false))}</li>`).join("")}</ul></div>
      <div class="glance-col"><h4>${tx("result.controlItems")}</h4>${g.materialContradictions.length || g.termsIncomplete || g.blockingUnknowns.length ? `<ul>${[
        ...g.materialContradictions.map((c) => `<li>${tx("result.materialContradiction")}: ${esc(c.label)} (${tx("result.unresolved")})</li>`),
        ...(g.termsIncomplete ? [`<li>${tx("result.termsIncomplete")}</li>`] : []),
        ...g.blockingUnknowns.map((u) => `<li>${tx("result.blockingUnknown")}: ${esc(u.label)}</li>`),
        ...(g.weakEvidence ? [`<li>${tx("result.evidenceLow")}</li>`] : []),
      ].join("")}</ul>` : `<span class="muted">${tx("result.noBlockers")}</span>`}</div>
    </div>
    <div class="dl-next-move">
      <span class="muted dl-label">${tx("result.nextBestAction")}</span>
      <strong>${esc(nextBestAction)}</strong>
    </div>
    <div class="dl-grid">
      <div class="glance-col"><h4>${tx("result.missing")}</h4><ul>${[
        ...g.blockingUnknowns.map((u) => `<li>${esc(u.label)}</li>`),
        ...(g.weakEvidence || g.strongEvidence === false ? [`<li>Evidence quality not strong</li>`] : []),
        ...(g.kycGate === "ABSENT" && mode === "blank" ? [`<li>${tx("input.kyc")} — ${tx("result.notAssessed")}</li>`] : []),
        ...(g.marginGate === "ABSENT" && mode === "blank" ? [`<li>${tx("input.margin")} — ${tx("result.notAssessed")}</li>`] : []),
        ...(current.quoteComparabilityAssessed === false ? [`<li>${tx("input.quoteComparability")} — ${tx("result.notAssessed")}</li>`] : []),
      ].join("") || `<span class="muted">${tx("result.none")}</span>`}</ul></div>
      <div class="glance-col"><h4>${tx("result.contradictions")}</h4>${current.contradictions.length ? `<ul>${current.contradictions.map((c) => `<li>${esc(c.label)}${c.material ? ` (${tx("input.material")})` : ""} — ${c.status === "RESOLVED" ? tx("input.resolved") : tx("result.unresolved")}</li>`).join("")}</ul>` : `<span class="muted">${tx("result.noneRecorded")}</span>`}</div>
    </div>
    <div class="dl-grid dl-next">
      <div class="glance-col"><h4>${tx("result.verifyNext")}</h4>${next.length ? `<ul>${next.map((n) => `<li>${esc(localizeEvidenceText(n, language))}</li>`).join("")}</ul>` : `<span class="muted">${tx("result.noFurtherEvidence")}</span>`}</div>
      <div class="glance-col"><h4>${tx("result.wouldChange")}</h4><ul>${wouldChange.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
    </div>
    <p class="glance-note dl-note">${tx("boundary.note")}</p>
  `;

  const commercialView = buildCommercialViewModel(current, g, decisionPathExperiment);
  const tradeView = buildTradeDealViewModel(current, g);
  const economicsInput = current.economics || {};
  const economics = buildEconomicsBridge(economicsInput);
  const momentum = buildCommercialMomentum(current, economics);
  const coverage = buildEvidenceCoverage(current, economics);
  renderExecutiveSnapshot({
    economics,
    tradeView,
    momentum,
    coverage,
    nextBestAction,
    control: g.reasons.length ? localizeReason(g.reasons[0], language, current.quoteComparabilityAssessed !== false) : tx("context.unknown"),
  });
  renderEconomicsBridge(economics, economicsInput.currency || "CNY");
  renderPriorityActions(commercialView);
  renderNegotiationPrep(tradeView);
  renderCommercialStructure(commercialView);
  renderCommercialContext({
    ...(current.commercialContext || {}),
    revenue: current.economics?.revenue,
    currency: current.economics?.currency,
  });
  renderTradeDeal(tradeView);
  renderDecisionPath();
  $("export-status").textContent = tx("export.ready") + " " + current.name;

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
$("btn-export-md").addEventListener("click", () => exportCurrentDealBrief("md"));
$("btn-export-txt").addEventListener("click", () => exportCurrentDealBrief("txt"));

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
