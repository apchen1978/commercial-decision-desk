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
| H1 | Current engine IGNORES structured urgency — benign AND suspicious urgent cases are indistinguishable when the fixture carries positive Buyer Fit (causality: engine does not read urgency; fixture buyerFit drives the result) | **CONFIRMED** (U-S2/U-S4 base=PURSUE_NOW, same as U-S1/U-S6) |
| H2 | Unknown switch reason under urgency → INJECT a blocking UNKNOWN into `unknowns[]` and let the EXISTING engine rule produce HOLD naturally; no new gate | **CONFIRMED VIA PRIMITIVE** — variant pushes `{id:"U-SWITCH-REASON", blocksPursue:true}` into `unknowns[]`, then re-runs the UNMODIFIED `evaluateDecision`; the engine's own blocking-UNKNOWN rule produces HOLD_FOR_EVIDENCE (no manual overlay of recommended/available) |
| H3 | Repeated prior-vendor failure → risk signal surfaced, NOT auto-veto (direction judgment is C-bucket human intuition) | **CONFIRMED** (U-S3 gated=PURSUE_NOW + PRIOR_FAILURE_RISK reason) |
| H4 | Referral does NOT override the blocking treatment — urgent + unknown switch stays HOLD even with a trusted referral. Scoped to 'does not override'; referral-as-evidence-moderator is NOT tested (fixture referral flag is recorded, not consumed as a moderator) | **CONFIRMED (scoped)** (U-S4 gated=HOLD despite referral; U-S10 fully benign passes) |
| H5 | An already-fired margin veto (BELOW_THRESHOLD → DO_NOT_PURSUE) takes priority over the injected blocking UNKNOWN | **CONFIRMED** (U-S7 gated=DO_NOT_PURSUE, MARGIN_VETO_PRIORITY — consistent with priority chain: sanctions > margin > … > blocking UNKNOWN) |
| H6 | No new decision state / no new gate semantics required — the existing blocking-UNKNOWN rule + surfaced reasons suffice | **CONFIRMED** (design conclusion, now directly exercised) |

**10/10 PASS, 0 FAIL.**

## 3. Key findings

1. **The dual signal is real but partially representable — via the EXISTING
   primitive.** The engine cannot distinguish "urgent + unknown switch reason"
   (F's red flag) from "urgent + verified/justified switch" — both are buyerFit
   HIGH because the engine ignores structured urgency entirely. The representable
   part is the **unknown switch reason**: INJECTING it as a blocking UNKNOWN into
   `unknowns[]` makes the UNMODIFIED engine produce `HOLD_FOR_EVIDENCE` through its
   own rule. **No new gate, no new state, no manual result overlay** — verified
   directly (U-S2/U-S4 gated path re-runs `evaluateDecision` on the injected fixture).

2. **The direction judgment stays human (C bucket).** F herself says the red-flag
   instinct "機器讀不出來". The experiment confirms the smallest faithful engine
   behavior is to **surface** (inject the unknown switch reason → HOLD via the
   engine's own rule; repeated failure → risk-signal reason) and let the human
   apply the intuition — the engine must NOT auto-veto on "urgent = suspicious".

3. **Priority order confirmed through the engine's own chain:** margin veto
   (BELOW_THRESHOLD → DO_NOT_PURSUE) > injected blocking UNKNOWN (→ HOLD) —
   consistent with sanctions > margin > KYC-incomplete > … > blocking UNKNOWN.

4. **Referral does NOT override the blocking treatment** (U-S4 HOLD despite
   referral; U-S10 fully verified+referred passes). Referral-as-evidence-moderator
   is NOT tested — that claim would need a separate experiment or interview 003.

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
reason under urgency → inject blocking UNKNOWN → engine's own rule → HOLD) is
small, faithful, and **directly exercises the existing contract** — no new gate
semantics. The direction judgment ("紅旗") is C-bucket and must NOT be
engine-decided.

**FIX PROPOSAL (NOT applied — pre-fix owner review gate):**
The experiment now directly validates the zero-engine-change alternative:
**callers may register unknown switch reasons as blocking UNKNOWNs themselves**
(U-S2/U-S4 prove the unmodified engine then yields HOLD). A structured `urgency`
field in the input contract is therefore **not required** for the representable
part — it would be a convenience (auto-injection), not a capability gap. Both
options documented:

1. **Zero engine change (fully supported by this experiment):** document in README
   that under urgency, an unknown supplier-switch reason should be registered as a
   blocking UNKNOWN (→ HOLD) by the caller/screener.
2. **Structured `urgency` field (convenience):** auto-inject the blocking UNKNOWN
   when `isUrgent && switchReason==="UNKNOWN" && justification!=="JUSTIFIED"`.
   No scoring, no new states, no new dependencies; clean-input behavior unchanged.

**Requires owner/Codex review — not authorized by this experiment.**

## 7. Maturity & status

- **CDD MATURITY: LEVEL 2 — SCENARIO TESTED (CONFIRMED).**
- LEVEL 3 DOMAIN REVIEWED: NOT CLAIMED.
- URGENT SIGNAL SEMANTICS: **UNKNOWN / OWNER REVIEW REQUIRED** (experiment evidence
  now exists; interview 003 deferred).
- KYC GATE: implemented (provisional). MARGIN GATE: implemented (provisional).
- ENGINE: UNCHANGED by this experiment. All cases SYNTHETIC / DESIGN-ONLY.
