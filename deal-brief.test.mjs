import assert from "node:assert/strict";
import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildCommercialViewModel } from "./commercial-action-layer.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";
import { buildEconomicsBridge } from "./economics-bridge.js";
import { createDecisionPathExperiment } from "./decision-path.js";
import {
  buildDealBriefViewModel,
  sanitizeDealBriefFilename,
  serializeDealBriefMarkdown,
  serializeDealBriefText,
} from "./deal-brief.js";

const engine = evaluateDecision(opportunity);
const path = opportunity.id === "OPP-2026-008" ? createDecisionPathExperiment(opportunity) : null;
const commercialView = buildCommercialViewModel(opportunity, engine, path);
const tradeView = buildTradeDealViewModel(opportunity, engine);
const brief = buildDealBriefViewModel({
  opportunity,
  engine,
  commercialView,
  tradeView,
  economicsBridge: buildEconomicsBridge({}),
  decisionPathExperiment: path,
  humanDecision: "HOLD_FOR_EVIDENCE",
  humanNote: "Owner review pending.",
  language: "en",
  generatedAt: "2026-08-24T10:00:00.000Z",
});

function pass(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

pass("brief is stand-alone and executive-readable", () => {
  const md = serializeDealBriefMarkdown(brief, "en");
  assert.match(md, /CDD DEAL BRIEF/);
  assert.match(md, /Executive Snapshot/);
  assert.match(md, /Current recommendation/);
  assert.match(md, /Meeting Agenda/);
  assert.match(md, /Human boundary/);
  assert.doesNotMatch(md, /undefined|null/);
});

pass("brief preserves UNKNOWN and economics boundary", () => {
  const md = serializeDealBriefMarkdown(brief, "en");
  assert.match(md, /UNKNOWN/);
  assert.match(md, /NOT CALCULATED/);
  assert.match(md, /does not estimate missing costs/);
});

pass("recommendation and human decision remain separate", () => {
  const md = serializeDealBriefMarkdown(brief, "en");
  assert.match(md, /Current recommendation/);
  assert.match(md, /Human decision/);
  assert.match(md, /HOLD_FOR_EVIDENCE|Hold for evidence/);
});

pass("plain text is readable without markdown syntax", () => {
  const text = serializeDealBriefText(brief, "en");
  assert.match(text, /CDD DEAL BRIEF/);
  assert.doesNotMatch(text, /^#{1,3} /m);
  assert.doesNotMatch(text, /^- /m);
});

pass("filename is sanitized and has a missing-name fallback", () => {
  assert.equal(sanitizeDealBriefFilename("Dubai: Hotel / Group?", "md"), "CDD-Deal-Brief-Dubai-Hotel-Group.md");
  assert.equal(sanitizeDealBriefFilename("", "txt"), "CDD-Deal-Brief-untitled-opportunity.txt");
});

pass("sample keeps synthetic marker and Decision Path", () => {
  assert.equal(brief.synthetic, true);
  assert.equal(brief.decisionPath.available, true);
});

/* ---- Quantity + Unit (Commercial Context presentation evidence only) ---- */

function qtyOpportunity(qty, unit) {
  return {
    ...structuredClone(opportunity),
    id: "QTY-TEST",
    name: "QTY-TEST",
    commercialContext: {
      ...opportunity.commercialContext,
      quantity: qty,
      quantityUnit: unit,
    },
  };
}

function qtyBrief(op) {
  return buildDealBriefViewModel({
    opportunity: op,
    engine: evaluateDecision(op),
    commercialView: buildCommercialViewModel(op, evaluateDecision(op), null),
    tradeView: buildTradeDealViewModel(op, evaluateDecision(op)),
    economicsBridge: buildEconomicsBridge({}),
    decisionPathExperiment: null,
    humanDecision: "HOLD_FOR_EVIDENCE",
    humanNote: "",
    language: "en",
    generatedAt: "2026-08-24T10:00:00.000Z",
  });
}

pass("quantity + unit renders as combined value", () => {
  const md = serializeDealBriefMarkdown(qtyBrief(qtyOpportunity("120", "metres")), "en");
  assert.match(md, /120 metres/);
});

pass("quantity without unit keeps unit UNKNOWN", () => {
  const md = serializeDealBriefMarkdown(qtyBrief(qtyOpportunity("120", "")), "en");
  assert.match(md, /120 \(unit UNKNOWN\)/);
});

pass("unit without quantity stays UNKNOWN", () => {
  const md = serializeDealBriefMarkdown(qtyBrief(qtyOpportunity("", "metres")), "en");
  assert.match(md, /Estimated quantity.*UNKNOWN/);
  assert.doesNotMatch(md, /metres/);
});

pass("quantity unit appears in plain-text export too", () => {
  const text = serializeDealBriefText(qtyBrief(qtyOpportunity("120", "metres")), "en");
  assert.match(text, /120 metres/);
});

pass("quantity unit never enters Decision Core", () => {
  // Decision Core receives the same opportunity shape; unit is presentation-only.
  const op = qtyOpportunity("120", "metres");
  const withUnit = evaluateDecision(op);
  const opNoUnit = qtyOpportunity("120", "");
  const withoutUnit = evaluateDecision(opNoUnit);
  // Same numeric quantity -> identical engine outcome regardless of unit text.
  assert.equal(withUnit.recommended, withoutUnit.recommended);
  assert.deepEqual(withUnit.reasons, withoutUnit.reasons);
});

console.log("DEAL BRIEF RESULT: 11/11 PASS");
