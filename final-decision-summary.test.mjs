import assert from "node:assert/strict";
import { buildFinalDecisionSummaryState } from "./final-decision-summary.js";
import { buildDealBriefViewModel, serializeDealBriefMarkdown } from "./deal-brief.js";
import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildCommercialViewModel } from "./commercial-action-layer.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";
import { buildEconomicsBridge } from "./economics-bridge.js";

const states = ["PURSUE_NOW", "PURSUE_CONDITIONALLY", "HOLD_FOR_EVIDENCE", "ESCALATE", "DO_NOT_PURSUE"];
for (const decision of states) {
  const state = buildFinalDecisionSummaryState({ humanDecision: decision, humanNote: "Owner note", nextAction: { title: "Action", why: "Reason" } });
  assert.equal(state.active, true);
  assert.equal(state.decision, decision);
  assert.equal(state.note, "Owner note");
  assert.equal(state.nextAction.title, "Action");
}
assert.equal(buildFinalDecisionSummaryState().active, false);
assert.equal(buildFinalDecisionSummaryState({ humanDecision: "HOLD_FOR_EVIDENCE", humanNote: "" }).note, "");
assert.equal(buildFinalDecisionSummaryState({ humanDecision: "HOLD_FOR_EVIDENCE", humanNote: "changed" }).note, "changed");

const engine = evaluateDecision(opportunity);
const brief = buildDealBriefViewModel({ opportunity, engine, commercialView: buildCommercialViewModel(opportunity, engine, null), tradeView: buildTradeDealViewModel(opportunity, engine), economicsBridge: buildEconomicsBridge({}), decisionPathExperiment: null, humanDecision: "HOLD_FOR_EVIDENCE", humanNote: "Wait for acceptance evidence.", language: "en", generatedAt: "2026-08-26T00:00:00.000Z" });
assert.match(serializeDealBriefMarkdown(brief, "en"), /Human decision/);
assert.match(serializeDealBriefMarkdown(brief, "en"), /Wait for acceptance evidence/);
console.log("PASS final decision summary state + Deal Brief consistency");
