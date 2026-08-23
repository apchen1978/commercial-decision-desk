// verify.mjs — automated hard-rule + determinism checks for Commercial Decision Desk.
// Node-only; exercises the pure modules exactly as the browser does.
import { readFileSync } from "node:fs";
import { opportunity, dimensions } from "./fixtures.js";
import { DECISION_STATES, paymentExposure, evaluateDecision, buildBrief } from "./decision-engine.js";

const results = [];
const check = (name, cond, detail = "") => {
  results.push([name, !!cond]);
  console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  | " + detail));
};

// Hard rule 1 — weak Category Fit can never produce PURSUE_NOW.
{
  const weak = { ...opportunity, dimensions: { ...opportunity.dimensions, categoryFit: { value: "WEAK" } } };
  const e = evaluateDecision(weak);
  check("R1 weak category fit cannot PURSUE_NOW", e.available.PURSUE_NOW === false && e.recommended === "DO_NOT_PURSUE");
}

// Hard rule 2 — material contradiction surfaced + blocks PURSUE_NOW, recommends ESCALATE.
{
  const e = evaluateDecision(opportunity);
  check("R2 contradiction visible", e.materialContradictions.length >= 1);
  check("R2 contradiction blocks PURSUE_NOW", e.available.PURSUE_NOW === false);
  check("R2 recommendation is ESCALATE", e.recommended === "ESCALATE");
}

// Hard rule 3 — incomplete terms → HOLD_FOR_EVIDENCE available; UNKNOWN stays.
{
  const e = evaluateDecision(opportunity);
  check("R3 terms incomplete flag", e.termsIncomplete === true);
  check("R3 HOLD_FOR_EVIDENCE available", e.available.HOLD_FOR_EVIDENCE === true);
  const unk = opportunity.unknowns.map((u) => u.label);
  check("R3 UNKNOWN not converted", unk.includes("Final payment terms") && unk.includes("Actual order volume"));
}

// Hard rule 4 — non-comparable quote bases never ranked.
check("R4 quote bases not comparable", opportunity.quoteBasesComparable === false);
{
  const cmp = { ...opportunity, quoteBasesComparable: true };
  const e = evaluateDecision(cmp);
  check("R4 comparable bases allow ranking context", e.quoteBasesComparable === true);
}

// Hard rule 5 — payment exposure only from complete events; incomplete → UNKNOWN.
{
  const e1 = paymentExposure(opportunity.paymentEvents);
  check("R5 exposure computed from complete events", e1.computed === true && e1.totalCommittedCny === 25200 + 58800);
  check("R5 incomplete events reported as UNKNOWN", e1.incompleteCount === 1 && e1.incompleteLabels.includes("Conditional performance bond"));
  const onlyIncomplete = paymentExposure([{ status: "INCOMPLETE" }]);
  check("R5 no complete events → not computed", onlyIncomplete.computed === false && onlyIncomplete.reason.includes("UNKNOWN"));
}

// Hard rule 6 — concentration = commitments only (single buyer share).
{
  const e = paymentExposure(opportunity.paymentEvents);
  check("R6 concentration from commitments only", e.byEvent.reduce((a, x) => a + x.share, 0).toFixed(6) === "1.000000");
}

// Hard rule 7 — disclosure present as NEGATED form; exposure never described AS those.
{
  const forbidden = ["cash balance", "liquidity", "affordability", "cash shortfall", "credit capacity"];
  check("R7 disclosure present", opportunity.paymentDisclosure.includes("committed payment events"));
  const sentence = opportunity.paymentDisclosure.split(".").find((s) => forbidden.some((f) => s.toLowerCase().includes(f)));
  check("R7 forbidden terms only in negated sentence", Boolean(sentence && /\bis not\b/i.test(sentence)));
  check("R7 never described as forbidden terms", !/exposure (is|means|equals) (cash balance|liquidity|affordability|cash shortfall|credit capacity)/i.test(opportunity.paymentDisclosure));
}

// Hard rule 8 — human decision required; brief requires human selection.
{
  const e = evaluateDecision(opportunity);
  const brief = buildBrief(opportunity, "PURSUE_CONDITIONALLY", e);
  check("R8 brief carries human decision + boundary note", brief.humanDecision === "PURSUE_CONDITIONALLY" && brief.boundaryNote.includes("Human approval is always required"));
  check("R8 five decision states exist", DECISION_STATES.length === 5);
}

// Determinism — two runs produce identical results.
{
  const a = JSON.stringify(paymentExposure(opportunity.paymentEvents));
  const b = JSON.stringify(paymentExposure(opportunity.paymentEvents));
  check("determinism payment identical across runs", a === b);
  const e1 = JSON.stringify(evaluateDecision(opportunity));
  const e2 = JSON.stringify(evaluateDecision(opportunity));
  check("determinism recommendation identical across runs", e1 === e2);
}

// Fixture hygiene — no real-looking data, synthetic label present.
{
  const src = readFileSync(new URL("./fixtures.js", import.meta.url), "utf8") + readFileSync(new URL("./README.md", import.meta.url), "utf8");
  check("fixture clearly labeled synthetic", opportunity.id === "OPP-2026-008" && src.includes("SYNTHETIC") && src.includes("fabricated"));
  const emailLike = (readFileSync(new URL("./fixtures.js", import.meta.url), "utf8").match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).length;
  check("no emails/contacts in fixture", emailLike === 0);
}

// No persistence / network in engine.
{
  const engineSrc = readFileSync(new URL("./decision-engine.js", import.meta.url), "utf8");
  check("engine has no network/persistence calls", !/fetch\(|localStorage|XMLHttpRequest|WebSocket/.test(engineSrc));
}

// ---------------------------------------------------------------------------
// Next-evidence dedup (final polish): identical requests appear only once,
// first-occurrence order preserved, no text rewriting.
// ---------------------------------------------------------------------------
{
  const { dedupePreserveOrder } = await import("./decision-engine.js");
  check("dedupe preserves first-occurrence order", JSON.stringify(dedupePreserveOrder(["a", "b", "a", "c", "b"])) === JSON.stringify(["a", "b", "c"]));
  check("dedupe drops empty entries", dedupePreserveOrder(["x", "", "x", null, "y"]).length === 2);

  // Compose the same raw next-evidence list the UI builds from the fixture,
  // then dedupe — the final list must be duplicate-free.
  const raw = [];
  opportunity.contradictions.forEach((c) => c.resolveWith && raw.push(c.resolveWith));
  opportunity.unknowns.filter((u) => u.blocksPursue === true).forEach((u) => u.resolveWith && raw.push(u.resolveWith));
  if (opportunity.commercialTerms.resolveWith) raw.push(opportunity.commercialTerms.resolveWith);
  const final = dedupePreserveOrder(raw);
  check("next-evidence list duplicate-free", new Set(final).size === final.length, JSON.stringify(final));
  const expected = [];
  for (const v of raw) if (v && !expected.includes(v)) expected.push(v);
  check("next-evidence order preserved (first occurrence)", JSON.stringify(final) === JSON.stringify(expected));
}

// ---------------------------------------------------------------------------
// Audit-fix regression tests (positive evidence consulted, PURSUE_NOW path,
// blocking UNKNOWN, synthetic data flag, no weighted score).
// ---------------------------------------------------------------------------
function cleanScenario() {
  const c = JSON.parse(JSON.stringify(opportunity));
  c.contradictions = [];
  c.commercialTerms = { status: "COMPLETE", detail: "" };
  c.quoteBasesComparable = true;
  c.paymentEvents = c.paymentEvents.map((e) => ({ ...e, status: "COMPLETE", amountCny: e.amountCny || 10000, daysFromSign: e.daysFromSign ?? 10 }));
  c.unknowns = [];
  c.dimensions.buyerFit.value = "HIGH";
  c.dimensions.evidenceQuality.value = "HIGH";
  return c;
}

{
  const clean = cleanScenario();
  const e = evaluateDecision(clean);
  check("audit all-positive clean recommends PURSUE_NOW", e.recommended === "PURSUE_NOW" && e.available.PURSUE_NOW === true, e.recommended);
}
{
  const c = cleanScenario();
  c.dimensions.buyerFit.value = "LOW";
  const e = evaluateDecision(c);
  check("audit Buyer Fit LOW changes recommendation", e.recommended === "PURSUE_CONDITIONALLY" && e.available.PURSUE_NOW === false, e.recommended);
}
{
  const c = cleanScenario();
  c.dimensions.evidenceQuality.value = "LOW";
  const e = evaluateDecision(c);
  check("audit Evidence Quality LOW changes recommendation", e.recommended === "HOLD_FOR_EVIDENCE" && e.available.PURSUE_NOW === false, e.recommended);
}
{
  const c = cleanScenario();
  c.dimensions.evidenceQuality.value = "UNKNOWN";
  const e = evaluateDecision(c);
  check("audit Evidence Quality UNKNOWN stays UNKNOWN and holds", e.recommended === "HOLD_FOR_EVIDENCE" && e.available.PURSUE_NOW === false, e.recommended);
}
{
  const c = cleanScenario();
  c.contradictions = [{ id: "CTR-X", label: "test", detail: "x", material: true, status: "UNRESOLVED" }];
  const e = evaluateDecision(c);
  check("audit material contradiction blocks PURSUE_NOW in clean scenario", e.recommended === "ESCALATE" && e.available.PURSUE_NOW === false, e.recommended);
}
{
  const c = cleanScenario();
  c.unknowns = [{ id: "UNK-X", label: "blocking", detail: "x", blocksPursue: true }];
  const e = evaluateDecision(c);
  check("audit blocking UNKNOWN prevents PURSUE_NOW", e.recommended === "HOLD_FOR_EVIDENCE" && e.available.PURSUE_NOW === false, e.recommended);
}
{
  const e = paymentExposure(opportunity.paymentEvents);
  check("audit payment semantics unchanged", e.computed && e.totalCommittedCny === 84000 && e.peakWindowCny === 58800);
}
{
  const engineSrc = readFileSync(new URL("./decision-engine.js", import.meta.url), "utf8");
  check("audit no weighted score introduced", !/\bweight\b/.test(engineSrc) && !/\*\s*0\.\d/.test(engineSrc));
  check("audit synthetic detection uses data flag (no fixture id in engine)", !engineSrc.includes("OPP-2026-008"));
  const briefT = buildBrief({ ...opportunity, synthetic: true }, "PURSUE_NOW", evaluateDecision(cleanScenario()));
  const briefF = buildBrief({ ...opportunity, synthetic: false }, "PURSUE_NOW", evaluateDecision(cleanScenario()));
  check("audit synthetic flag drives brief marker", briefT.synthetic === true && briefF.synthetic === false);
}
{
  const c = cleanScenario();
  const brief = buildBrief(c, "PURSUE_NOW", evaluateDecision(c));
  check("audit human approval still mandatory", brief.boundaryNote.includes("Human approval is always required") && brief.humanDecision === "PURSUE_NOW");
}

// ---------------------------------------------------------------------------
// KYC gate regression (owner-authorized implementation, verified by
// kyc-boundary-experiment.mjs — production behavior must match).
// ---------------------------------------------------------------------------
{
  const kyc = (mut) => {
    const c = cleanScenario();
    mut(c);
    return c;
  };
  // H1: sanctions/adverse -> one-vote veto DO_NOT_PURSUE
  const e3 = evaluateDecision(kyc((c) => { c.kyc = { status: "ADVERSE", sanctionsHit: true, adverseFinding: true, beneficialOwnerVerified: true }; }));
  check("KYC sanctions hit -> DO_NOT_PURSUE veto", e3.recommended === "DO_NOT_PURSUE" && e3.kycGate === "SANCTIONS_VETO" && e3.available.PURSUE_NOW === false && e3.available.PURSUE_CONDITIONALLY === false, e3.recommended + " gate=" + e3.kycGate);
  // H3: margin cannot rescue sanctions veto (margin x KYC interaction)
  const e5 = evaluateDecision(kyc((c) => { c.kyc = { status: "ADVERSE", sanctionsHit: true, adverseFinding: true, beneficialOwnerVerified: true }; c.margin = { bps: 2000 }; }));
  check("KYC high margin cannot rescue sanctions veto", e5.recommended === "DO_NOT_PURSUE", e5.recommended);
  // H2: KYC incomplete -> HOLD_FOR_EVIDENCE
  const e2 = evaluateDecision(kyc((c) => { c.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false }; }));
  check("KYC incomplete -> HOLD_FOR_EVIDENCE", e2.recommended === "HOLD_FOR_EVIDENCE" && e2.kycGate === "KYC_INCOMPLETE" && e2.available.PURSUE_NOW === false, e2.recommended + " gate=" + e2.kycGate);
  // H5: insurance does not clear KYC
  const e4 = evaluateDecision(kyc((c) => { c.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false }; c.margin = { bps: 0, note: "insurable but KYC unresolved" }; }));
  check("KYC insurance does not clear gate", e4.recommended === "HOLD_FOR_EVIDENCE", e4.recommended);
  // H6: absent kyc field -> gate ABSENT, behavior unchanged (clean positive still NOW)
  const clean = cleanScenario();
  const eAbsent = evaluateDecision(clean);
  check("KYC absent field -> no gate, clean path unchanged", eAbsent.kycGate === "ABSENT" && eAbsent.recommended === "PURSUE_NOW", eAbsent.recommended + " gate=" + eAbsent.kycGate);
  // H4: clear KYC passes through
  const e1 = evaluateDecision(kyc((c) => { c.kyc = { status: "CLEAR", beneficialOwnerVerified: true, sanctionsHit: false, adverseFinding: false }; }));
  check("KYC clear passes through unchanged", e1.recommended === "PURSUE_NOW" && e1.kycGate === "CLEAR", e1.recommended + " gate=" + e1.kycGate);
}

// ---------------------------------------------------------------------------
// Margin gate regression (owner-authorized building phase; provisional semantics —
// engine does NOT invent a threshold; caller-declared thresholdBps decides).
// ---------------------------------------------------------------------------
{
  const marg = (mut) => {
    const c = cleanScenario();
    mut(c);
    return c;
  };
  // below declared threshold -> DO_NOT_PURSUE (commercial-viability veto; S15 flip)
  const low = evaluateDecision(marg((c) => { c.margin = { bps: 500, thresholdBps: 800 }; }));
  check("MARGIN below declared threshold -> DO_NOT_PURSUE veto", low.recommended === "DO_NOT_PURSUE" && low.marginGate === "BELOW_THRESHOLD" && low.available.PURSUE_NOW === false && low.available.PURSUE_CONDITIONALLY === false, low.recommended + " gate=" + low.marginGate);
  // at/above threshold -> no veto
  const ok = evaluateDecision(marg((c) => { c.margin = { bps: 900, thresholdBps: 800 }; }));
  check("MARGIN at/above threshold -> no veto", ok.recommended === "PURSUE_NOW" && ok.marginGate === "CLEAR", ok.recommended + " gate=" + ok.marginGate);
  // no declared threshold -> gate ABSENT, engine does not invent one (S08 lesson)
  const noThr = evaluateDecision(marg((c) => { c.margin = { bps: 300 }; }));
  check("MARGIN no declared threshold -> no gate (engine invents nothing)", noThr.marginGate === "ABSENT" && noThr.recommended === "PURSUE_NOW", noThr.recommended + " gate=" + noThr.marginGate);
  // threshold-only input (no bps) -> ABSENT, must NOT claim CLEAR (P2 review edge case)
  const thrOnly = evaluateDecision(marg((c) => { c.margin = { thresholdBps: 800 }; }));
  check("MARGIN threshold-only (no bps) -> ABSENT, not CLEAR", thrOnly.marginGate === "ABSENT" && thrOnly.recommended === "PURSUE_NOW", thrOnly.recommended + " gate=" + thrOnly.marginGate);
  // cost shift to supplier alone -> risk signal, NOT a veto
  const shift = evaluateDecision(marg((c) => { c.margin = { bps: 900, thresholdBps: 800, costPayer: "SUPPLIER", costType: "CERTIFICATION" }; }));
  check("MARGIN cost-shift alone is signal, not veto", shift.recommended === "PURSUE_NOW" && shift.marginGate === "COST_SHIFT" && shift.reasons.some((r) => r.includes("MARGIN GATE")), shift.recommended + " gate=" + shift.marginGate);
  // absent margin field -> gate ABSENT, clean path unchanged
  const cleanM = cleanScenario();
  const eAbsentM = evaluateDecision(cleanM);
  check("MARGIN absent field -> no gate, clean path unchanged", eAbsentM.marginGate === "ABSENT" && eAbsentM.recommended === "PURSUE_NOW", eAbsentM.recommended + " gate=" + eAbsentM.marginGate);
}

const failed = results.filter(([, ok]) => !ok);
console.log(`\nRESULT: ${results.length - failed.length}/${results.length} PASS`);
process.exitCode = failed.length ? 1 : 0;
