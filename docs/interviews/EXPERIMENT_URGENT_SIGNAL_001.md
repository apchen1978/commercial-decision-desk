# Experiment Record — Urgent-Order Dual-Signal Boundary Experiment（owner-authorized, 2026-08-23）

> **MODE**: DESIGN-ONLY synthetic boundary experiment. **STATUS**: evidence produced;
> **no production change — STOP at pre-fix owner review gate.**
> **Repo**: apchen1978/commercial-decision-desk @ `52042cb` (experiment start).
> **Harness**: `scenario-test/urgent-signal-experiment.mjs` (in-memory; **production
> decision-engine.js NOT modified** — the urgency-direction layer is an additive variant).
> **Raw output**: `scenario-test/outputs/urgent-signal-results.raw.json` + `run-log.txt`.
> **Context**: F (SOHO trader, RECORD_DEF) claims "急著換供應商的客戶八成自己問題" —
> urgency + supplier-switch is usually a red flag; engine currently treats urgency as
> buyerFit HIGH. Interview 003 deferred per owner (building phase). All semantics
> PROVISIONAL — NOT DOMAIN CONSENSUS (single interviewee F).

---

## 1. Method

- Pre-registered hypotheses H1–H6 declared in the harness **before** execution.
- Same synthetic fixtures run through **two** engines:
  - `base` = current production `evaluateDecision` (unmodified, no urgency field);
  - `gated` = additive urgency-direction layer (structured `urgency.*` + the
    SMALLEST faithful representation: blocking-UNKNOWN for unknown switch reason
    under urgency; risk-signal surfacing for repeated failure; no auto-veto).
- 10 cases covering the dual-signal space: benign urgent (verified/justified/
  referral), suspicious urgent (unknown switch / repeated failure), margin-priority
  interplay, weak-payment, non-urgent control.

## 2. Pre-registered hypotheses → results

| H | Hypothesis | Result |
|---|---|---|
| H1 | Current engine treats urgency as buyerFit HIGH (positive) — benign AND suspicious urgent cases indistinguishable | **CONFIRMED** (U-S2/U-S4 base=PURSUE_NOW, same as U-S1/U-S6) |
| H2 | Unknown switch reason under urgency CAN be semanticized with the EXISTING blocking-UNKNOWN primitive → HOLD; no new gate needed | **CONFIRMED** (U-S2/U-S4 gated=HOLD_FOR_EVIDENCE) |
| H3 | Repeated prior-vendor failure → risk signal surfaced, NOT auto-veto (direction judgment is C-bucket human intuition) | **CONFIRMED** (U-S3 gated=PURSUE_NOW + PRIOR_FAILURE_RISK reason) |
| H4 | Trusted referral moderates evidence but does NOT override a blocking switch-reason UNKNOWN | **CONFIRMED** (U-S4 gated=HOLD despite referral; U-S10 benign passes) |
| H5 | An already-fired margin veto (BELOW_THRESHOLD → DO_NOT_PURSUE) takes priority over urgency handling | **CONFIRMED** (U-S7 gated=DO_NOT_PURSUE, MARGIN_VETO_PRIORITY) |
| H6 | No new decision state / no new gate semantics required — blocking UNKNOWN + surfaced reasons suffice for the representable part | **CONFIRMED** (design conclusion) |

**10/10 PASS, 0 FAIL.**

## 3. Key findings

1. **The dual signal is real but partially representable.** The engine cannot
   distinguish "urgent + unknown switch reason" (F's red flag) from "urgent +
   verified/justified switch" — both are buyerFit HIGH. The representable part is
   the **unknown switch reason**; it maps cleanly onto the existing blocking-UNKNOWN
   primitive (HOLD), requiring **no new gate and no new state**.

2. **The direction judgment stays human (C bucket).** F herself says the red-flag
   instinct "機器讀不出來". The experiment confirms the smallest faithful engine
   behavior is to **surface** (unknown switch reason → HOLD with reason; repeated
   failure → risk-signal reason) and let the human apply the intuition — the engine
   must NOT auto-veto on "urgent = suspicious".

3. **Priority order established for the variant:** margin veto (BELOW_THRESHOLD →
   DO_NOT_PURSUE) > urgency-unknown-switch (→ HOLD) > pass-through. Consistent with
   the KYC gate priority chain (sanctions > margin > KYC-incomplete > rules).

4. **Referral is a moderator, not an override** — a trusted referral does not clear
   a blocking switch-reason UNKNOWN (U-S4 HOLD), but a fully verified+referred case
   passes (U-S10).

5. **Non-urgent unknown switch reason passes through** (U-S9) — the signal only
   fires under urgency, matching F's framing (the risk is urgency × unknown switch).

## 4. UNKNOWNs preserved / created

- U1: Should urgency-direction become a *production* contract field? → UNKNOWN —
  owner/Codex decision; interview 003 deferred.
- U2: Is the unknown-switch-reason → HOLD mapping correct across profiles, or
  SOHO-specific (F's single sample)? → UNKNOWN — sample size 1.
- U3: Does repeated-failure surfacing need a structured `priorVendorHistory` field,
  or is the reason string enough? → UNKNOWN (no build recommended without more evidence).
- U4: Referral semantics (evidence-tier vs buyerFit) → UNKNOWN (S14 treated referral
  as positive; F's claim only constrains urgency×switch).
- All existing S01–S19 UNKNOWNs preserved.

## 5. Classification (per owner taxonomy)

| Case | Finding | Class |
|---|---|---|
| U-S2/U-S4 base=PURSUE_NOW | Urgency×unknown-switch invisible to engine | **missing boundary** — RECEIVED BUT NOT SEMANTICIZED (no field, no registered unknown) |
| U-S2/U-S4 gated=HOLD | Representable via EXISTING blocking-UNKNOWN | **design-viable, minimal** (no new gate) |
| U-S3 | Repeated failure surfaced, not vetoed | **C-bucket boundary respected** (human judgment) |
| U-S7 | Margin veto priority | **consistent with KYC gate chain** |
| U-S9 | Non-urgent passes | **signal is urgency-scoped** (matches F's framing) |

No engine defect; the gap is a **missing boundary** (no structured urgency input),
plus an explicit **C-bucket boundary** (direction judgment stays human).

## 6. Verdict

**B — EVIDENCE_FOUND_FIX_RECOMMENDED.** The representable core (unknown switch
reason under urgency → blocking UNKNOWN → HOLD) is small, faithful, and uses the
existing contract — no new gate semantics. The direction judgment ("紅旗") is
C-bucket and must NOT be engine-decided.

**FIX PROPOSAL (NOT applied — pre-fix owner review gate):**
Smallest production change: add a structured `urgency` field to the input contract
(`isUrgent`, `switchReason: VERIFIED|UNKNOWN|REPEATED_FAILURE`, `justification`,
`referral`) and a small gate at the top of `evaluateDecision`: urgent + unknown
switch reason (not justified) → blocking-UNKNOWN semantics → HOLD_FOR_EVIDENCE;
repeated failure → surfacing reason only. No scoring, no new states, no new
dependencies. Clean-input behavior unchanged. **Requires owner/Codex review — not
authorized by this experiment.** Alternative (smaller): document that callers
should register unknown switch reasons as blocking UNKNOWNs themselves — zero
engine change, same HOLD outcome (U-S2 shows the primitive already works when the
caller supplies it).

## 7. Maturity & status

- **CDD MATURITY: LEVEL 2 — SCENARIO TESTED (CONFIRMED).**
- LEVEL 3 DOMAIN REVIEWED: NOT CLAIMED.
- URGENT SIGNAL SEMANTICS: **UNKNOWN / OWNER REVIEW REQUIRED** (experiment evidence
  now exists; interview 003 deferred).
- KYC GATE: implemented (provisional). MARGIN GATE: implemented (provisional).
- ENGINE: UNCHANGED by this experiment. All cases SYNTHETIC / DESIGN-ONLY.
