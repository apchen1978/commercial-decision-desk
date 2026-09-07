// boss-three.test.mjs — "三問速答" Batch 1: honest owner-language derivation.
// Asserts the module only re-states existing evidence (sample fixture + blank
// minimal shape) and never fabricates capacity, payment guarantees, or a
// recommendation. decision-engine.js must remain untouched by these reads.
import assert from "node:assert/strict";
import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";
import { buildEconomicsBridge } from "./economics-bridge.js";
import { bossCollect, bossFinish, bossInvest, buildBossThree } from "./boss-three.js";

// --- Q1 收款: status mirrors payment evidence; UNKNOWN never becomes a claim ---
{
  const g = evaluateDecision(opportunity);
  const tv = buildTradeDealViewModel(opportunity, g);
  const r = bossCollect(tv.structure.paymentEvidence);
  assert.equal(r.tone, "warn", "sample payment terms are NOT_CONFIRMED -> warn");
  assert.equal(r.chipKey, "boss.q1.chip.notConfirmed");
  assert.ok(r.args.n === 2, "sample has 2 unresolved payment-evidence items");
  console.log("PASS Q1 sample: NOT_CONFIRMED with 2 unresolved items");
}
{
  const binding = { status: "BINDING", unresolvedCount: 0 };
  const r = bossCollect(binding);
  assert.equal(r.tone, "ok");
  assert.equal(r.chipKey, "boss.q1.chip.binding");
  console.log("PASS Q1 binding -> ok");
}
{
  const none = { status: "UNKNOWN", unresolvedCount: 0 };
  const r = bossCollect(none);
  assert.equal(r.tone, "unk");
  assert.equal(r.chipKey, "boss.q1.chip.unknown");
  console.log("PASS Q1 no evidence -> unk (no invented claim)");
}

// --- Q2 完工: declared term + recorded timing restated; capacity never claimed -
{
  const r = bossFinish({ declaredTerm: "CIF", confirmed: true }, "First shipment target: 15 Sep 2026 (synthetic)");
  assert.equal(r.tone, "warn", "declared term with target timing is partial, never ok");
  assert.equal(r.answerKey, "boss.q2.answer.declaredTiming");
  assert.equal(r.args.term, "CIF");
  console.log("PASS Q2 declared CIF + timing -> declaredTiming (partial)");
}
{
  const r = bossFinish({ declaredTerm: "notAssessed" }, "");
  assert.equal(r.tone, "unk");
  assert.equal(r.answerKey, "boss.q2.answer.none");
  console.log("PASS Q2 nothing recorded -> none/UNKNOWN");
}
{
  const r = bossFinish({ declaredTerm: "CIF" }, "");
  assert.equal(r.answerKey, "boss.q2.answer.declared");
  console.log("PASS Q2 term only -> declared without timing");
}

// --- Q3 投入: recommendation mirrored; engine output unchanged by reads -------
{
  const g = evaluateDecision(opportunity);
  const r = bossInvest(g.recommended, 4);
  assert.equal(r.chipKey, "boss.q3.chip.esc", "sample recommends ESCALATE");
  assert.equal(r.args.controls, 4);
  // engine untouched: evaluating again is byte-stable
  const again = evaluateDecision(opportunity);
  assert.equal(again.recommended, g.recommended);
  console.log("PASS Q3 sample ESCALATE mirrors engine");
}
{
  const r = bossInvest("HOLD_FOR_EVIDENCE", 2);
  assert.equal(r.chipKey, "boss.q3.chip.hold");
  const r2 = bossInvest("PURSUE_NOW", 0);
  assert.equal(r2.chipKey, "boss.q3.chip.now");
  const r3 = bossInvest("DO_NOT_PURSUE", 1);
  assert.equal(r3.chipKey, "boss.q3.chip.drop");
  console.log("PASS Q3 state mapping hold/now/drop");
}

// --- buildBossThree: full sample assembly + economics line (real numbers) -----
{
  const g = evaluateDecision(opportunity);
  const tv = buildTradeDealViewModel(opportunity, g);
  const eco = buildEconomicsBridge(opportunity.economics || {});
  const nControl = g.materialContradictions.length + (g.termsIncomplete ? 1 : 0) + g.blockingUnknowns.length + (g.weakEvidence || g.strongEvidence === false ? 1 : 0);
  const view = buildBossThree({
    paymentEvidence: tv.structure.paymentEvidence,
    delivery: tv.structure.delivery,
    timing: opportunity.commercialContext?.timing || "",
    recommended: g.recommended,
    controls: nControl,
    economics: eco,
    currency: opportunity.economics?.currency || "CNY",
  });
  assert.equal(view.rows.length, 3);
  assert.deepEqual(view.rows.map((row) => row.id), ["q1", "q2", "q3"]);
  assert.equal(view.rows[0].chipKey, "boss.q1.chip.notConfirmed");
  assert.equal(view.rows[1].chipKey, "boss.q2.chip.declared");
  assert.equal(view.rows[2].chipKey, "boss.q3.chip.esc");
  assert.ok(view.economicsLine, "sample economics is CALCULATED");
  assert.equal(view.economicsLine.net, 120000);
  assert.equal(view.economicsLine.min, 96000);
  assert.equal(view.economicsLine.currency, "USD");
  console.log("PASS buildBossThree sample: 3 rows + real economics line");
}

// --- Minimal blank shape (no data): every row stays honest UNKNOWN ------------
{
  const blank = {
    id: "B", name: "x", synthetic: false, commercialContext: {},
    commercialTerms: { status: "INCOMPLETE", detail: "", paymentEvidence: [] },
    dimensions: {
      buyerFit: { value: "UNKNOWN", evidence: [] }, categoryFit: { value: "UNKNOWN", evidence: [] },
      evidenceQuality: { value: "UNKNOWN", evidence: [] }, importOpenness: { value: "UNKNOWN", evidence: [] },
    },
    contradictions: [], unknowns: [], paymentEvents: [], kyc: { status: "notAssessed" },
  };
  const g = evaluateDecision(blank);
  const tv = buildTradeDealViewModel(blank, g);
  const view = buildBossThree({
    paymentEvidence: tv.structure.paymentEvidence,
    delivery: tv.structure.delivery,
    timing: "",
    recommended: g.recommended,
    controls: 1,
    economics: buildEconomicsBridge({}),
  });
  assert.equal(view.rows[0].tone, "unk", "blank: no payment evidence -> unk");
  assert.equal(view.rows[1].answerKey, "boss.q2.answer.none", "blank: no delivery/timing -> none");
  assert.ok(!view.economicsLine, "blank: no numbers -> no economics line");
  console.log(`PASS blank minimal: q1 unk, q2 none, recommended=${g.recommended}`);
}

console.log("boss-three.test.mjs: all PASS");
