// Canonical Deal Brief view model and export serializers.
// Presentation-only: reads existing CDD evidence and outputs. It does not
// evaluate decisions, add gates, infer missing values, or persist data.
import { presentReason, stateLabels, t } from "./i18n.js";

const UNKNOWN = "UNKNOWN";

const valueOrUnknown = (value) => value === "" || value === null || value === undefined ? UNKNOWN : String(value);
const listOrEmpty = (value) => Array.isArray(value) ? value : [];
const clean = (value) => String(valueOrUnknown(value)).replace(/\r?\n/g, " ").trim();
const clone = (value) => JSON.parse(JSON.stringify(value));

function missingContext(context) {
  const fields = [
    ["product", "brief.product"],
    ["buyerCompany", "brief.buyer"],
    ["market", "brief.market"],
    ["quantity", "brief.quantity"],
    ["timing", "brief.timing"],
  ];
  return fields.filter(([field]) => context?.[field] === "" || context?.[field] === undefined || context?.[field] === null)
    .map(([, label]) => label);
}

function positionData(opportunity, engine, language) {
  const contradictions = listOrEmpty(opportunity.contradictions).filter((item) => item.status !== "RESOLVED");
  const blockers = [
    ...listOrEmpty(engine.materialContradictions).map((item) => ({ kind: "contradiction", label: item.label })),
    ...(engine.termsIncomplete ? [{ kind: "rule", label: t("brief.termsIncomplete", language) }] : []),
    ...listOrEmpty(engine.blockingUnknowns).map((item) => ({ kind: "unknown", label: item.label })),
    ...(engine.weakEvidence || engine.strongEvidence === false ? [{ kind: "evidence", label: t("brief.evidenceNotStrong", language) }] : []),
    ...(engine.kycGate === "KYC_INCOMPLETE" ? [{ kind: "gate", label: t("brief.kycIncomplete", language) }] : []),
    ...(engine.kycGate === "SANCTIONS_VETO" ? [{ kind: "gate", label: t("brief.kycVeto", language) }] : []),
    ...(engine.marginGate === "BELOW_THRESHOLD" ? [{ kind: "gate", label: t("brief.marginBelow", language) }] : []),
    ...(!engine.exposure?.computed ? [{ kind: "unknown", label: t("brief.paymentExposureUnknown", language) }] : []),
  ];
  const unknowns = [
    ...listOrEmpty(opportunity.unknowns).map((item) => ({ label: item.label, source: "UNKNOWN evidence" })),
    ...missingContext(opportunity.commercialContext || {}).map((label) => ({ label: t(label, language), source: "Commercial context" })),
  ];
  return {
    recommendation: engine.recommended,
    reasons: listOrEmpty(engine.reasons),
    blockers,
    unknowns,
    contradictions: contradictions.map((item) => ({ label: item.label, material: item.material, status: item.status })),
    exposure: engine.exposure || { computed: false, totalCommittedCny: null },
  };
}

function snapshotData(opportunity) {
  const context = opportunity.commercialContext || {};
  const economics = opportunity.economics || {};
  return {
    name: valueOrUnknown(opportunity.name),
    product: valueOrUnknown(context.product),
    buyer: valueOrUnknown(context.buyerCompany),
    market: valueOrUnknown(context.market),
    quantity: quantityDisplay(context.quantity, context.quantityUnit),
    revenue: valueOrUnknown(economics.revenue),
    currency: valueOrUnknown(economics.currency),
    timing: valueOrUnknown(context.timing),
    relationship: valueOrUnknown(context.relationship),
    source: valueOrUnknown(context.source),
  };
}

// Quantity + unit presentation semantics for the Deal Brief (MD and TXT):
//   quantity + unit      -> "120 metres"
//   quantity, no unit    -> "120 (unit UNKNOWN)"
//   unit, no quantity    -> UNKNOWN
//   neither              -> UNKNOWN
// Presentation evidence only; never a Decision Core input.
function quantityDisplay(qty, unit) {
  const hasQty = qty !== "" && qty !== null && qty !== undefined;
  const hasUnit = unit !== "" && unit !== null && unit !== undefined;
  if (hasQty && hasUnit) return String(qty) + " " + String(unit);
  if (hasQty) return String(qty) + " (unit UNKNOWN)";
  return UNKNOWN;
}

function economicsData(opportunity, bridge) {
  const input = opportunity.economics || {};
  return {
    revenue: bridge?.revenue ?? null,
    directCost: bridge?.directCost ?? null,
    tradeCost: bridge?.tradeCost ?? null,
    dealSpecificCost: bridge?.dealSpecificCost ?? null,
    contingency: bridge?.contingency ?? null,
    expectedNetContribution: bridge?.expectedNetContribution ?? null,
    minimumNetContribution: bridge?.minimumNetContribution ?? null,
    gap: bridge?.gap ?? null,
    currency: valueOrUnknown(input.currency),
    calculated: bridge?.calculationStatus === "CALCULATED",
    missing: ["revenue", "directCost", "tradeCost", "dealSpecificCost", "contingency"].filter((key) => bridge?.[key] === null || bridge?.[key] === undefined),
  };
}

function tradeData(tradeView) {
  const structure = tradeView?.structure || {};
  const payment = structure.payment || {};
  const delivery = structure.delivery || {};
  return {
    payment: {
      termsStatus: valueOrUnknown(payment.termsStatus),
      termsDetail: valueOrUnknown(payment.termsDetail),
      exposure: payment.exposure,
      exposureStatus: valueOrUnknown(payment.exposureStatus),
      events: listOrEmpty(payment.events),
    },
    delivery: {
      declaredTerm: valueOrUnknown(delivery.declaredTerm),
      responsibilityBoundary: valueOrUnknown(delivery.responsibilityBoundary),
      evidenceRequired: valueOrUnknown(delivery.evidenceRequired),
    },
    negotiationPrep: listOrEmpty(tradeView?.negotiationPrep).map((item) => ({
      type: item.type,
      question: item.question,
      request: item.request,
      avoidCommitment: item.avoidCommitment,
      ownerInput: item.ownerInput,
      rerunWhen: item.rerunWhen,
      evidenceTrace: clone(item.evidenceTrace || []),
    })),
  };
}

function actionData(commercialView) {
  return listOrEmpty(commercialView?.actions).map((item) => ({
    actionType: item.actionType,
    priority: item.priority,
    evidenceTrace: clone(item.evidenceTrace || []),
    rerunWhen: item.rerunWhen,
  }));
}

function decisionPathData(experiment) {
  if (!experiment) return { available: false, current: null, paths: [] };
  return {
    available: true,
    current: experiment.current?.recommended || null,
    paths: listOrEmpty(experiment.paths).map((path) => ({
      id: path.id,
      proposition: path.manifest?.proposition,
      sourceRequirement: path.manifest?.sourceRequirement,
      current: path.current?.recommended,
      hypothetical: path.hypothetical?.recommended,
      decisionChanged: Boolean(path.comparison?.decisionChanged),
      stillBlocks: listOrEmpty(path.stillBlocks).map((item) => item.label),
      humanBoundary: path.humanBoundary,
    })),
  };
}

export function buildDealBriefViewModel({ opportunity, engine, commercialView, tradeView, economicsBridge, decisionPathExperiment, humanDecision, humanNote, language = "zh-TW", generatedAt = new Date().toISOString() }) {
  const position = positionData(opportunity, engine, language);
  const economics = economicsData(opportunity, economicsBridge);
  const trade = tradeData(tradeView);
  const context = opportunity.commercialContext || {};
  return {
    generatedAt,
    opportunityId: valueOrUnknown(opportunity.id),
    synthetic: opportunity.synthetic === true,
    snapshot: snapshotData(opportunity),
    position,
    economics,
    trade,
    actions: actionData(commercialView),
    decisionPath: decisionPathData(decisionPathExperiment),
    humanDecision: humanDecision || null,
    humanNote: humanNote || "",
    authority: {
      contactRole: valueOrUnknown(context.contactRole),
      purchasingAuthority: valueOrUnknown(context.purchasingAuthority),
      technicalAuthority: valueOrUnknown(context.technicalAuthority),
      finalApprover: valueOrUnknown(context.finalApprover),
      accessDecisionMaker: valueOrUnknown(context.accessDecisionMaker),
    },
    boundary: "This brief supports a human decision. It does not approve, reject, quote, or commit. Human approval is required before external action.",
  };
}

function label(key, language) { return t(`brief.${key}`, language); }
function stateLabel(state, language) { return state ? (stateLabels(language)[state] || state) : UNKNOWN; }
function line(labelText, value) { return `${labelText}: ${clean(value)}`; }
function bullet(value) { return `- ${clean(value)}`; }
function money(value, currency) {
  if (value === null || value === undefined) return UNKNOWN;
  return `${value}${currency && currency !== UNKNOWN ? ` ${currency}` : ""}`;
}
function traceLines(traces, language) {
  return listOrEmpty(traces).map((item) => `${label("trace", language)}: ${clean(item.label || item.sourceId || UNKNOWN)} (${clean(item.sourceType || UNKNOWN)})`);
}

function actionTitle(action, language) { return t(`action.${action.actionType}`, language); }
function prepTitle(item, language) { return t(`trade.prep.${item.type}`, language); }
function exportReason(reason, language) {
  return clean(presentReason(reason, language))
    .replace(/\b[A-Z]{2,}-\d+\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\(\s*(?:,\s*)+\)/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function serializeDealBriefMarkdown(brief, language = "zh-TW") {
  const s = brief.snapshot;
  const p = brief.position;
  const e = brief.economics;
  const tData = brief.trade;
  const agenda = tData.negotiationPrep.length ? tData.negotiationPrep.map((item) => bullet(`${prepTitle(item, language)} — ${clean(item.question)}`)) : [bullet(label("noMeetingAgenda", language))];
  const evidence = tData.negotiationPrep.flatMap((item) => [clean(item.request), ...traceLines(item.evidenceTrace, language)]);
  const noCommit = tData.negotiationPrep.length ? tData.negotiationPrep.map((item) => bullet(`${prepTitle(item, language)}: ${clean(item.avoidCommitment)}`)) : [bullet(label("noCommitment", language))];
  const rerun = [...tData.negotiationPrep.map((item) => item.rerunWhen), ...brief.actions.map((item) => item.rerunWhen)].filter(Boolean);
  const unknowns = [...p.unknowns.map((item) => `${clean(item.label)} — ${clean(item.source)}`), ...e.missing.map((item) => `${label(item, language)} — ${label("economicsMissing", language)}`)];
  const actionBlocks = brief.actions.length ? brief.actions.flatMap((item) => [
    `### ${String(item.priority).padStart(2, "0")} ${actionTitle(item, language)}`,
    line(label("evidenceTrace", language), item.evidenceTrace.length ? item.evidenceTrace.map((trace) => clean(trace.label)).join("; ") : UNKNOWN),
    line(label("rerunWhen", language), item.rerunWhen),
  ]) : [label("noPriorityActions", language)];
  const pathBlocks = brief.decisionPath.available ? brief.decisionPath.paths.map((path) => bullet(`${path.id}: ${clean(path.proposition)} — ${stateLabel(path.current, language)} → ${stateLabel(path.hypothetical, language)}${path.decisionChanged ? ` (${label("decisionMayChange", language)})` : ""}`)) : [bullet(label("noDecisionPath", language))];
  const generated = new Date(brief.generatedAt).toLocaleString(language === "zh-TW" ? "zh-TW" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  return [
    "# CDD DEAL BRIEF",
    `## ${clean(s.name)}`,
    "",
    line(label("market", language), s.market),
    line(label("buyer", language), s.buyer),
    line(label("product", language), s.product),
    line(label("quantity", language), s.quantity),
    line(label("generated", language), generated),
    "",
    `## ${label("executiveSnapshot", language)}`,
    line(label("recommendation", language), stateLabel(p.recommendation, language)),
    line(label("currentControl", language), p.blockers.length ? p.blockers.map((item) => clean(item.label)).join("; ") : label("noOpenControl", language)),
    line(label("nextMeeting", language), tData.negotiationPrep.length ? tData.negotiationPrep.map((item) => clean(item.question)).join(" | ") : label("noMeetingAgenda", language)),
    line(label("doNotCommit", language), tData.negotiationPrep.length ? tData.negotiationPrep.map((item) => clean(item.avoidCommitment)).join(" | ") : label("noCommitment", language)),
    line(label("humanDecision", language), brief.humanDecision ? stateLabel(brief.humanDecision, language) : label("notRecorded", language)),
    "",
    `## ${label("currentPosition", language)}`,
    line(label("why", language), p.reasons.length ? p.reasons.map((reason) => exportReason(reason, language)).join(" | ") : UNKNOWN),
    `### ${label("blockers", language)}`,
    ...(p.blockers.length ? p.blockers.map((item) => bullet(item.label)) : [bullet(label("noOpenControl", language))]),
    `### ${label("unknowns", language)}`,
    ...(unknowns.length ? unknowns.map(bullet) : [bullet(label("noneRecorded", language))]),
    `### ${label("contradictions", language)}`,
    ...(p.contradictions.length ? p.contradictions.map((item) => bullet(`${item.label} — ${item.status}`)) : [bullet(label("noneRecorded", language))]),
    "",
    `## ${label("economics", language)}`,
    line(label("revenue", language), money(e.revenue, e.currency)),
    line(label("directCost", language), money(e.directCost, e.currency)),
    line(label("tradeCost", language), money(e.tradeCost, e.currency)),
    line(label("dealSpecificCost", language), money(e.dealSpecificCost, e.currency)),
    line(label("contingency", language), money(e.contingency, e.currency)),
    line(label("expectedNetContribution", language), e.calculated ? money(e.expectedNetContribution, e.currency) : label("notCalculated", language)),
    line(label("ownerMinimum", language), money(e.minimumNetContribution, e.currency)),
    label("economicsBoundary", language),
    "",
    `## ${label("tradeStructure", language)}`,
    line(label("paymentTerms", language), tData.payment.termsStatus),
    line(label("paymentExposure", language), tData.payment.exposure === null ? UNKNOWN : `${tData.payment.exposure} CNY`),
    line(label("deliveryTerm", language), tData.delivery.declaredTerm),
    line(label("responsibility", language), tData.delivery.responsibilityBoundary),
    line(label("evidenceRequired", language), tData.delivery.evidenceRequired),
    "",
    `## ${label("meetingAgenda", language)}`,
    ...agenda,
    `### ${label("evidenceToObtain", language)}`,
    ...(evidence.length ? evidence.map(bullet) : [bullet(label("noneRecorded", language))]),
    `### ${label("doNotCommitSection", language)}`,
    ...noCommit,
    "",
    `## ${label("priorityActions", language)}`,
    ...actionBlocks,
    "",
    `## ${label("negotiationPrep", language)}`,
    ...(tData.negotiationPrep.length ? tData.negotiationPrep.flatMap((item) => [
      `### ${prepTitle(item, language)}`,
      line(label("ask", language), item.question),
      line(label("obtain", language), item.request),
      line(label("doNotCommit", language), item.avoidCommitment),
      line(label("humanBoundary", language), item.ownerInput),
    ]) : [label("noNegotiationPrep", language)]),
    "",
    `## ${label("decisionPath", language)}`,
    ...pathBlocks,
    "",
    `## ${label("rerunWhen", language)}`,
    ...(rerun.length ? [...new Set(rerun.map(clean))].map(bullet) : [bullet(label("noRerun", language))]),
    "",
    `## ${label("ownerNotes", language)}`,
    brief.humanNote ? brief.humanNote : label("notRecorded", language),
    "",
    `## ${label("humanBoundary", language)}`,
    brief.boundary,
    brief.synthetic ? label("syntheticNote", language) : label("manualNote", language),
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function serializeDealBriefText(brief, language = "zh-TW") {
  return serializeDealBriefMarkdown(brief, language)
    .replace(/^# /gm, "")
    .replace(/^## /gm, "\n")
    .replace(/^### /gm, "\n")
    .replace(/^\- /gm, "  • ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

export function sanitizeDealBriefFilename(name, extension = "md") {
  const safe = String(name || "untitled-opportunity")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80) || "untitled-opportunity";
  return `CDD-Deal-Brief-${safe}.${extension}`;
}

export function downloadDealBrief(brief, format, language = "zh-TW") {
  const isText = format === "txt";
  const content = isText ? serializeDealBriefText(brief, language) : serializeDealBriefMarkdown(brief, language);
  const filename = sanitizeDealBriefFilename(brief.snapshot.name, isText ? "txt" : "md");
  const blob = new Blob([content], { type: isText ? "text/plain;charset=utf-8" : "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { filename, content };
}
