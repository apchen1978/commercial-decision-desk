// channel-price-rehearsal.mjs — SYNTHETIC IMPLEMENTATION REHEARSAL (design-only).
// -----------------------------------------------------------------------------
// Owner instruction (2026-08-23): rehearse the production implementation WITHOUT
// modifying canonical production engine. This file defines the EXACT gate logic
// that WOULD be added to decision-engine.js (test-only overlay / isolated patch),
// plus 12 clearly-marked SYNTHETIC / DESIGN-ONLY cases covering:
//   - dumping-risk trigger semantics
//   - exceptions: new market, clearance/one-off sale, end-customer self-use
//   - conflicts with sanctions, margin, KYC-incomplete
//   - reasons and gate-source output
// Limits honored: NO canonical engine change, NO formal channelPrice field in
// decision-engine.js, NO production data, NO Level 3 claim.
//
// The overlay below is the rehearsal of the PROPOSED production gate. It is
// isolated here; if owner later authorizes implementation, this logic is the
// minimal diff to apply (see REHEARSAL_PLAN in docs/interviews/).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDecision, paymentExposure, buildBrief } from "../decision-engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "outputs");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// REHEARSED PRODUCTION GATE — the exact logic proposed for decision-engine.js.
// Priority: sanctions > margin > channel-price > KYC-incomplete > rules.
// Exception semantics (caller-declared): channelPrice.exceptions[] can list
// "NEW_MARKET" | "CLEARANCE" | "END_USER_SELF_USE" — if any applies, the veto is
// NOT fired (reason surfaced instead). Engine does not judge exceptions itself;
// the caller declares them (same discipline as margin threshold).
// ---------------------------------------------------------------------------
function rehearsedChannelPriceGate(opp, base) {
  const cp = opp.channelPrice || {};
  const dumping = cp.status === "DUMPING_RISK" || cp.dumpingRisk === true;
  const policy = cp.policy || "PRICE_FLOOR";
  const exceptions = Array.isArray(cp.exceptions) ? cp.exceptions : [];
  const hasException = exceptions.length > 0;

  // Already vetoed by a higher-priority gate (sanctions/margin/category-weak).
  if (base.recommended === "DO_NOT_PURSUE") {
    const source = base.kycGate === "SANCTIONS_VETO" ? "SANCTIONS" : base.marginGate === "BELOW_THRESHOLD" ? "MARGIN" : "CATEGORY_WEAK_RULE1";
    return { ...base, channelPriceGate: dumping && !hasException ? "DUMPING_RISK_LOWER_PRIORITY" : dumping && hasException ? "EXCEPTION_APPLIES" : "CLEAR", vetoSource: source };
  }

  if (dumping && !hasException) {
    return {
      ...base,
      recommended: "DO_NOT_PURSUE",
      available: { ...base.available, PURSUE_NOW: false, PURSUE_CONDITIONALLY: false },
      reasons: [
        ...base.reasons,
        `CHANNEL-PRICE GATE: price-dumping risk under policy "${policy}" — one-vote veto (D-domain); DO_NOT_PURSUE regardless of other commercial signals.`,
      ],
      channelPriceGate: "DUMPING_RISK_VETO",
      vetoSource: "CHANNEL_PRICE",
    };
  }

  if (dumping && hasException) {
    // Exception declared by caller — veto suppressed, risk surfaced for human.
    return {
      ...base,
      reasons: [
        ...base.reasons,
        `CHANNEL-PRICE GATE: dumping risk present BUT caller-declared exception(s) [${exceptions.join(", ")}] — veto suppressed; risk surfaced for human decision.`,
      ],
      channelPriceGate: "EXCEPTION_APPLIES",
      vetoSource: "EXCEPTION_OVERRIDE",
    };
  }

  return { ...base, channelPriceGate: "CLEAR" };
}

// Rehearsal entry: run production engine, then apply the rehearsed gate overlay.
export function evaluateRehearsal(opp) {
  const base = evaluateDecision(opp);
  return rehearsedChannelPriceGate(opp, base);
}

// ---------------------------------------------------------------------------
// Base fixture template (mirrors the production fixture shape).
// ---------------------------------------------------------------------------
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
    channelPrice: { status: "CLEAR", dumpingRisk: false, policy: "PRICE_FLOOR", exceptions: [] },
  };
}

// ---------------------------------------------------------------------------
// 12 SYNTHETIC / DESIGN-ONLY cases. EXPECTED declared here, before running.
// ---------------------------------------------------------------------------
const CASES = [
  { id: "R-01", label: "dumping risk → veto fires (trigger semantics)", expected: "DO_NOT_PURSUE",
    build: () => { const o = baseOpp("R-01", "Dumping"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: [] }; return o; } },
  { id: "R-02", label: "clear → pass-through", expected: "PURSUE_NOW",
    build: () => { const o = baseOpp("R-02", "Clear"); o.channelPrice = { status: "CLEAR", dumpingRisk: false, policy: "PRICE_FLOOR", exceptions: [] }; return o; } },
  { id: "R-03", label: "EXCEPTION: new market (caller-declared) → veto suppressed, risk surfaced", expected: "PURSUE_NOW",
    build: () => { const o = baseOpp("R-03", "New market"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: ["NEW_MARKET"] }; return o; } },
  { id: "R-04", label: "EXCEPTION: clearance / one-off sale → veto suppressed", expected: "PURSUE_NOW",
    build: () => { const o = baseOpp("R-04", "Clearance"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: ["CLEARANCE"] }; return o; } },
  { id: "R-05", label: "EXCEPTION: end-customer self-use (non-resale) → veto suppressed", expected: "PURSUE_NOW",
    build: () => { const o = baseOpp("R-05", "Self-use"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: ["END_USER_SELF_USE"] }; return o; } },
  { id: "R-06", label: "CONFLICT: dumping + sanctions → sanctions outranks (source=SANCTIONS)", expected: "DO_NOT_PURSUE",
    build: () => { const o = baseOpp("R-06", "Dump+sanctions"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: [] }; o.kyc = { status: "ADVERSE", sanctionsHit: true, adverseFinding: true, beneficialOwnerVerified: true }; return o; } },
  { id: "R-07", label: "CONFLICT: dumping + margin-below → margin outranks (source=MARGIN)", expected: "DO_NOT_PURSUE",
    build: () => { const o = baseOpp("R-07", "Dump+margin"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: [] }; o.margin = { bps: 300, thresholdBps: 800 }; return o; } },
  { id: "R-08", label: "CONFLICT: dumping + KYC-incomplete → channel-price outranks KYC (HOLD→DNP)", expected: "DO_NOT_PURSUE",
    build: () => { const o = baseOpp("R-08", "Dump+KYC"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: [] }; o.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false }; return o; } },
  { id: "R-09", label: "CONFLICT: dumping + weak evidence → channel-price outranks rules (HOLD→DNP)", expected: "DO_NOT_PURSUE",
    build: () => { const o = baseOpp("R-09", "Dump+weakev"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: [] }; o.dimensions.evidenceQuality.value = "LOW"; return o; } },
  { id: "R-10", label: "EXCEPTION + KYC-incomplete (exception suppresses veto; KYC still HOLDs)", expected: "HOLD_FOR_EVIDENCE",
    build: () => { const o = baseOpp("R-10", "Exception+KYC"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: ["CLEARANCE"] }; o.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false }; return o; } },
  { id: "R-11", label: "reason output: veto reason present + gate source=CHANNEL_PRICE", expected: "DO_NOT_PURSUE",
    build: () => { const o = baseOpp("R-11", "Reason check"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: [] }; return o; },
    reasonCheck: (g) => g.reasons.some((r) => r.includes("CHANNEL-PRICE GATE")) && g.vetoSource === "CHANNEL_PRICE" },
  { id: "R-12", label: "reason output: exception suppressed → EXCEPTION_OVERRIDE + reason", expected: "PURSUE_NOW",
    build: () => { const o = baseOpp("R-12", "Exception reason"); o.channelPrice = { status: "DUMPING_RISK", dumpingRisk: true, policy: "PRICE_FLOOR", exceptions: ["NEW_MARKET"] }; return o; },
    reasonCheck: (g) => g.channelPriceGate === "EXCEPTION_APPLIES" && g.reasons.some((r) => r.includes("exception(s) [NEW_MARKET]")) },
];

// ---------------------------------------------------------------------------
// Run; compare against pre-registered expected.
// ---------------------------------------------------------------------------
const results = [];
const log = [];
for (const c of CASES) {
  const opp = c.build();
  const base = evaluateDecision(opp);
  const g = evaluateRehearsal(opp);
  const brief = buildBrief(opp, "HOLD_FOR_EVIDENCE", base);
  const actual = { recommended: g.recommended, channelPriceGate: g.channelPriceGate, vetoSource: g.vetoSource, kycGate: g.kycGate, marginGate: g.marginGate, reasons: g.reasons, briefHumanBoundary: brief.boundaryNote.includes("Human approval is always required") };
  const mismatch = [];
  if (actual.recommended !== c.expected) mismatch.push(`recommended ${actual.recommended} != ${c.expected}`);
  if (c.reasonCheck && !c.reasonCheck(g)) mismatch.push("reason/gate-source check failed");
  if (!actual.briefHumanBoundary) mismatch.push("human-approval boundary missing");
  const PASS = mismatch.length === 0;
  results.push({ id: c.id, label: c.label, expected: c.expected, actual, channelPrice: opp.channelPrice, kyc: opp.kyc ?? null, margin: opp.margin ?? null, PASS, mismatch });
  log.push(`[${PASS ? "PASS" : "FAIL"}] ${c.id} ${c.label} | ${actual.recommended} (gate=${actual.channelPriceGate} src=${actual.vetoSource ?? "-"})`);
  mismatch.forEach((m) => log.push(`      MISMATCH: ${m}`));
}

writeFileSync(join(OUT, "channel-price-rehearsal-results.raw.json"), JSON.stringify(results, null, 2), "utf8");
log.push(`\nCASES: ${results.length} | PASS ${results.filter((r) => r.PASS).length} | FAIL ${results.filter((r) => !r.PASS).length}`);
writeFileSync(join(OUT, "channel-price-rehearsal-run-log.txt"), log.join("\n") + "\n", "utf8");
console.log(log.join("\n"));
console.log(`\nRaw: ${join(OUT, "channel-price-rehearsal-results.raw.json")}`);
