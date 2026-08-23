// channel-price-experiment.mjs — CHANNEL PRICE DISCIPLINE GATE boundary experiment.
// -----------------------------------------------------------------------------
// OWNER-AUTHORIZED (charter confirmed 2026-08-23, commit 96fa1d6): synthetic
// experiment ONLY. Production decision-engine.js is NOT modified. No deployment,
// no production data.
//
// GATE TARGET: channel-price discipline (domain source D, RECORD_DEF — "亂價傾銷
// 一票否決，就算現金全款買斷也拒絕"). PROVISIONAL — NOT DOMAIN CONSENSUS.
//
// PRIORITY ASSUMPTION (experiment hypothesis, NOT established contract):
//   sanctions > margin > channel-price > KYC-incomplete > rules
// The experiment must test interaction/conflict with sanctions, margin, and
// KYC-incomplete. If the priority cannot be clearly expressed with the current
// primitives, STOP per failure criteria.
//
// PRE-REGISTERED HYPOTHESES (declared before execution):
//   H1: channel-price dumping risk maps to DO_NOT_PURSUE (one-vote veto) — the
//       DNP semantics matches KYC/Margin gate pattern (no new state/dependency).
//   H2: sanctions veto outranks channel-price (both DNP; source distinguishable
//       via kycGate).
//   H3: margin veto outranks channel-price (both DNP; source via marginGate).
//   H4: channel-price outranks KYC-incomplete (dumping → DNP even when base is
//       HOLD on KYC; base HOLD would otherwise be the outcome).
//   H5: channel-price outranks rules-layer results (weak evidence / weak fit:
//       dumping → DNP regardless).
//   H6: clear channel-price passes through — no gate behavior on clean input
//       (KYC/Margin gates still act normally).
// -----------------------------------------------------------------------------
// METHOD NOTE (honesty): channel-price is a NEW gate candidate — unlike KYC
// (contradiction/unknown) and margin (threshold), there is NO existing primitive
// whose natural output is a one-vote DNP for price dumping. The variant therefore
// models "the gate inserted into the priority chain" as an overlay on the
// unmodified engine's output, exactly as the KYC experiment modeled its Phase-1
// variant. This is simulation, not a claim that an existing primitive already
// produces the result.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDecision, paymentExposure, buildBrief } from "../decision-engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "outputs");
mkdirSync(OUT, { recursive: true });

function baseOpp(id, name) {
  return {
    id,
    synthetic: true,
    name,
    dimensions: {
      buyerFit: { value: "HIGH" },
      categoryFit: { value: "HIGH" },
      evidenceQuality: { value: "HIGH" },
      importOpenness: { value: "HIGH" },
      commercialFeasibility: { value: "CONDITIONAL" },
    },
    contradictions: [],
    unknowns: [],
    whyNot: [],
    why: [],
    commercialTerms: { status: "COMPLETE", detail: "" },
    quotes: [],
    quoteBasesComparable: true,
    paymentEvents: [
      { id: "PE-1", label: "Deposit", amountCny: 30000, daysFromSign: 0, status: "COMPLETE" },
      { id: "PE-2", label: "Balance", amountCny: 70000, daysFromSign: 30, status: "COMPLETE" },
    ],
    buyers: [{ id: "B1", label: "Synthetic buyer" }],
    paymentDisclosure: "synthetic",
    // structured channel-price field (experiment input; NOT read by production engine)
    channelPrice: { status: "CLEAR", dumpingRisk: false, policy: "PRICE_FLOOR", note: "" },
  };
}

// ---------------------------------------------------------------------------
// Experiment variant — channel-price gate inserted into the priority chain.
// Priority: sanctions > margin > channel-price > KYC-incomplete > rules.
//  1. base = production evaluateDecision (has kycGate/marginGate/recommended).
//  2. If base is already DO_NOT_PURSUE, a higher-or-equal veto fired
//     (sanctions/margin/category-weak) — keep it; annotate source.
//  3. Else if dumping risk: override to DO_NOT_PURSUE (channel-price veto —
//     outranks KYC-incomplete HOLD and rules-layer results).
//  4. Else pass through (channel-price CLEAR; KYC/Margin gates act normally).
// ---------------------------------------------------------------------------
export function evaluateWithChannelPrice(opp) {
  const base = evaluateDecision(opp); // production, unmodified
  const cp = opp.channelPrice || {};
  const dumping = cp.status === "DUMPING_RISK" || cp.dumpingRisk === true;
  const policy = cp.policy || "PRICE_FLOOR";

  if (base.recommended === "DO_NOT_PURSUE") {
    // Higher-or-equal veto already fired. Distinguish the source.
    const source = base.kycGate === "SANCTIONS_VETO" ? "SANCTIONS" : base.marginGate === "BELOW_THRESHOLD" ? "MARGIN" : "CATEGORY_WEAK_RULE1";
    return { ...base, channelPriceGate: dumping ? "DUMPING_RISK_PRESENT_LOWER_PRIORITY" : "CLEAR", vetoSource: source };
  }

  if (dumping) {
    // channel-price veto — outranks KYC-incomplete (H4) and rules-layer (H5).
    return {
      ...base,
      recommended: "DO_NOT_PURSUE",
      available: { ...base.available, PURSUE_NOW: false, PURSUE_CONDITIONALLY: false },
      reasons: [
        ...base.reasons,
        `CHANNEL-PRICE GATE: price-dumping risk detected under policy "${policy}" — one-vote veto (domain source D: 亂價傾銷毀整盤價格體系); DO_NOT_PURSUE regardless of other commercial signals.`,
      ],
      channelPriceGate: "DUMPING_RISK_VETO",
      vetoSource: "CHANNEL_PRICE",
    };
  }

  // H6: clear channel-price — pass through; KYC/Margin gates still act.
  return { ...base, channelPriceGate: "CLEAR" };
}

// ---------------------------------------------------------------------------
// Cases — 10, covering priority interactions with sanctions/margin/KYC-incomplete.
// EXPECTED declared here, before running. base = production; gated = variant.
// ---------------------------------------------------------------------------
const CASES = [
  {
    id: "CP-1",
    label: "channel-price clear + clean deal (pass-through)",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("CP-1", "Clear price discipline"); o.channelPrice = { status: "CLEAR", dumpingRisk: false, policy: "PRICE_FLOOR" }; return o; },
  },
  {
    id: "CP-2",
    label: "dumping risk + clean deal (channel-price veto fires)",
    expected: { base: "PURSUE_NOW", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("CP-2", "Dumping risk"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR" }; return o; },
  },
  {
    id: "CP-3",
    label: "dumping risk + sanctions hit (sanctions outranks — both DNP, source distinguishable)",
    expected: { base: "DO_NOT_PURSUE", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("CP-3", "Dumping + sanctions"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR" }; o.kyc = { status: "ADVERSE", sanctionsHit: true, adverseFinding: true, beneficialOwnerVerified: true }; return o; },
  },
  {
    id: "CP-4",
    label: "dumping risk + margin below threshold (margin outranks — both DNP)",
    expected: { base: "DO_NOT_PURSUE", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("CP-4", "Dumping + low margin"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR" }; o.margin = { bps: 300, thresholdBps: 800 }; return o; },
  },
  {
    id: "CP-5",
    label: "dumping risk + KYC-incomplete (channel-price OUTRANKS KYC: DNP, base would HOLD)",
    expected: { base: "HOLD_FOR_EVIDENCE", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("CP-5", "Dumping + KYC incomplete"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR" }; o.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false }; return o; },
  },
  {
    id: "CP-6",
    label: "channel-price clear + KYC-incomplete (KYC acts normally: HOLD)",
    expected: { base: "HOLD_FOR_EVIDENCE", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("CP-6", "Clear price + KYC incomplete"); o.channelPrice = { status: "CLEAR", dumpingRisk: false, policy: "PRICE_FLOOR" }; o.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false }; return o; },
  },
  {
    id: "CP-7",
    label: "dumping risk + weak evidence (channel-price OUTRANKS rules: DNP)",
    expected: { base: "HOLD_FOR_EVIDENCE", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("CP-7", "Dumping + weak evidence"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR" }; o.dimensions.evidenceQuality.value = "LOW"; return o; },
  },
  {
    id: "CP-8",
    label: "dumping risk + weak category fit (category-weak Rule 1 outranks or ties — both DNP)",
    expected: { base: "DO_NOT_PURSUE", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("CP-8", "Dumping + weak category"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR" }; o.dimensions.categoryFit.value = "WEAK"; return o; },
  },
  {
    id: "CP-9",
    label: "dumping + sanctions + margin + KYC all present (highest priority sanctions wins; source distinguishable)",
    expected: { base: "DO_NOT_PURSUE", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("CP-9", "Everything bad"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR" }; o.kyc = { status: "ADVERSE", sanctionsHit: true, adverseFinding: true, beneficialOwnerVerified: true }; o.margin = { bps: 200, thresholdBps: 800 }; return o; },
  },
  {
    id: "CP-10",
    label: "clear channel-price + everything clear (PURSUE_NOW baseline)",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("CP-10", "Everything clear"); o.channelPrice = { status: "CLEAR", dumpingRisk: false, policy: "PRICE_FLOOR" }; return o; },
  },
];

// ---------------------------------------------------------------------------
// Run base engine + variant on every case; compare against pre-registered.
// ---------------------------------------------------------------------------
const results = [];
const log = [];
for (const c of CASES) {
  const opp = c.build();
  const base = evaluateDecision(opp);
  const gated = evaluateWithChannelPrice(opp);
  const brief = buildBrief(opp, "HOLD_FOR_EVIDENCE", base);
  const actual = { base: base.recommended, gated: gated.recommended, channelPriceGate: gated.channelPriceGate, vetoSource: gated.vetoSource, kycGate: base.kycGate, marginGate: base.marginGate, briefHumanBoundary: brief.boundaryNote.includes("Human approval is always required") };
  const mismatch = [];
  if (actual.base !== c.expected.base) mismatch.push(`base ${actual.base} != ${c.expected.base}`);
  if (actual.gated !== c.expected.gated) mismatch.push(`gated ${actual.gated} != ${c.expected.gated}`);
  if (!actual.briefHumanBoundary) mismatch.push("human-approval boundary missing");
  const PASS = mismatch.length === 0;
  results.push({ id: c.id, label: c.label, expected: c.expected, actual, channelPrice: opp.channelPrice, kyc: opp.kyc ?? null, margin: opp.margin ?? null, PASS, mismatch });
  log.push(`[${PASS ? "PASS" : "FAIL"}] ${c.id} ${c.label} | base=${actual.base} gated=${actual.gated} (${actual.channelPriceGate}${actual.vetoSource ? " src=" + actual.vetoSource : ""})`);
  mismatch.forEach((m) => log.push(`      MISMATCH: ${m}`));
}

writeFileSync(join(OUT, "channel-price-results.raw.json"), JSON.stringify(results, null, 2), "utf8");
log.push(`\nCASES: ${results.length} | PASS ${results.filter((r) => r.PASS).length} | FAIL ${results.filter((r) => !r.PASS).length}`);
writeFileSync(join(OUT, "channel-price-run-log.txt"), log.join("\n") + "\n", "utf8");
console.log(log.join("\n"));
console.log(`\nRaw: ${join(OUT, "channel-price-results.raw.json")}`);
