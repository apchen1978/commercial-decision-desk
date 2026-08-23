# Experiment Record — KYC Boundary Experiment（owner-authorized, 2026-08-23）

> **MODE**: REAL synthetic boundary experiment (owner authorization: "give you 授權! GO").
> **STATUS**: Evidence produced; **fix NOT applied — STOP at pre-fix owner review gate.**
> **Repo**: apchen1978/commercial-decision-desk @ `05e7e64` (experiment start) → post-commit.
> **Harness**: `scenario-test/kyc-boundary-experiment.mjs` (in-memory; **production
> decision-engine.js NOT modified** — the gate is modeled as an additive variant).
> **Raw output**: `scenario-test/outputs/kyc-boundary-results.raw.json` + `run-log.txt`.

---

## 1. Method

- Pre-registered hypotheses H1–H6 declared in the harness **before** execution.
- Same synthetic fixtures run through **two** engines:
  - `base` = current production `evaluateDecision` (unmodified, no KYC field);
  - `gated` = additive KYC-gate variant (structured `kyc.*` + sanctions veto +
    KYC-incomplete → HOLD), composed on top of the current contract.
- 10 cases: 6 KYC + 3 margin×KYC interaction + 1 pass-through.
- **Pre-declared reading was corrected mid-run** (documented in harness): initial
  expectation was base=ESCALATE for sanctions cases; actual base=PURSUE_NOW because
  these structured fixtures carry the signal in `kyc.*`, not in `contradictions[]`.
  The correction made the experiment *more* accurate: a structured KYC field is
  **fully invisible** to the current engine — it does not even surface ESCALATE.

## 2. Pre-registered hypotheses → results

| H | Hypothesis | Result |
|---|---|---|
| H1 | Sanctions/adverse → gated DO_NOT_PURSUE (one-vote veto) | **CONFIRMED** (E3/E5/E7 gated=DO_NOT_PURSUE) |
| H2 | KYC incomplete → gated HOLD_FOR_EVIDENCE | **CONFIRMED** (E2/E4/E8/E10) |
| H3 | Margin does NOT override KYC veto (margin×KYC: veto wins) | **CONFIRMED** (E5: bps=2000 + failed KYC → DO_NOT_PURSUE; E7: +insurance → DO_NOT_PURSUE) |
| H4 | Low margin + clear KYC → base result stands (margin not a veto here) | **CONFIRMED** (E6 base=gated=PURSUE_NOW) |
| H5 | Insurance does NOT clear KYC | **CONFIRMED** (E4/E7: insurance cannot rescue incomplete/adverse KYC) |
| H6 | Structured kyc field invisible to current engine | **CONFIRMED** (E3/E5/E7 base=PURSUE_NOW — signal fully invisible, no field, no contradiction) |

**10/10 PASS, 0 FAIL.**

## 3. Key findings

1. **A structured KYC field is completely invisible to the current engine.**
   Sanctions-hit cases (E3/E5/E7) return `PURSUE_NOW` on base — the signal exists
   in the input but the 8-dimension contract has no field and no contradiction
   entry, so it neither vetoes nor escalates. This is the strongest possible
   demonstration of **RECEIVED BUT NOT SEMANTICIZED INTO AN INDEPENDENT GATE.**

2. **The additive gate variant produces the intended commercial semantics:**
   sanctions → `DO_NOT_PURSUE` (one-vote veto); KYC incomplete → `HOLD_FOR_EVIDENCE`
   (evidence-required). No scoring, no new decision states, no new dependencies —
   the gate composes with the existing contract.

3. **Margin × KYC interaction tested for the first time (structurally):**
   E5 (structured `bps:2000` + failed KYC) and E7 (+ insurance) both →
   `DO_NOT_PURSUE`. High margin and insurability **cannot rescue a sanctions veto**,
   matching E's "暴利也斬" claim. This answers the Sprint-01 limitation (margin×KYC
   was previously untestable because margin was descriptive-only).

4. **Margin alone remains non-veto** (E6: low margin + clear KYC → PURSUE_NOW).
   Margin-as-gate is interview 001's question — NOT decided by this experiment.

## 4. UNKNOWNs preserved / created

- U1: Is a KYC gate *authorized for production*? → **UNKNOWN — owner review required.**
- U2: Gate trigger semantics for production: `kyc.status==="ADVERSE"` vs separate
  `sanctionsHit` vs `beneficialOwnerVerified===false`? → UNKNOWN (variant uses all
  three; production choice is owner/Codex's).
- U3: Should sanctions veto be DO_NOT_PURSUE even when the human might still
  escalate for information? → UNKNOWN (E says veto; C-bucket nuance possible).
- U4: Margin gate (interview 001) — still UNKNOWN, untouched.
- U5: Urgent-order dual signal (interview 003) — still UNKNOWN, untouched.
- All existing S01–S15 UNKNOWNs preserved.

## 5. Classification (per owner taxonomy)

| Case | Finding | Class |
|---|---|---|
| E3/E5/E7 base=PURSUE_NOW | Structured KYC signal invisible to engine | **missing boundary** (no field) — RECEIVED BUT NOT SEMANTICIZED |
| E3/E5/E7 gated=DO_NOT_PURSUE | Veto achievable with additive gate | design-viable (not a defect) |
| E5/E7 | Margin×KYC interaction: veto wins | **evidence found** (answers Sprint-01 limitation) |
| E6 | Margin alone non-veto | boundary confirmed (margin gate out of scope here) |

No engine defect in the sense of violating a *stated* rule; the contract simply
does not yet have a KYC dimension. The gap is **missing boundary**, not a logic bug.

## 6. Verdict

**B — EVIDENCE_FOUND_FIX_RECOMMENDED.** The experiment proves (a) the current
contract cannot see structured KYC signals at all, and (b) an additive KYC gate
(no new states/dependencies) restores the intended one-vote-veto semantics with
correct margin×KYC priority. This is the strongest pre-implementation evidence to
date for a KYC gate.

**FIX PROPOSAL (NOT applied — pre-fix owner review gate):**
Smallest production change: add a structured `kyc` field to the input contract and
a gate check at the top of `evaluateDecision` (sanctions/adverse → DO_NOT_PURSUE;
incomplete → HOLD via blocking-UNKNOWN semantics). No scoring, no new states, no
new dependencies. Clean-input behavior unchanged. **Requires owner/Codex review —
not authorized by this experiment.**

## 7. Maturity & status

- **CDD MATURITY: LEVEL 2 — SCENARIO TESTED (CONFIRMED).**
- LEVEL 3 DOMAIN REVIEWED: NOT CLAIMED.
- KYC GATE: **UNKNOWN / OWNER REVIEW REQUIRED** (experiment evidence now exists).
- URGENT SIGNAL SEMANTICS: **UNKNOWN / OWNER REVIEW REQUIRED**.
- ENGINE: UNCHANGED. CONTRACT: UNCHANGED. All cases SYNTHETIC / DESIGN-ONLY.
