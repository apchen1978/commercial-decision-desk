// kyc-boundary-experiment.mjs — KYC boundary experiment (owner-authorized).
// -----------------------------------------------------------------------------
// PHASE 2 (post-fix): the production engine now HAS the KYC gate (owner-authorized
// implementation, commit after 9c1ae4a). This harness re-runs the same 10 cases
// against the PRODUCTION engine to confirm the implemented gate matches the
// experiment's verified semantics. Phase 1 (pre-fix, additive-variant comparison)
// is preserved in EXPERIMENT_KYC_BOUNDARY_001.md.
//
// PRE-REGISTERED EXPECTED BEHAVIOR (declared before execution):
//   H1: sanctions hit / adverse finding -> DO_NOT_PURSUE (one-vote veto)
//   H2: KYC incomplete / beneficial owner unknown -> HOLD_FOR_EVIDENCE
//   H3: margin does NOT override a KYC veto (margin×KYC: veto wins)
//   H4: low margin + clear KYC -> base engine result stands (margin not a veto)
//   H5: insurance availability does NOT clear KYC
//   H6: absent kyc field -> no gate behavior (clean-input unchanged)
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
// (Phase-1 variant `evaluateWithKycGate` removed: the production engine now
// implements the gate itself — this harness validates production behavior
// directly, preserving the phase-1 pre-fix baseline in `expected.base`.)
// ---------------------------------------------------------------------------

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
// Run the PRODUCTION engine (now with the implemented KYC gate) on every case;
// compare against the pre-registered gate semantics (expected.gated). The
// expected.base column is retained as the phase-1 (pre-fix) reference: it is the
// behavior the engine exhibited before the gate existed.
// ---------------------------------------------------------------------------
const results = [];
const log = [];
for (const c of CASES) {
  const opp = c.build();
  const eng = evaluateDecision(opp); // production engine, gate implemented
  const brief = buildBrief(opp, "HOLD_FOR_EVIDENCE", eng);
  const actual = { recommended: eng.recommended, kycGate: eng.kycGate, preFixBase: c.expected.base, briefHumanBoundary: brief.boundaryNote.includes("Human approval is always required") };
  const mismatch = [];
  if (actual.recommended !== c.expected.gated) mismatch.push(`recommended ${actual.recommended} != gated ${c.expected.gated}`);
  if (eng.kycGate === "ABSENT" && c.id !== "KYC-E1") mismatch.push("kycGate ABSENT — gate not engaged");
  if (!actual.briefHumanBoundary) mismatch.push("human-approval boundary missing");
  const PASS = mismatch.length === 0;
  results.push({ id: c.id, label: c.label, expectedGated: c.expected.gated, preFixBase: c.expected.base, actual, kyc: opp.kyc, margin: opp.margin, PASS, mismatch });
  log.push(`[${PASS ? "PASS" : "FAIL"}] ${c.id} ${c.label} | production=${actual.recommended} (gate=${actual.kycGate}; pre-fix base=${c.expected.base}; exp gated=${c.expected.gated})`);
  mismatch.forEach((m) => log.push(`      MISMATCH: ${m}`));
}

writeFileSync(join(OUT, "kyc-boundary-results.raw.json"), JSON.stringify(results, null, 2), "utf8");
log.push(`\nCASES: ${results.length} | PASS ${results.filter((r) => r.PASS).length} | FAIL ${results.filter((r) => !r.PASS).length}`);
writeFileSync(join(OUT, "kyc-boundary-run-log.txt"), log.join("\n") + "\n", "utf8");
console.log(log.join("\n"));
console.log(`\nRaw: ${join(OUT, "kyc-boundary-results.raw.json")}`);
