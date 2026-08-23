# Synthetic Boundary Matrix 001 — KYC Gate & Urgent-Order Dual Signal

> **MODE**: Design-only synthetic boundary testing. **NOT production.**
> **STATUS**: All cases are SYNTHETIC / DESIGN-ONLY. No engine/contract change.
> Engine behavior below is REAL output from `decision-engine.js` @ `3d168b3`
> (run via `scenario-test/design-only-scan.mjs`, in-memory fixtures only —
> that tooling script is NOT committed per directive: commit limited to this
> matrix + DECISION_PACK_001; it lives untracked in the working tree).
> Every signal the current engine has no field for is recorded as:
> **RECEIVED BUT NOT SEMANTICIZED INTO AN INDEPENDENT GATE.**

---

## A. KYC / Sanctions synthetic cases

### KYC-1 — KYC confirmed clear
- **Input signal**: compliance clear (synthetic); no adverse finding.
- **Current contract representation**: no KYC field — nothing to add; clean positive deal.
- **Current engine behavior**: `PURSUE_NOW` (availableNow true).
- **Commercial interpretation**: a clean buyer proceeds; consistent with any gate design.
- **Limitation**: "clear" is only true because the operator screened it; the engine itself cannot confirm clearance.
- **UNKNOWN**: whether clearance was actually verified by a real source.
- **Future decision question**: if a KYC gate exists, does "clear" remain an explicit positive input, or is absence-of-finding enough?

### KYC-2 — KYC incomplete / beneficial owner unknown
- **Input signal**: beneficial owner not yet verified (synthetic).
- **Current contract representation**: only expressible as a blocking `unknowns[]` entry (engine has no KYC field).
- **Current engine behavior**: `HOLD_FOR_EVIDENCE` (availableNow false, 1 blocking UNKNOWN).
- **Commercial interpretation**: matches intuition — unverified owner → hold until KYC completes.
- **Limitation**: HOLD is a side effect of the generic blocking-UNKNOWN rule, not a KYC-specific rule; no dedicated "compliance incomplete" reason.
- **UNKNOWN**: whether the buyer will provide the data; whether HOLD is the right state vs DO_NOT_PURSUE (E would likely veto if unverifiable).
- **Future decision question**: KYC-incomplete → HOLD (evidence-required) or DO_NOT_PURSUE (veto)? Requires interview 002 ruling.

### KYC-3 — sanctions hit / adverse finding
- **Input signal**: sanctions-list match / adverse finding (synthetic).
- **Current contract representation**: only expressible as a material `contradictions[]` entry.
- **Current engine behavior**: `ESCALATE` (availableNow false, 1 material contradiction).
- **Commercial interpretation**: engine correctly refuses pursuit, but escalates rather than vetoes.
- **Limitation**: ESCALATE implies "resolve and possibly continue" — E's veto semantics is DO_NOT_PURSUE (a sanctions hit is not resolvable by negotiation). The engine's only veto primitive (DO_NOT_PURSUE) is wired to weak Category Fit (Rule 1), not to compliance.
- **UNKNOWN**: whether E's one-vote veto generalizes; what the correct terminal state is.
- **Future decision question**: sanctions hit → DO_NOT_PURSUE (veto, non-resolvable)? Requires interview 002 + owner ruling.

### KYC-4 — insurance available but KYC unresolved
- **Input signal**: 中信保 insurability OK, but beneficial-owner KYC still incomplete (synthetic).
- **Current contract representation**: no insurance field; KYC only as blocking unknown.
- **Current engine behavior**: `HOLD_FOR_EVIDENCE` (1 blocking UNKNOWN) — insurance availability is invisible to the engine.
- **Commercial interpretation**: E treats insurability as a first-order signal, but the engine cannot weigh it; KYC gap still holds.
- **Limitation**: cannot represent "insurance available" as a positive or as a partial KYC substitute.
- **UNKNOWN**: whether insurability should partially satisfy the gate (E's claim) or be independent.
- **Future decision question**: is insurability a proxy for, or independent of, KYC clearance? Requires interview 002.

### KYC-5 — high-margin deal with failed KYC
- **Input signal**: 5%-plus margin (attractive), but sanctions/adverse finding present (synthetic).
- **Current contract representation**: margin invisible (no field); adverse finding as material contradiction.
- **Current engine behavior**: `ESCALATE` (availableNow false) — margin does not rescue it, but the state is escalation, not veto.
- **Commercial interpretation**: direction matches E ("利潤再高都沒用") — the deal is not pursued — but the terminal state (ESCALATE vs DO_NOT_PURSUE) does not express a hard veto.
- **Limitation**: the engine arrives at "not pursued" by accident of the contradiction rule; there is no margin field at all, so the "high margin still rejected" lesson is not representable as a gate.
- **UNKNOWN**: correct terminal state for margin+failed-KYC; whether margin should even be an input.
- **Future decision question**: should KYC veto be DO_NOT_PURSUE regardless of margin? Requires interview 002 + 001 priority ruling.

### KYC-6 — low-margin deal with clear KYC
- **Input signal**: margin low (economically thin) but compliance clear (synthetic).
- **Current contract representation**: margin invisible (only commercialFeasibility LOW as an unused dimension).
- **Current engine behavior**: `PURSUE_NOW` (availableNow true) — engine sees a clean positive deal; the thin margin is invisible.
- **Commercial interpretation**: **the exact inverse blind spot of KYC-5** — a low-margin deal the operator might decline sails through as PURSUE_NOW because margin is not a gate (same finding as S15/L3, now on the KYC axis).
- **Limitation**: commercialFeasibility is not consumed by evaluateDecision; margin semantics entirely absent.
- **UNKNOWN**: whether low margin should veto (interview 001) or only downgrade.
- **Future decision question**: margin gate priority vs KYC gate — the pack keeps both UNKNOWN.

---

## B. Urgent-order synthetic cases

### U-1 — urgent order with verified supplier-switch reason
- **Input signal**: urgency + switch reason documented/verified (synthetic).
- **Current contract representation**: urgency → buyerFit HIGH; switch reason has no field.
- **Current engine behavior**: `PURSUE_NOW` (availableNow true).
- **Commercial interpretation**: the benign urgent case — engine and intuition agree.
- **Limitation**: the "verified reason" is invisible; engine cannot distinguish this from an unverified switch.
- **UNKNOWN**: what "verified" means operationally.
- **Future decision question**: does verified-switch-reason need to be a field at all, if buyerFit stays HIGH?

### U-2 — urgent order with unknown switch reason
- **Input signal**: urgent, but why they are switching suppliers is UNKNOWN (synthetic).
- **Current contract representation**: switch reason expressible only as non-blocking `unknowns[]` (blocksPursue false).
- **Current engine behavior**: **`PURSUE_NOW`** (availableNow true; non-blocking UNKNOWN does not gate).
- **Commercial interpretation**: **F's exact red-flag scenario passes the engine as a green light.** The unknown switch reason is visible to a human as a risk, but the contract has no semantic for it.
- **Limitation**: RECEIVED BUT NOT SEMANTICIZED INTO AN INDEPENDENT GATE — urgency direction and switch-reason are not part of the 8-dimension contract.
- **UNKNOWN**: whether unknown-switch-reason should downgrade buyerFit, block, or stay human-judgment (C bucket — F says it is intuition, not machine-readable).
- **Future decision question**: is this a profile-tagged modifier (003) or a documented C-bucket human signal (no engine change)?

### U-3 — urgent order after repeated prior-vendor failure
- **Input signal**: previous vendor had repeated quality failures (synthetic).
- **Current contract representation**: prior-vendor history has no field at all.
- **Current engine behavior**: **`PURSUE_NOW`** — the history is invisible.
- **Commercial interpretation**: F's "八成自己問題" case; the engine cannot see the pattern.
- **Limitation**: no prior-vendor field; cannot distinguish justified switching from buyer-caused churn.
- **UNKNOWN**: whether prior-vendor history is obtainable and trustworthy.
- **Future decision question**: C bucket (human instinct) vs a buyerFit modifier (003)?

### U-4 — urgent order from trusted referral
- **Input signal**: urgency + industry referral (synthetic).
- **Current contract representation**: referral strength is a human annotation inside buyerFit evidence; no dedicated field.
- **Current engine behavior**: `PURSUE_NOW`.
- **Commercial interpretation**: the warm case; engine and intuition agree.
- **Limitation**: referral is not structurally distinguishable from a cold urgent order (both may be buyerFit HIGH).
- **UNKNOWN**: whether referral should raise evidence quality (S14/L2 treated referral as positive).
- **Future decision question**: should referral be an explicit evidence-tier input?

### U-5 — urgent order with weak payment history
- **Input signal**: urgency + weak/unverified payment history (synthetic).
- **Current contract representation**: payment history expressible only as blocking unknown.
- **Current engine behavior**: `HOLD_FOR_EVIDENCE` (1 blocking UNKNOWN).
- **Commercial interpretation**: engine correctly holds on the payment-history gap.
- **Limitation**: generic blocking-UNKNOWN rule again; no payment-history-specific gate.
- **UNKNOWN**: what evidence would clear it.
- **Future decision question**: weak payment history → HOLD (current) vs DO_NOT_PURSUE (E might veto)? Requires 002.

### U-6 — urgent order where urgency is operationally justified
- **Input signal**: urgency justified by a real deadline (CE certification window, synthetic).
- **Current contract representation**: urgency direction not representable; buyerFit HIGH.
- **Current engine behavior**: `PURSUE_NOW`.
- **Commercial interpretation**: the benign justified case — engine green.
- **Limitation**: engine cannot distinguish justified urgency (U-6) from suspicious urgency (U-2/U-3) — both are identical to it.
- **UNKNOWN**: whether the distinction is machine-representable or C-bucket human judgment.
- **Future decision question**: interview 003's core — is urgency direction a contract signal at all?

---

## C. Cross-case summary (design-only findings)

| Case | Engine state | Signal semanticized? | Finding |
|---|---|---|---|
| KYC-1 clear | PURSUE_NOW | n/a (nothing to express) | baseline |
| KYC-2 owner unknown | HOLD | as generic blocking UNKNOWN | correct direction, no KYC-specific rule |
| KYC-3 sanctions hit | ESCALATE | as generic contradiction | direction ok; **terminal state wrong for a veto** |
| KYC-4 insurable but KYC gap | HOLD | KYC as unknown; insurance invisible | insurability not representable |
| KYC-5 high margin + failed KYC | ESCALATE | margin invisible | **rejects by accident, not by gate** |
| KYC-6 low margin + clear KYC | PURSUE_NOW | margin invisible | **blind spot: thin margin sails through** |
| U-1 verified switch | PURSUE_NOW | switch reason invisible | benign case green |
| U-2 unknown switch reason | **PURSUE_NOW** | NOT semanticized | **F's red flag = engine green** |
| U-3 repeated vendor failure | **PURSUE_NOW** | NOT semanticized | **history invisible** |
| U-4 trusted referral | PURSUE_NOW | referral not structural | warm case green |
| U-5 weak payment history | HOLD | as blocking unknown | correct direction |
| U-6 justified urgency | PURSUE_NOW | urgency direction invisible | indistinguishable from U-2/U-3 |

**Net design conclusions (provisional):**
1. KYC/sanctions signals *can* be forced through existing primitives (unknowns/contradictions),
   but the engine then answers with the *wrong terminal state* for a veto (ESCALATE, not
   DO_NOT_PURSUE) and gives no KYC-specific reason.
2. Margin is invisible on both axes — high margin does not rescue, low margin does not veto
   (mirrors S15/L3 finding; now confirmed on the KYC axis too).
3. Urgency direction, supplier-switch reason, prior-vendor history are NOT semanticized:
   suspicious urgent cases (U-2/U-3) are indistinguishable from benign ones (U-1/U-6) at
   the engine level. F's red-flag claim cannot be represented without a contract change —
   and whether it *should* be is exactly the interview-003 question.

---

## D. Maturity & status

- **CDD MATURITY: LEVEL 2 — SCENARIO TESTED (CONFIRMED).**
- LEVEL 3 DOMAIN REVIEWED: NOT CLAIMED.
- KYC GATE: **UNKNOWN / OWNER REVIEW REQUIRED** (see DECISION_PACK_001 §7).
- URGENT SIGNAL SEMANTICS: **UNKNOWN / OWNER REVIEW REQUIRED**.
- All cases: SYNTHETIC / DESIGN-ONLY. No interview responses fabricated.
- Engine unchanged; contract unchanged; no implementation authorized.
