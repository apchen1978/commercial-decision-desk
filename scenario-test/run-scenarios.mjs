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
  if (s.expected.exposureTotal !== undefined && actual.exposureTotalCny !== s.expected.exposureTotal)
    mismatchReasons.push(`exposureTotal ${actual.exposureTotalCny} != ${s.expected.exposureTotal}`);
  if (!actual.briefHumanBoundary) mismatchReasons.push("human-approval boundary note missing from brief");
  if (!actual.briefSynthetic) mismatchReasons.push("synthetic flag missing from brief");

  const PASS = mismatchReasons.length === 0;

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

  results.push({ ...s, actual, PASS, mismatchReasons, boundary, invariantChecks });

  const status = PASS ? "PASS" : "FAIL";
  log.push(`[${status}] ${s.id} ${s.claim}`);
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
      PASS: r.PASS,
      mismatchReasons: r.mismatchReasons,
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
log.push(`SCENARIOS: ${results.length} | PASS ${results.filter((r) => r.PASS).length} | FAIL ${results.filter((r) => !r.PASS).length}`);

writeFileSync(join(OUT, "run-log.txt"), log.join("\n") + "\n", "utf8");
console.log(log.join("\n"));
console.log(`\nRaw output: ${join(OUT, "scenario-results.raw.json")}`);
