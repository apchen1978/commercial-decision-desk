// urgent-signal-experiment.mjs — URGENT-ORDER DUAL-SIGNAL boundary experiment.
// -----------------------------------------------------------------------------
// OWNER-AUTHORIZED: design-only boundary experiment (no production change).
// MODE: additive variant composed on top of the current contract — production
// decision-engine.js is NOT modified.
//
// CONTEXT: F (SOHO trader) claims "急著換供應商的客戶八成自己問題" — urgency +
// supplier-switch is usually a RED FLAG, while the engine currently treats
// urgency as buyerFit HIGH (positive). Interview 003 (deferred) asks whether
// urgency direction should be a contract signal, a profile-tagged modifier, or
// remain C-bucket human judgment. F herself says the instinct "機器讀不出來".
//
// PRE-REGISTERED HYPOTHESES (declared before execution):
//   H1: the current engine IGNORES structured urgency entirely — when the fixture
//       carries positive Buyer Fit, benign AND suspicious urgent cases are
//       indistinguishable (both PURSUE_NOW). Causality: engine does not read
//       urgency; the fixture's buyerFit drives the result. (Baseline confirmed by
//       design-only-scan U-1..U-6.)
//   H2: an unknown supplier-switch reason under urgency CAN be represented by
//       INJECTING a blocking UNKNOWN into unknowns[] and letting the EXISTING
//       engine rule produce HOLD_FOR_EVIDENCE naturally — no new gate needed.
//       (Variant must actually exercise the primitive: push to unknowns[], then
//       call evaluateDecision on the mutated fixture; it must NOT manually
//       overlay recommended/available.)
//   H3: repeated prior-vendor failure is surfaced as a risk signal, NOT an
//       automatic veto — the direction judgment ("紅旗") is C-bucket human
//       intuition (F: 機器讀不出來); the engine's job is to surface, not decide.
//   H4: referral does NOT override the blocking treatment — an urgent case with
//       unknown switch reason stays HOLD even when a trusted referral exists.
//       (Claim is scoped to 'does not override'; referral-as-evidence-moderator
//       is NOT tested here — fixture referral flag is recorded, not consumed.)
//   H5: an already-fired margin veto (BELOW_THRESHOLD -> DO_NOT_PURSUE) takes
//       priority over the urgency-unknown-switch HOLD (margin veto ranks 2nd in
//       the priority chain, blocking-UNKNOWN ranks lower).
//   H6: no new decision state and no new gate semantics are required — the
//       existing blocking-UNKNOWN rule + surfaced reasons suffice.
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
    // --- structured urgency field (experiment input; NOT read by production engine) ---
    urgency: { isUrgent: false, switchReason: "ABSENT", justification: "ABSENT", referral: false, priorVendorHistory: "ABSENT" },
  };
}

// ---------------------------------------------------------------------------
// Experiment variant — urgency-direction layer that ACTUALLY exercises the
// existing blocking-UNKNOWN primitive: it mutates a COPY of the opportunity,
// injects the unknown switch reason into unknowns[] (blocksPursue: true), then
// re-runs the unmodified production evaluateDecision. It does NOT manually
// overlay recommended/available — the existing engine rule produces the HOLD.
// H3 (repeated failure) stays surfacing-only (reason appended), NOT injected —
// that direction judgment is C-bucket. H5: margin veto naturally outranks the
// injected blocking unknown (priority chain: sanctions > margin > ... > blocking
// UNKNOWN).
// ---------------------------------------------------------------------------
export function evaluateWithUrgencyDirection(opp) {
  const base = evaluateDecision(opp); // current contract, unmodified (baseline)
  const u = opp.urgency || {};
  const isUrgent = u.isUrgent === true;
  const switchReason = String(u.switchReason || "").toUpperCase();
  const justification = String(u.justification || "").toUpperCase();
  const referral = u.referral === true;
  const repeatedFailure = switchReason === "REPEATED_FAILURE";
  const switchUnknown = switchReason === "UNKNOWN";

  // H5: margin veto already fired -> keep DO_NOT_PURSUE (priority over HOLD).
  if (base.recommended === "DO_NOT_PURSUE" && base.marginGate === "BELOW_THRESHOLD") {
    return { ...base, urgencyDirection: "MARGIN_VETO_PRIORITY" };
  }

  // H2: urgent + unknown switch reason (not justified) -> INJECT a blocking
  // UNKNOWN into unknowns[] and re-run the EXISTING engine. The engine's own
  // blocking-UNKNOWN rule must produce HOLD_FOR_EVIDENCE naturally.
  if (isUrgent && switchUnknown && justification !== "JUSTIFIED") {
    const mutated = JSON.parse(JSON.stringify(opp));
    mutated.unknowns = [...(mutated.unknowns || []), { id: "U-SWITCH-REASON", label: "Supplier-switch reason", detail: "Unknown under urgency — switch motivation unverified (F-domain red-flag context); HOLD until verified.", blocksPursue: true, resolveWith: "Verified switch motivation from the buyer" }];
    const eng = evaluateDecision(mutated); // unmodified engine on the injected fixture
    return {
      ...eng,
      reasons: [
        ...eng.reasons,
        "URGENCY SIGNAL: injected blocking UNKNOWN 'Supplier-switch reason' — HOLD produced by the existing blocking-UNKNOWN rule (not a manual overlay).",
      ],
      urgencyDirection: "SWITCH_REASON_UNKNOWN_VIA_BLOCKING_UNKNOWN",
      injectedUnknown: true,
    };
  }

  // H3: repeated prior-vendor failure -> risk signal surfaced, NOT auto-veto.
  if (isUrgent && repeatedFailure) {
    return {
      ...base,
      reasons: [
        ...base.reasons,
        "URGENCY SIGNAL: prior-vendor repeated failure — risk signal surfaced for human judgment (domain note: often buyer-caused); NOT an automatic veto.",
      ],
      urgencyDirection: "PRIOR_FAILURE_RISK",
    };
  }

  // H4: referral is RECORDED but does NOT override; urgency without unknown
  // switch reason passes through (referral-as-evidence-moderator is NOT tested).
  const direction = isUrgent ? (justification === "JUSTIFIED" ? "JUSTIFIED" : "URGENT_CLEAR") : "NON_URGENT";
  return { ...base, urgencyDirection: direction };
}

// ---------------------------------------------------------------------------
// Cases — 10 dual-signal cases (all SYNTHETIC / DESIGN-ONLY). EXPECTED declared
// here, before running. base = production engine; gated = variant.
// ---------------------------------------------------------------------------
const CASES = [
  {
    id: "U-S1",
    label: "urgent + switch reason VERIFIED (benign)",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("U-S1", "Urgent, verified switch"); o.urgency = { isUrgent: true, switchReason: "VERIFIED", justification: "JUSTIFIED", referral: false }; return o; },
  },
  {
    id: "U-S2",
    label: "urgent + switch reason UNKNOWN (F's red flag — the core case)",
    expected: { base: "PURSUE_NOW", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("U-S2", "Urgent, unknown switch"); o.urgency = { isUrgent: true, switchReason: "UNKNOWN", justification: "ABSENT", referral: false }; return o; },
  },
  {
    id: "U-S3",
    label: "urgent + repeated prior-vendor failure (risk signal, not veto)",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("U-S3", "Urgent, prior failure"); o.urgency = { isUrgent: true, switchReason: "REPEATED_FAILURE", justification: "ABSENT", referral: false, priorVendorHistory: "REPEATED_FAILURE" }; return o; },
  },
  {
    id: "U-S4",
    label: "urgent + trusted referral + switch reason UNKNOWN (referral does NOT override the blocking treatment)",
    expected: { base: "PURSUE_NOW", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("U-S4", "Urgent, referral, unknown switch"); o.urgency = { isUrgent: true, switchReason: "UNKNOWN", justification: "ABSENT", referral: true }; return o; },
  },
  {
    id: "U-S5",
    label: "urgent + weak payment history (already HOLD via blocking unknown)",
    expected: { base: "HOLD_FOR_EVIDENCE", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("U-S5", "Urgent, weak payment history"); o.urgency = { isUrgent: true, switchReason: "VERIFIED", justification: "JUSTIFIED", referral: false }; o.unknowns.push({ id: "U-PH", label: "Buyer payment history", detail: "weak/unverified", blocksPursue: true }); return o; },
  },
  {
    id: "U-S6",
    label: "urgent + operationally justified (CE deadline; benign)",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("U-S6", "Urgent, justified deadline"); o.urgency = { isUrgent: true, switchReason: "VERIFIED", justification: "JUSTIFIED", referral: false }; return o; },
  },
  {
    id: "U-S7",
    label: "urgent + switch UNKNOWN + margin BELOW threshold (margin veto priority)",
    expected: { base: "DO_NOT_PURSUE", gated: "DO_NOT_PURSUE" },
    build: () => { const o = baseOpp("U-S7", "Urgent, unknown switch, low margin"); o.urgency = { isUrgent: true, switchReason: "UNKNOWN", justification: "ABSENT", referral: false }; o.margin = { bps: 300, thresholdBps: 800 }; return o; },
  },
  {
    id: "U-S8",
    label: "urgent + switch UNKNOWN + weak evidence (HOLD either way)",
    expected: { base: "HOLD_FOR_EVIDENCE", gated: "HOLD_FOR_EVIDENCE" },
    build: () => { const o = baseOpp("U-S8", "Urgent, unknown switch, weak evidence"); o.urgency = { isUrgent: true, switchReason: "UNKNOWN", justification: "ABSENT", referral: false }; o.dimensions.evidenceQuality.value = "LOW"; return o; },
  },
  {
    id: "U-S9",
    label: "non-urgent + switch reason UNKNOWN (no urgency signal — pass-through)",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("U-S9", "Not urgent, unknown switch"); o.urgency = { isUrgent: false, switchReason: "UNKNOWN", justification: "ABSENT", referral: false }; return o; },
  },
  {
    id: "U-S10",
    label: "urgent + switch VERIFIED + trusted referral (fully benign)",
    expected: { base: "PURSUE_NOW", gated: "PURSUE_NOW" },
    build: () => { const o = baseOpp("U-S10", "Urgent, verified, referral"); o.urgency = { isUrgent: true, switchReason: "VERIFIED", justification: "JUSTIFIED", referral: true }; return o; },
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
  const gated = evaluateWithUrgencyDirection(opp);
  const brief = buildBrief(opp, "HOLD_FOR_EVIDENCE", base);
  const actual = { base: base.recommended, gated: gated.recommended, urgencyDirection: gated.urgencyDirection, briefHumanBoundary: brief.boundaryNote.includes("Human approval is always required") };
  const mismatch = [];
  if (actual.base !== c.expected.base) mismatch.push(`base ${actual.base} != ${c.expected.base}`);
  if (actual.gated !== c.expected.gated) mismatch.push(`gated ${actual.gated} != ${c.expected.gated}`);
  if (!actual.briefHumanBoundary) mismatch.push("human-approval boundary missing");
  const PASS = mismatch.length === 0;
  results.push({ id: c.id, label: c.label, expected: c.expected, actual, urgency: opp.urgency, margin: opp.margin ?? null, PASS, mismatch });
  log.push(`[${PASS ? "PASS" : "FAIL"}] ${c.id} ${c.label} | base=${actual.base} gated=${actual.gated} (${actual.urgencyDirection})`);
  mismatch.forEach((m) => log.push(`      MISMATCH: ${m}`));
}

writeFileSync(join(OUT, "urgent-signal-results.raw.json"), JSON.stringify(results, null, 2), "utf8");
log.push(`\nCASES: ${results.length} | PASS ${results.filter((r) => r.PASS).length} | FAIL ${results.filter((r) => !r.PASS).length}`);
writeFileSync(join(OUT, "urgent-signal-run-log.txt"), log.join("\n") + "\n", "utf8");
console.log(log.join("\n"));
console.log(`\nRaw: ${join(OUT, "urgent-signal-results.raw.json")}`);
