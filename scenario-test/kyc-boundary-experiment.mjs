// kyc-boundary-experiment.mjs — REAL KYC boundary experiment (owner-authorized).
// -----------------------------------------------------------------------------
// DESIGN PRINCIPLE: production decision-engine.js is NOT modified. This harness
// models "what the contract WOULD do with a structured KYC field + a sanctions
// veto gate" as an additive variant, and compares it against the current engine
// on the same fixtures. Evidence first; fix proposals STOP at the pre-fix gate.
//
// PRE-REGISTERED EXPECTED BEHAVIOR (declared before execution):
//   H1: sanctions hit / adverse finding -> DO_NOT_PURSUE (one-vote veto) under a
//       KYC gate; the CURRENT engine (no KYC field, sanctions NOT registered as a
//       contradiction in these structured fixtures) returns PURSUE_NOW — the
//       signal is fully invisible to it.
//   H2: KYC incomplete / beneficial owner unknown -> HOLD_FOR_EVIDENCE
//       (evidence-required), downgrading NOW/CONDITIONAL
//   H3: margin does NOT override a KYC veto — high margin + failed KYC still
//       DO_NOT_PURSUE (E's "暴利也斬"); margin×KYC interaction = veto wins
//   H4: low margin + clear KYC -> base engine result stands (margin alone is not
//       a veto in this experiment; margin-as-gate is interview 001's question)
//   H5: insurance availability does NOT clear KYC (independent signals)
//   H6: a STRUCTURED kyc field is invisible to the current engine (no field, no
//       contradiction registration) — base behavior is the clean-positive path;
//       only the gated variant sees the signal. (REVISED pre-declared reading —
//       initial run showed base=PURSUE_NOW, not ESCALATE, because these fixtures
//       carry the signal in kyc.*, not in contradictions[].)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDecision, paymentExposure, buildBrief } from "../decision-engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "outputs");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Synthetic fixture template with STRUCTURED kyc + margin fields (design-only
// extension of the input contract, NOT a production schema change).
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
    // --- structured fields under experiment (NOT read by production engine) ---
    kyc: { status: "CLEAR", beneficialOwnerVerified: true, sanctionsHit: false, adverseFinding: false },
    margin: { bps: 0, thresholdBps: null, costPayer: "BUYER", note: "" },
  };
}

// ---------------------------------------------------------------------------
// Experiment variant — additive KYC gate layer on top of the CURRENT contract.
// This is the harness's model of "contract + structured KYC + veto gate".
// It does NOT modify decision-engine.js; it composes with it.
// ---------------------------------------------------------------------------
export function evaluateWithKycGate(opp) {
  const base = evaluateDecision(opp); // current contract, unmodified
  const k = opp.kyc || {};
  const sanctionsHit = k.sanctionsHit === true || k.adverseFinding === true;
  const kycIncomplete = k.status === "INCOMPLETE" || k.beneficialOwnerVerified === false;

  if (sanctionsHit) {
    // H1 + H3: one-vote veto — margin and commercial signals cannot rescue.
    return {
      ...base,
      recommended: "DO_NOT_PURSUE",
      available: { ...base.available, PURSUE_NOW: false, PURSUE_CONDITIONALLY: false },
      reasons: [
        ...base.reasons,
        "KYC GATE: sanctions/adverse finding — one-vote veto; DO_NOT_PURSUE regardless of margin or commercial signals.",
      ],
      kycGate: "SANCTIONS_VETO",
    };
  }
  if (kycIncomplete) {
    // H2: evidence-required path; H5: insurance does not clear it.
    return {
      ...base,
      recommended: "HOLD_FOR_EVIDENCE",
      available: { ...base.available, PURSUE_NOW: false, PURSUE_CONDITIONALLY: false },
      reasons: [
        ...base.reasons,
        "KYC GATE: beneficial-owner verification incomplete — evidence-required; HOLD_FOR_EVIDENCE. Insurance availability does not clear this gate.",
      ],
      kycGate: "KYC_INCOMPLETE",
    };
  }
  // H4: KYC clear — base engine result stands (margin alone is not a veto here).
  return { ...base, kycGate: "CLEAR" };
}

// ---------------------------------------------------------------------------
// Cases — 6 KYC + 4 margin×KYC interaction (all SYNTHETIC / DESIGN-ONLY).
// EXPECTED declared here, before running.
// ---------------------------------------------------------------------------
const CASES = [
  {
    id: "KYC-E1",
    label: "KYC confirmed clear",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("E1", "Clear KYC"); o.kyc = { status: "CLEAR", beneficialOwnerVerified: true, sanctionsHit: false, adverseFinding: false }; return o; },
  },
  {
    id: "KYC-E2",
    label: "KYC incomplete / beneficial owner unknown",
    expected: { base: "PURSUE_NOW", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("E2", "KYC incomplete"); o.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false, adverseFinding: false }; return o; },
  },
  {
    id: "KYC-E3",
    label: "sanctions hit / adverse finding",
    expected: { base: "PURSUE_NOW", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("E3", "Sanctions hit"); o.kyc = { status: "ADVERSE", beneficialOwnerVerified: true, sanctionsHit: true, adverseFinding: true }; return o; },
  },
  {
    id: "KYC-E4",
    label: "insurance available but KYC unresolved",
    expected: { base: "PURSUE_NOW", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("E4", "Insurable, KYC unresolved"); o.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false, adverseFinding: false }; o.margin.note = "insurable (中信保) but KYC unresolved"; return o; },
  },
  {
    id: "KYC-E5",
    label: "HIGH-MARGIN deal with failed KYC (margin × KYC interaction)",
    expected: { base: "PURSUE_NOW", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("E5", "High margin + failed KYC"); o.kyc = { status: "ADVERSE", beneficialOwnerVerified: true, sanctionsHit: true, adverseFinding: true }; o.margin = { bps: 2000, thresholdBps: null, costPayer: "BUYER", note: "high-margin label (structured bps=2000); sanctions veto must win" }; return o; },
  },
  {
    id: "KYC-E6",
    label: "LOW-MARGIN deal with clear KYC (margin alone is not a veto here)",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("E6", "Low margin + clear KYC"); o.kyc = { status: "CLEAR", beneficialOwnerVerified: true, sanctionsHit: false, adverseFinding: false }; o.margin = { bps: 300, thresholdBps: null, costPayer: "SUPPLIER", note: "low margin; margin-as-gate is interview 001, not this experiment" }; return o; },
  },
  {
    id: "KYC-E7",
    label: "sanctions hit + high margin + insurance available (all three)",
    expected: { base: "PURSUE_NOW", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("E7", "Sanctions + high margin + insurable"); o.kyc = { status: "ADVERSE", beneficialOwnerVerified: true, sanctionsHit: true, adverseFinding: true }; o.margin = { bps: 2500, thresholdBps: null, costPayer: "BUYER", note: "insurance + high margin cannot rescue sanctions veto" }; return o; },
  },
  {
    id: "KYC-E8",
    label: "KYC incomplete + strong referral + high margin (evidence-required wins)",
    expected: { base: "PURSUE_NOW", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("E8", "Referral + high margin, KYC incomplete"); o.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false, adverseFinding: false }; o.margin = { bps: 1800, thresholdBps: null, costPayer: "BUYER", note: "referral/margin cannot clear KYC gate" }; return o; },
  },
  {
    id: "KYC-E9",
    label: "clear KYC + clear base → gate passes through unchanged",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("E9", "Everything clear"); o.kyc = { status: "CLEAR", beneficialOwnerVerified: true, sanctionsHit: false, adverseFinding: false }; return o; },
  },
  {
    id: "KYC-E10",
    label: "KYC incomplete + weak evidence (HOLD either way — gate and base agree)",
    expected: { base: "HOLD_FOR_EVIDENCE", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("E10", "KYC incomplete + weak evidence"); o.kyc = { status: "INCOMPLETE", beneficialOwnerVerified: false, sanctionsHit: false, adverseFinding: false }; o.dimensions.evidenceQuality.value = "LOW"; return o; },
  },
];

// ---------------------------------------------------------------------------
// Run both engines on every case; compare against pre-registered expected.
// ---------------------------------------------------------------------------
const results = [];
const log = [];
for (const c of CASES) {
  const opp = c.build();
  const base = evaluateDecision(opp);
  const gated = evaluateWithKycGate(opp);
  const brief = buildBrief(opp, "HOLD_FOR_EVIDENCE", base);
  const actual = { base: base.recommended, gated: gated.recommended, gatedGate: gated.kycGate, briefHumanBoundary: brief.boundaryNote.includes("Human approval is always required") };
  const mismatch = [];
  if (actual.base !== c.expected.base) mismatch.push(`base ${actual.base} != ${c.expected.base}`);
  if (actual.gated !== c.expected.gated) mismatch.push(`gated ${actual.gated} != ${c.expected.gated}`);
  if (!actual.briefHumanBoundary) mismatch.push("human-approval boundary missing");
  const PASS = mismatch.length === 0;
  results.push({ id: c.id, label: c.label, expected: c.expected, actual, kyc: opp.kyc, margin: opp.margin, PASS, mismatch });
  log.push(`[${PASS ? "PASS" : "FAIL"}] ${c.id} ${c.label} | base=${actual.base} gated=${actual.gated} (exp base=${c.expected.base} gated=${c.expected.gated})`);
  mismatch.forEach((m) => log.push(`      MISMATCH: ${m}`));
}

writeFileSync(join(OUT, "kyc-boundary-results.raw.json"), JSON.stringify(results, null, 2), "utf8");
log.push(`\nCASES: ${results.length} | PASS ${results.filter((r) => r.PASS).length} | FAIL ${results.filter((r) => !r.PASS).length}`);
writeFileSync(join(OUT, "kyc-boundary-run-log.txt"), log.join("\n") + "\n", "utf8");
console.log(log.join("\n"));
console.log(`\nRaw: ${join(OUT, "kyc-boundary-results.raw.json")}`);
