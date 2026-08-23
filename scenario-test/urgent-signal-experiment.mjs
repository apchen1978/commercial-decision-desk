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
//   H1: current engine treats urgency as buyerFit HIGH (positive) — benign AND
//       suspicious urgent cases are indistinguishable (baseline confirmed by
//       design-only-scan U-1..U-6 all PURSUE_NOW).
//   H2: an unknown supplier-switch reason under urgency CAN be semanticized with
//       the EXISTING blocking-UNKNOWN primitive -> HOLD_FOR_EVIDENCE, no new gate
//       needed — but only when the caller supplies a structured urgency field.
//   H3: repeated prior-vendor failure is surfaced as a risk signal, NOT an
//       automatic veto — the direction judgment ("紅旗") is C-bucket human
//       intuition (F: 機器讀不出來); the engine's job is to surface, not decide.
//   H4: trusted referral is a positive evidence moderator (S14 used it) but does
//       NOT override a blocking switch-reason UNKNOWN.
//   H5: an already-fired margin veto (BELOW_THRESHOLD -> DO_NOT_PURSUE) takes
//       priority over urgency-direction handling.
//   H6: no new decision state and no new gate semantics are required — blocking
//       UNKNOWN (existing) + surfaced reasons suffice for the representable part.
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
// Experiment variant — additive urgency-direction layer on the current contract.
// Models the SMALLEST faithful representation (H2/H6): blocking-UNKNOWN for
// unknown switch reason under urgency; risk-signal surfacing for repeated
// failure (H3); no auto-veto; referral moderates but does not override (H4);
// margin veto keeps priority (H5).
// ---------------------------------------------------------------------------
export function evaluateWithUrgencyDirection(opp) {
  const base = evaluateDecision(opp); // current contract, unmodified
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

  // H2: urgent + unknown switch reason (not justified) -> blocking UNKNOWN -> HOLD.
  if (isUrgent && switchUnknown && justification !== "JUSTIFIED") {
    return {
      ...base,
      recommended: "HOLD_FOR_EVIDENCE",
      available: { ...base.available, PURSUE_NOW: false, PURSUE_CONDITIONALLY: false },
      reasons: [
        ...base.reasons,
        "URGENCY SIGNAL: supplier-switch reason UNKNOWN under urgency — evidence-required; HOLD until the switch motivation is verified. Human judgment advised (F-domain).",
      ],
      urgencyDirection: "SWITCH_REASON_UNKNOWN",
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

  // H4/H1 default: referral moderates evidence (base already reflects), urgency
  // without unknown switch passes through; justified urgency passes through.
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
    label: "urgent + trusted referral + switch reason UNKNOWN (referral does NOT override)",
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
