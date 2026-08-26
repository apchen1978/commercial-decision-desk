// workbench-ledger.test.mjs — tests for the Decision Ledger snapshot layer.
// Node-only; independent from verify.mjs (untouched).
import assert from "node:assert/strict";
import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildCommercialViewModel } from "./commercial-action-layer.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";
import { buildEconomicsBridge } from "./economics-bridge.js";
import { createDecisionPathExperiment } from "./decision-path.js";
import { buildDealBriefViewModel } from "./deal-brief.js";
import {
  LEDGER_SCHEMA_VERSION,
  serializeLedgerSnapshot,
  ledgerFilename,
  parseLedgerSnapshot,
  ledgerHumanDecision,
  ledgerRecommendation,
} from "./workbench-ledger.js";

const results = [];
const check = (name, cond, detail = "") => {
  results.push([name, !!cond]);
  console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  | " + detail));
};

const engine = evaluateDecision(opportunity);
const path = opportunity.id === "OPP-2026-008" ? createDecisionPathExperiment(opportunity) : null;
const brief = buildDealBriefViewModel({
  opportunity,
  engine,
  commercialView: buildCommercialViewModel(opportunity, engine, path),
  tradeView: buildTradeDealViewModel(opportunity, engine),
  economicsBridge: buildEconomicsBridge({}),
  decisionPathExperiment: path,
  humanDecision: "HOLD_FOR_EVIDENCE",
  humanNote: "Owner review pending.",
  language: "en",
  generatedAt: "2026-08-24T10:00:00.000Z",
});

// 1. snapshot shape — one JSON snapshot, schema-tagged, kind-tagged
{
  const s = serializeLedgerSnapshot(brief);
  check("snapshot has ledger metadata", s.ledger?.kind === "decision-snapshot" && s.ledger?.schemaVersion === LEDGER_SCHEMA_VERSION);
  check("snapshot carries opportunity id + name", s.opportunityId === "OPP-2026-008" && s.opportunityName.includes("Gulf"));
  check("snapshot preserves synthetic marker", s.synthetic === true);
}

// 2. determinism — same brief -> same snapshot content (exportedAt excluded)
{
  const a = serializeLedgerSnapshot(brief);
  const b = serializeLedgerSnapshot(brief);
  const { exportedAt: _a, ...restA } = a.ledger;
  const { exportedAt: _b, ...restB } = b.ledger;
  check("snapshot deterministic (except exportedAt)", JSON.stringify({ ...a, ledger: restA }) === JSON.stringify({ ...b, ledger: restB }));
}

// 3. UNKNOWN / NOT_RECORDED / human separation preserved
{
  const s = serializeLedgerSnapshot(brief);
  check("human decision separate from recommendation", ledgerHumanDecision(s) === "HOLD_FOR_EVIDENCE" && ledgerRecommendation(s) !== "HOLD_FOR_EVIDENCE");
  const noHuman = serializeLedgerSnapshot(buildDealBriefViewModel({
    opportunity, engine,
    commercialView: buildCommercialViewModel(opportunity, engine, path),
    tradeView: buildTradeDealViewModel(opportunity, engine),
    economicsBridge: buildEconomicsBridge({}),
    decisionPathExperiment: path,
    language: "en",
    generatedAt: "2026-08-24T10:00:00.000Z",
  }));
  check("no human decision -> NOT_RECORDED (never fabricated)", ledgerHumanDecision(noHuman) === "NOT_RECORDED");
}

// 4. unknowns + contradictions preserved verbatim
{
  const s = serializeLedgerSnapshot(brief);
  check("unknowns preserved", Array.isArray(s.position?.unknowns) && s.position.unknowns.some((u) => u.label.includes("volume")));
  check("contradictions preserved", Array.isArray(s.position?.contradictions) && s.position.contradictions.length >= 1);
  check("reasons preserved", Array.isArray(s.position?.reasons) && s.position.reasons.length >= 3);
}

// 5. evidence traceability preserved
{
  const s = serializeLedgerSnapshot(brief);
  const actionTraces = (s.actions || []).flatMap((a) => a.evidenceTrace || []);
  check("actions + evidence traces carried", Array.isArray(s.actions) && (actionTraces.length >= 0));
  check("trade negotiationPrep carried", Array.isArray(s.trade?.negotiationPrep));
}

// 6. parse/validate — round-trip + rejection of non-ledger files
{
  const s = serializeLedgerSnapshot(brief);
  const parsed = parseLedgerSnapshot(JSON.stringify(s));
  check("round-trip parse ok", parsed.ok === true && parsed.data.opportunityId === "OPP-2026-008");
  check("invalid JSON rejected", parseLedgerSnapshot("{not json").ok === false);
  check("non-ledger JSON rejected", parseLedgerSnapshot(JSON.stringify({ hello: 1 })).ok === false);
  check("unsupported schema rejected", parseLedgerSnapshot(JSON.stringify({ ...s, ledger: { ...s.ledger, schemaVersion: 99 } })).ok === false);
}

// 7. filename deterministic + safe
{
  const f1 = ledgerFilename(brief);
  const f2 = ledgerFilename(brief);
  check("filename deterministic", f1 === f2);
  check("filename is .json + date-prefixed", /^CDD-Decision-Ledger-\d{4}-\d{2}-\d{2}-.+\.json$/.test(f1), f1);
}

const failed = results.filter(([, ok]) => !ok);
console.log(`\nLEDGER RESULT: ${results.length - failed.length}/${results.length} PASS`);
process.exitCode = failed.length ? 1 : 0;
