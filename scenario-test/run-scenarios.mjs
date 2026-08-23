// run-scenarios.mjs — CDD EVIDENCE-DEPTH STRESS TEST (OWNER-AUTHORIZED EXPERIMENT)
// -----------------------------------------------------------------------------
// PURPOSE: evidence-discovery, NOT test beautification. Expected behavior is
// defined BEFORE execution. Every mismatch is preserved and classified.
// The engine is NEVER modified by this harness.
//
// REPOSITORY: apchen1978/commercial-decision-desk @ 539f945 (identity verified)
// CONTRACT UNDER TEST: decision-engine.js evaluateDecision / paymentExposure
//                      + 8 hard rules (see README + verify.mjs).
//
// Each scenario declares EXPECTED before running. Actual output is recorded
// verbatim. PASS/FAIL/INCONCLUSIVE per scenario — never aggregated into one score.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { opportunity } from "../fixtures.js";
import { evaluateDecision, paymentExposure, buildBrief, DECISION_STATES } from "../decision-engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "outputs");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Scenario builder — deep-clone base opportunity, then mutate per scenario.
// ---------------------------------------------------------------------------
const base = () => JSON.parse(JSON.stringify(opportunity));

function cleanPositive() {
  const c = base();
  c.contradictions = [];
  c.commercialTerms = { status: "COMPLETE", detail: "" };
  c.quoteBasesComparable = true;
  c.paymentEvents = c.paymentEvents
    .filter((e) => e.status === "COMPLETE")
    .map((e) => ({ ...e, status: "COMPLETE", amountCny: e.amountCny, daysFromSign: e.daysFromSign }));
  c.unknowns = [];
  c.dimensions.buyerFit.value = "HIGH";
  c.dimensions.evidenceQuality.value = "HIGH";
  c.dimensions.categoryFit.value = "HIGH";
  c.contradictions = [];
  return c;
}

// ---------------------------------------------------------------------------
// Scenario registry — EXPECTED STATE is declared here, before execution.
// ---------------------------------------------------------------------------
const SCENARIOS = [
  {
    id: "S01",
    claim: "All gates clear + strong Buyer Fit + strong Evidence Quality => PURSUE_NOW available and recommended.",
    build: () => cleanPositive(),
    expected: { recommended: "PURSUE_NOW", availableNow: true, invariant: "positive pursuit path is reachable" },
  },
  {
    id: "S02",
    claim: "Strong evidence but MEDIUM (not strong) Buyer Fit => only conditional pursuit; PURSUE_NOW unavailable.",
    build: () => {
      const c = cleanPositive();
      c.dimensions.buyerFit.value = "MEDIUM";
      return c;
    },
    expected: { recommended: "PURSUE_CONDITIONALLY", availableNow: false, invariant: "no forced pursuit without strong fit" },
  },
  {
    id: "S03",
    claim: "LOW Evidence Quality (with everything else positive) => HOLD_FOR_EVIDENCE, NOT DO_NOT_PURSUE. Missing/weak evidence != negative evidence.",
    build: () => {
      const c = cleanPositive();
      c.dimensions.evidenceQuality.value = "LOW";
      return c;
    },
    expected: { recommended: "HOLD_FOR_EVIDENCE", availableNow: false, invariant: "missing evidence is not negative evidence" },
  },
  {
    id: "S04",
    claim: "Evidence Quality UNKNOWN => HOLD_FOR_EVIDENCE and UNKNOWN stays UNKNOWN (not converted to fact, not treated as negative).",
    build: () => {
      const c = cleanPositive();
      c.dimensions.evidenceQuality.value = "UNKNOWN";
      return c;
    },
    expected: { recommended: "HOLD_FOR_EVIDENCE", availableNow: false, invariant: "UNKNOWN remains UNKNOWN until supported" },
  },
  {
    id: "S05",
    claim: "Blocking UNKNOWN remains despite strong evidence => HOLD_FOR_EVIDENCE; PURSUE_NOW requires no blocking UNKNOWN.",
    build: () => {
      const c = cleanPositive();
      c.unknowns = [{ id: "UNK-X", label: "Order volume unverified", detail: "x", blocksPursue: true }];
      return c;
    },
    expected: { recommended: "HOLD_FOR_EVIDENCE", availableNow: false, invariant: "blocking UNKNOWN gates pursuit" },
  },
  {
    id: "S06",
    claim: "Material UNRESOLVED contradiction => ESCALATE; PURSUE_NOW unavailable. (Boundary variant: NON-material contradiction must NOT escalate.)",
    build: () => {
      const c = cleanPositive();
      c.contradictions = [{ id: "CTR-M", label: "Payment terms conflict", detail: "90 days vs 30% advance", material: true, status: "UNRESOLVED" }];
      return c;
    },
    expected: { recommended: "ESCALATE", availableNow: false, invariant: "contradictory material evidence => escalation" },
    boundaryVariant: {
      label: "non-material contradiction must not escalate",
      build: () => {
        const c = cleanPositive();
        c.contradictions = [{ id: "CTR-NM", label: "Minor date discrepancy", detail: "cosmetic", material: false, status: "UNRESOLVED" }];
        return c;
      },
      expected: { recommended: "PURSUE_NOW", availableNow: true, invariant: "escalation requires MATERIAL contradiction" },
    },
  },
  {
    id: "S07",
    claim: "Weak Category Fit => DO_NOT_PURSUE even when every other signal (buyer fit, evidence, exposure, terms) is positive. Attractive signals must not override weak fit.",
    build: () => {
      const c = cleanPositive();
      c.dimensions.categoryFit.value = "WEAK";
      return c;
    },
    expected: { recommended: "DO_NOT_PURSUE", availableNow: false, invariant: "weak fit not overridden by attractive signals" },
  },
  {
    id: "S08",
    claim: "EXPIRED evidence: evidence tier records EXPIRED but value remains HIGH. Engine consumes only dimensions.value — does it detect expiry? (Adversarial: expired evidence must not be treated as current.)",
    build: () => {
      const c = cleanPositive();
      c.dimensions.evidenceQuality.evidence = [
        { tier: "EXPIRED", note: "Verification call from 14 months ago; buyer contact stale (synthetic)." },
        { tier: "EXPIRED", note: "Old spec revision, superseded (synthetic)." },
      ];
      return c;
    },
    expected: { recommended: "PURSUE_NOW", availableNow: true, invariant: "expiry is a data-tier concern; engine has no expiry signal", adversarial: true },
  },
  {
    id: "S09",
    claim: "Non-comparable quote bases must NOT be force-ranked; the decision may still be positive (Rule 4 is a disclosure gate, not a pursuit gate).",
    build: () => {
      const c = cleanPositive();
      c.quoteBasesComparable = false;
      c.quotes = [
        { id: "Q-1", basis: "FOB", status: "COMPLETE" },
        { id: "Q-2", basis: "DDP + installation", status: "COMPLETE" },
      ];
      return c;
    },
    expected: { recommended: "PURSUE_NOW", availableNow: true, invariant: "incomparable evidence is never force-ranked", adversarial: true },
  },
  {
    id: "S10",
    claim: "MALFORMED enum: buyerFit.value='HYPERSONIC' (not in HIGH/STRONG/MEDIUM/LOW/UNKNOWN vocabulary). Engine must not silently treat garbage as a meaningful level, and must not convert it to a fact.",
    build: () => {
      const c = cleanPositive();
      c.dimensions.buyerFit.value = "HYPERSONIC";
      return c;
    },
    expected: { recommended: "PURSUE_CONDITIONALLY", availableNow: false, invariant: "malformed input must not fabricate a level or a fact", adversarial: true },
    baseline: true,
    // NOTE: pre-fix engine returned PURSUE_CONDITIONALLY (silent downgrade).
    // S10R below asserts the post-fix fail-closed behavior. Both records are kept:
    // S10 preserves the original adversarial case as evidence of why the fix exists.
  },
  {
    id: "S10R",
    claim: "REGRESSION (post-fix S10): malformed enum fail-closes to UNKNOWN/evidence-required path — HOLD_FOR_EVIDENCE, no valid commercial recommendation, reason surfaced.",
    build: () => {
      const c = cleanPositive();
      c.dimensions.buyerFit.value = "HYPERSONIC";
      return c;
    },
    expected: { recommended: "HOLD_FOR_EVIDENCE", availableNow: false, availableConditionally: false, invariant: "malformed input fails closed into evidence-required path" },
    isRegression: true,
  },
  {
    id: "S11",
    claim: "DUPLICATE payment event (same label/amount submitted twice) — exposure must not double-count unless the engine de-duplicates inputs.",
    build: () => {
      const c = cleanPositive();
      c.paymentEvents = [
        { id: "PE-1", label: "Deposit (30%)", amountCny: 25200, daysFromSign: 0, status: "COMPLETE" },
        { id: "PE-1b", label: "Deposit (30%)", amountCny: 25200, daysFromSign: 0, status: "COMPLETE" },
        { id: "PE-2", label: "Balance (70%)", amountCny: 58800, daysFromSign: 45, status: "COMPLETE" },
      ];
      return c;
    },
    expected: { recommended: "PURSUE_NOW", availableNow: true, exposureTotal: 109200, invariant: "duplicate inputs must not silently inflate exposure", adversarial: true },
    baseline: true,
    // NOTE: pre-fix engine returned exposureTotal 109200 (double-counted).
    // S11R below asserts the post-fix de-dup behavior. Both records are kept:
    // S11 preserves the original adversarial case as evidence of why the fix exists.
  },
  {
    id: "S11R",
    claim: "REGRESSION (post-fix S11): duplicate complete payment event is de-duplicated (label+amountCny+daysFromSign), total exposure not inflated, dedupedCount=1.",
    build: () => {
      const c = cleanPositive();
      c.paymentEvents = [
        { id: "PE-1", label: "Deposit (30%)", amountCny: 25200, daysFromSign: 0, status: "COMPLETE" },
        { id: "PE-1b", label: "Deposit (30%)", amountCny: 25200, daysFromSign: 0, status: "COMPLETE" },
        { id: "PE-2", label: "Balance (70%)", amountCny: 58800, daysFromSign: 45, status: "COMPLETE" },
      ];
      return c;
    },
    expected: { recommended: "PURSUE_NOW", availableNow: true, exposureTotal: 84000, dedupedCount: 1, invariant: "duplicate inputs de-duplicated; exposure reflects true commitments" },
    isRegression: true,
  },
  {
    id: "S12",
    claim: "INCONSISTENT SOURCE EVIDENCE: two evidence notes in the same dimension directly contradict each other, but the contradictions array is empty. Does the engine detect it autonomously?",
    build: () => {
      const c = cleanPositive();
      c.dimensions.evidenceQuality.evidence = [
        { tier: "PRIMARY", note: "Buyer confirms order volume in writing (synthetic)." },
        { tier: "PRIMARY", note: "Buyer states the volume figure was a typo and is 10x smaller (synthetic)." },
      ];
      // NOTE: no entry pushed into c.contradictions — simulating a gap in manual screening.
      return c;
    },
    expected: { recommended: "PURSUE_NOW", availableNow: true, invariant: "contradictory material evidence must surface — does the engine self-detect?", adversarial: true },
  },

  // =========================================================================
  // S13–S15 — INBOUND LEAD SCAN (owner task 2026-08-23)
  // Source: cdd-lead-scan.mjs — three real-shaped inbound-lead emails transcribed
  // as anonymized synthetic fixtures. Tags: SYNTHETIC + PRE-MARGIN-GATE.
  // Purpose: L3 (S15) is the key edge case — the system RECEIVES the margin/cost
  // descriptions but the current contract does not semanticize them into an
  // independent go/no-go gate; it fires on the registered authority contradiction
  // (ESCALATE). When a Margin gate is added after the domain review, S15's
  // expected state must flip ESCALATE -> DO_NOT_PURSUE.
  // That flip is the evidence of decision evolution.
  // =========================================================================
  {
    id: "S13",
    claim: "INBOUND L1 (EU distributor, $2M annual, OA-90): cold inbound, all claims self-asserted — volume unverified, OA-90 credit unverified, switch reason UNKNOWN. Evidence-first: HOLD, never a pursuit recommendation from unverified claims.",
    build: () => {
      const c = base();
      c.id = "LEAD-EU-DIST";
      c.name = "EU distributor full-line quote request (anonymized synthetic)";
      c.contradictions = [];
      c.quoteBasesComparable = true;
      c.paymentEvents = [];
      c.unknowns = [
        { id: "UNK-1", label: "Annual purchase volume ($2M)", detail: "Self-asserted; unverified.", blocksPursue: true, resolveWith: "Verified volume / PO history" },
        { id: "UNK-2", label: "Reason for switching supplier", detail: "Unknown — price-driven switch is a risk signal.", blocksPursue: false, resolveWith: "Buyer's switch motivation" },
        { id: "UNK-3", label: "Creditworthiness under OA-90", detail: "No credit history; OA-90 = 90-day payment exposure.", blocksPursue: true, resolveWith: "Credit check / payment terms negotiation" },
      ];
      c.dimensions.buyerFit.value = "MEDIUM";
      c.dimensions.categoryFit.value = "HIGH";
      c.dimensions.evidenceQuality.value = "LOW";
      c.commercialTerms = { status: "INCOMPLETE", detail: "OA 90 days stated as standard; volume and pricing basis not yet negotiated." };
      return c;
    },
    expected: { recommended: "HOLD_FOR_EVIDENCE", availableNow: false, invariant: "unverified volume + OA-90 credit + unknown switch reason -> HOLD, not pursuit" },
    tags: ["SYNTHETIC", "PRE-MARGIN-GATE"],
  },
  {
    id: "S14",
    claim: "INBOUND L2 (industry referral, 500 A-302 samples by Sep 15, 30% T/T + balance): real urgent need + acceptable payment terms, but drawings/BOM not yet provided — the object being quoted is UNKNOWN. Guardrail: no quote without spec evidence.",
    build: () => {
      const c = base();
      c.id = "LEAD-REF-A302";
      c.name = "Industry-referred urgent A-302 component need (anonymized synthetic)";
      c.contradictions = [];
      c.quoteBasesComparable = true;
      c.paymentEvents = [];
      c.unknowns = [
        { id: "UNK-1", label: "A-302 drawings / BOM", detail: "Promised as attachment, not received — the object being quoted is UNKNOWN.", blocksPursue: true, resolveWith: "Receive drawings + BOM" },
        { id: "UNK-2", label: "500-sample feasibility by Sep 15", detail: "Capacity + certification timeline unverified.", blocksPursue: true, resolveWith: "Capacity + timeline check" },
        { id: "UNK-3", label: "CE certification requirements", detail: "Which standard, who bears cost — UNKNOWN.", blocksPursue: false, resolveWith: "Certification spec" },
      ];
      c.dimensions.buyerFit.value = "HIGH";
      c.dimensions.categoryFit.value = "MEDIUM";
      c.dimensions.evidenceQuality.value = "MEDIUM";
      c.commercialTerms = { status: "INCOMPLETE", detail: "Payment acceptable (30% T/T + balance); delivery deadline is a hard, time-bound condition." };
      return c;
    },
    expected: { recommended: "HOLD_FOR_EVIDENCE", availableNow: false, invariant: "no spec evidence -> no quote; referral/urgency does not bypass the spec-unknown guardrail" },
    tags: ["SYNTHETIC", "PRE-MARGIN-GATE"],
  },
  {
    id: "S15",
    claim: "INBOUND L3 (end-customer custom equipment, 5% margin, certification costs on supplier, HQ committee decides): no decision authority at the contact point -> material contradiction -> ESCALATE. KEY EDGE CASE: the system RECEIVES the margin/cost descriptions (commercialFeasibility LOW, '5% margin', 'certification costs on supplier') but the current contract does NOT convert them into an independent, explainable go/no-go gate — it fires on the registered authority contradiction instead. PRE-MARGIN-GATE baseline: ESCALATE expected; after a Margin gate lands this must flip to DO_NOT_PURSUE.",
    build: () => {
      const c = base();
      c.id = "LEAD-CUST-EQ";
      c.name = "End-customer custom-equipment inquiry via intermediary (anonymized synthetic)";
      c.contradictions = [
        { id: "CTR-1", label: "Authority vs commitment", detail: "Contact says decision rests with client HQ committee while requesting a quote — no authority at the contact point.", material: true, status: "UNRESOLVED", resolveWith: "Confirm decision authority / commitment level" },
      ];
      c.quoteBasesComparable = false;
      c.paymentEvents = [];
      c.unknowns = [
        { id: "UNK-1", label: "Specification", detail: "Still being confirmed with end user — the object is UNKNOWN.", blocksPursue: true, resolveWith: "Final spec from end user" },
        { id: "UNK-2", label: "Budget / commitment", detail: "'Budget tight', committee decides — price-discovery risk.", blocksPursue: true, resolveWith: "Budget band + decision authority" },
      ];
      c.dimensions.buyerFit.value = "LOW";
      c.dimensions.categoryFit.value = "MEDIUM";
      c.dimensions.evidenceQuality.value = "LOW";
      c.dimensions.commercialFeasibility.value = "LOW";
      c.commercialTerms = { status: "INCOMPLETE", detail: "5% margin, certification costs on supplier, budget tight — economically marginal." };
      return c;
    },
    expected: { recommended: "ESCALATE", availableNow: false, invariant: "authority contradiction -> ESCALATE under current contract; margin/cost information is received but not semanticized into an independent, explainable go/no-go gate (PRE-MARGIN-GATE)" },
    tags: ["SYNTHETIC", "PRE-MARGIN-GATE"],
    futureFlipNote: "After Margin gate: expected state must become DO_NOT_PURSUE (the commercial killer becomes visible). This flip is the measured evidence of decision evolution.",
  },

  // =========================================================================
  // S16–S18 — KYC GATE regression (owner-authorized implementation, 2026-08-23;
  // verified by kyc-boundary-experiment.mjs). Production engine now reads the
  // structured kyc field: sanctions/adverse -> DO_NOT_PURSUE one-vote veto;
  // KYC incomplete -> HOLD_FOR_EVIDENCE; clear/absent -> pass-through.
  // =========================================================================
  {
    id: "S16",
    claim: "KYC GATE: sanctions hit / adverse finding -> DO_NOT_PURSUE one-vote veto regardless of other signals (margin cannot rescue).",
    build: () => {
      const c = cleanPositive();
      c.kyc = { status: "ADVERSE", sanctionsHit: true, adverseFinding: true, beneficialOwnerVerified: true };
      c.margin = { bps: 2000, note: "high margin cannot rescue sanctions veto" };
      return c;
    },
    expected: { recommended: "DO_NOT_PURSUE", availableNow: false, availableConditionally: false, invariant: "one-vote veto; margin x KYC interaction -> veto wins" },
    tags: ["SYNTHETIC", "KYC-GATE"],
  },
  {
    id: "S17",
    claim: "KYC GATE: KYC incomplete / beneficial owner unknown -> HOLD_FOR_EVIDENCE (evidence-required), even with strong referral + high margin; insurance does not clear it.",
    build: () => {
      const c = cleanPositive();
      c.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false, adverseFinding: false };
      c.margin = { bps: 1800, note: "referral/margin/insurance cannot clear KYC gate" };
      return c;
    },
    expected: { recommended: "HOLD_FOR_EVIDENCE", availableNow: false, availableConditionally: false, invariant: "evidence-required path; insurance is not a KYC substitute" },
    tags: ["SYNTHETIC", "KYC-GATE"],
  },
  {
    id: "S18",
    claim: "KYC GATE: clear KYC passes through unchanged (gate transparent when clear/absent); clean positive path preserved.",
    build: () => {
      const c = cleanPositive();
      c.kyc = { status: "CLEAR", beneficialOwnerVerified: true, sanctionsHit: false, adverseFinding: false };
      return c;
    },
    expected: { recommended: "PURSUE_NOW", availableNow: true, invariant: "gate pass-through; clean-input behavior unchanged" },
    tags: ["SYNTHETIC", "KYC-GATE"],
  },
];

// ---------------------------------------------------------------------------
// Run each scenario deterministically; record ACTUAL verbatim; compare.
// ---------------------------------------------------------------------------
const run = (scenario) => {
  const opp = scenario.build();
  const engine = evaluateDecision(opp);
  const exposure = paymentExposure(opp.paymentEvents);
  const brief = buildBrief(opp, "HOLD_FOR_EVIDENCE", engine);
  return { engine, exposure, brief, opp };
};

const results = [];
const log = [];
for (const s of SCENARIOS) {
  const r = run(s);
  const e = r.engine;
  const brief = r.brief;
  const actual = {
    recommended: e.recommended,
    availableNow: e.available.PURSUE_NOW,
    availableConditionally: e.available.PURSUE_CONDITIONALLY,
    exposureComputed: e.exposure.computed,
    exposureTotalCny: e.exposure.totalCommittedCny ?? null,
    exposurePeakCny: e.exposure.peakWindowCny ?? null,
    dedupedCount: e.exposure.dedupedCount ?? null,
    invalidDimensions: e.invalidDimensions ?? [],
    materialContradictions: e.materialContradictions.length,
    blockingUnknowns: e.blockingUnknowns.length,
    reasons: e.reasons,
    exposureReason: e.exposure.reason ?? null,
    briefHumanBoundary: brief.boundaryNote.includes("Human approval is always required"),
    briefSynthetic: brief.synthetic,
  };

  // -------- compare expected vs actual --------
  const mismatchReasons = [];
  if (actual.recommended !== s.expected.recommended) mismatchReasons.push(`recommended ${actual.recommended} != ${s.expected.recommended}`);
  if (actual.availableNow !== s.expected.availableNow) mismatchReasons.push(`availableNow ${actual.availableNow} != ${s.expected.availableNow}`);
  if (s.expected.availableConditionally !== undefined && actual.availableConditionally !== s.expected.availableConditionally)
    mismatchReasons.push(`availableConditionally ${actual.availableConditionally} != ${s.expected.availableConditionally}`);
  if (s.expected.exposureTotal !== undefined && actual.exposureTotalCny !== s.expected.exposureTotal)
    mismatchReasons.push(`exposureTotal ${actual.exposureTotalCny} != ${s.expected.exposureTotal}`);
  if (s.expected.dedupedCount !== undefined && actual.dedupedCount !== s.expected.dedupedCount)
    mismatchReasons.push(`dedupedCount ${actual.dedupedCount} != ${s.expected.dedupedCount}`);
  if (!actual.briefHumanBoundary) mismatchReasons.push("human-approval boundary note missing from brief");
  if (!actual.briefSynthetic) mismatchReasons.push("synthetic flag missing from brief");

  // S10/S11 are preserved PRE-FIX baselines: their expected state encodes the OLD
  // behavior. After the fix, they MUST diverge — divergence is the evidence the
  // fix exists. A match would mean the fix is absent.
  let verdict;
  if (s.baseline) {
    verdict = mismatchReasons.length === 0 ? "BASELINE_FIX_ABSENT" : "BASELINE_FIX_CONFIRMED";
  } else {
    verdict = mismatchReasons.length === 0 ? "PASS" : "FAIL";
  }

  // -------- boundary variant (S06 only) --------
  let boundary = null;
  if (s.boundaryVariant) {
    const bopp = s.boundaryVariant.build();
    const beng = evaluateDecision(bopp);
    const bactual = { recommended: beng.recommended, availableNow: beng.available.PURSUE_NOW };
    const bMismatch = [];
    if (bactual.recommended !== s.boundaryVariant.expected.recommended) bMismatch.push(`recommended ${bactual.recommended}`);
    if (bactual.availableNow !== s.boundaryVariant.expected.availableNow) bMismatch.push(`availableNow ${bactual.availableNow}`);
    boundary = { actual: bactual, PASS: bMismatch.length === 0, mismatch: bMismatch };
  }

  // -------- INVARIANT checks (independent of exact recommendation) --------
  const invariantChecks = {
    missingNotNegative: !["DO_NOT_PURSUE"].includes(e.recommended) || !["LOW", "UNKNOWN"].includes(String(r.opp.dimensions.evidenceQuality.value || "")),
    unknownPreserved: r.opp.unknowns.every((u) => u.label) && (s.id !== "S04" || e.recommended === "HOLD_FOR_EVIDENCE"),
    humanMandatory: brief.boundaryNote.includes("Human approval is always required"),
    noApprovals: ["supplier selection", "pricing", "margin acceptance", "external communication", "commercial commitment"].every((w) => !brief.boundaryNote.toLowerCase().includes(w)),
  };

  results.push({ ...s, actual, verdict, mismatchReasons, boundary, invariantChecks });

  log.push(`[${verdict}] ${s.id} ${s.claim}`);
  if (s.baseline) log.push(`        (pre-fix baseline — expected to diverge after fix; divergence confirms the fix)`);
  if (s.tags && s.tags.length) log.push(`        tags: ${s.tags.join(", ")}`);
  if (s.futureFlipNote) log.push(`        FUTURE FLIP: ${s.futureFlipNote}`);
  if (mismatchReasons.length) mismatchReasons.forEach((m) => log.push(`        MISMATCH: ${m}`));
  if (boundary) log.push(`        boundary[${s.boundaryVariant.label}]: ${boundary.PASS ? "PASS" : "FAIL " + boundary.mismatch.join("; ")}`);
}

// ---------------------------------------------------------------------------
// Write raw deterministic output (JSON) — preserve everything, nothing collapsed.
// ---------------------------------------------------------------------------
writeFileSync(
  join(OUT, "scenario-results.raw.json"),
  JSON.stringify(
    results.map((r) => ({
      id: r.id,
      claimUnderTest: r.claim,
      inputCondition: r.build(), // full mutated fixture, verbatim
      expectedState: r.expected,
      actualState: r.actual,
      invariantChecks: r.invariantChecks,
      verdict: r.verdict,
      mismatchReasons: r.mismatchReasons,
      baseline: r.baseline === true,
      isRegression: r.isRegression === true,
      tags: r.tags || [],
      futureFlipNote: r.futureFlipNote || null,
      boundaryVariant: r.boundary,
    })),
    null,
    2,
  ),
  "utf8",
);

// ---------------------------------------------------------------------------
// Determinism proof: run the ENTIRE suite twice, independently; engines must be
// byte-identical (JSON.stringify of the full result arrays).
// ---------------------------------------------------------------------------
const firstRun = SCENARIOS.map((s) => JSON.stringify(run(s).engine));
const secondRun = SCENARIOS.map((s) => JSON.stringify(run(s).engine));
const deterministic = JSON.stringify(firstRun) === JSON.stringify(secondRun);
log.push(`\nDETERMINISM: ${deterministic ? "identical across independent runs" : "DIFFERED ACROSS RUNS"}`);
const passCount = results.filter((r) => r.verdict === "PASS").length;
const baselineConfirmed = results.filter((r) => r.verdict === "BASELINE_FIX_CONFIRMED").length;
const failCount = results.filter((r) => r.verdict === "FAIL").length;
const baselineAbsent = results.filter((r) => r.verdict === "BASELINE_FIX_ABSENT").length;
log.push(`SCENARIOS: ${results.length} | PASS ${passCount} | BASELINE_FIX_CONFIRMED ${baselineConfirmed} | FAIL ${failCount} | BASELINE_FIX_ABSENT ${baselineAbsent}`);

writeFileSync(join(OUT, "run-log.txt"), log.join("\n") + "\n", "utf8");
console.log(log.join("\n"));
console.log(`\nRaw output: ${join(OUT, "scenario-results.raw.json")}`);
