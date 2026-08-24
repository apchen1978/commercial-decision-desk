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

console.log("DEAL BRIEF RESULT: 6/6 PASS");
