# Experiment Record — Channel Price Discipline Gate（charter-approved, 2026-08-23）

> **MODE**: synthetic boundary experiment（charter `CHARTER_CHANNEL_PRICE_GATE_001.md`
> approved by owner 2026-08-23）. **STATUS**: evidence produced; **no production
> change — production gate implementation requires separate authorization (verdict
> B/C → 另案授權).**
> **Repo**: apchen1978/commercial-decision-desk @ `96fa1d6` (charter commit) → post-commit.
> **Harness**: `scenario-test/channel-price-experiment.mjs` (in-memory; **production
> decision-engine.js NOT modified**).
> **Raw output**: `scenario-test/outputs/channel-price-results.raw.json` + `run-log.txt`.
> **Domain source**: D (RECORD_DEF) — "亂價傾銷一票否決，就算現金全款買斷也拒絕".
> PROVISIONAL — NOT DOMAIN CONSENSUS (single source).

---

## 1. Method

- Pre-registered hypotheses H1–H6 declared in the harness **before** execution.
- Same synthetic fixtures run through **two** engines:
  - `base` = current production `evaluateDecision` (unmodified, no channel-price field);
  - `gated` = additive channel-price gate variant (structured `channelPrice.*` +
    one-vote veto inserted into the priority chain).
- 10 cases covering: pass-through, dumping veto, and **priority interactions with
  sanctions, margin, KYC-incomplete, weak evidence, weak category fit** (owner
  requirement: test conflicts with sanctions/margin/KYC-incomplete explicitly).
- **Method honesty note**: channel-price is a NEW gate candidate — unlike KYC
  (contradiction/unknown) and margin (threshold), no existing primitive naturally
  yields a one-vote DNP for price dumping. The variant models "the gate inserted
  into the priority chain" as an overlay on the unmodified engine's output (same
  approach as the KYC experiment's Phase-1 variant). This is simulation, not a
  claim that an existing primitive already produces the result.

## 2. Pre-registered hypotheses → results

| H | Hypothesis | Result |
|---|---|---|
| H1 | Dumping risk → DO_NOT_PURSUE (one-vote veto), same pattern as KYC/Margin | **CONFIRMED** (CP-2 gated=DNP, src=CHANNEL_PRICE) |
| H2 | Sanctions outranks channel-price (both DNP; source distinguishable via kycGate) | **CONFIRMED** (CP-3/CP-9 src=SANCTIONS) |
| H3 | Margin outranks channel-price (both DNP; source via marginGate) | **CONFIRMED** (CP-4 src=MARGIN) |
| H4 | Channel-price outranks KYC-incomplete (dumping → DNP even when base would HOLD on KYC) | **CONFIRMED** (CP-5 base=HOLD → gated=DNP) |
| H5 | Channel-price outranks rules-layer (dumping → DNP regardless of weak evidence) | **CONFIRMED** (CP-7 base=HOLD → gated=DNP) |
| H6 | Clear channel-price passes through; KYC/Margin gates act normally | **CONFIRMED** (CP-1/CP-6/CP-10) |

**10/10 PASS, 0 FAIL.**

## 3. Priority-chain findings (owner-required interaction tests)

| Interaction | Base | Gated | Source attribution | Priority satisfied |
|---|---|---|---|---|
| dumping + sanctions | DNP | DNP | SANCTIONS (kycGate) | sanctions > channel-price ✓ |
| dumping + margin-below | DNP | DNP | MARGIN (marginGate) | margin > channel-price ✓ |
| dumping + KYC-incomplete | HOLD | **DNP** | CHANNEL_PRICE | channel-price > KYC-incomplete ✓ |
| dumping + weak evidence | HOLD | **DNP** | CHANNEL_PRICE | channel-price > rules ✓ |
| dumping + weak category | DNP | DNP | CATEGORY_WEAK_RULE1 | rule-1 ≥ channel-price (tie, both DNP) ✓ |
| dumping + sanctions + margin + KYC | DNP | DNP | SANCTIONS (highest) | full chain ✓ |
| clear + KYC-incomplete | HOLD | HOLD | — (KYC acts) | KYC acts when channel-price clear ✓ |

**The priority chain (sanctions > margin > channel-price > KYC-incomplete > rules)
is clearly expressible with the current engine's output fields** (recommended +
kycGate + marginGate + reasons). No new decision state, no new dependency, no
gate-semantics invention required to express the ordering — the veto itself is the
only new element (a new gate, same pattern as KYC/Margin).

## 4. UNKNOWNs preserved / created

- U1: Is channel-price veto semantics correct across profiles, or D-specific?
  → UNKNOWN (single domain source D; interview/domain sample needed).
- U2: Dumping-risk *detection* (how the caller knows dumping is happening) →
  UNKNOWN — the experiment only covers *representation* of an already-detected
  risk; detection is caller/human.
- U3: Whether the priority tie with category-weak Rule 1 (both DNP) needs explicit
  ordering or is fine as "both veto" → UNKNOWN (no behavioral difference).
- All existing S01–S21 UNKNOWNs preserved.

## 5. Classification (per owner taxonomy)

| Case | Finding | Class |
|---|---|---|
| CP-2 | Dumping → DNP (new gate, same pattern as KYC/Margin) | design-viable, new-gate candidate |
| CP-3/CP-9 | Sanctions priority, source distinguishable | priority expressible ✓ |
| CP-4 | Margin priority, source distinguishable | priority expressible ✓ |
| CP-5/CP-7 | Channel-price outranks KYC/rules (HOLD → DNP) | priority expressible ✓ |
| CP-1/CP-6/CP-10 | Clear pass-through | no regression to clean input ✓ |

No engine defect; the gap is a **missing boundary** (no channel-price dimension).
Priority chain is expressible with current primitives — **failure criteria NOT
triggered** (no new state/dependency needed to express ordering; the gate itself
follows the established KYC/Margin pattern).

## 6. Verdict

**B — EVIDENCE_FOUND_FIX_RECOMMENDED.** A channel-price one-vote veto is
representable in the same pattern as the KYC and Margin gates, and its place in
the priority chain (sanctions > margin > channel-price > KYC-incomplete > rules)
is clearly expressible. This is the strongest pre-implementation evidence for a
channel-price gate.

**DOMAIN-VALIDATION STATUS (owner decision ②, 2026-08-23):** production
implementation is NOT authorized. A bounded domain-validation phase is in progress
(`DOMAIN_VALIDATION_CHANNEL_PRICE_001.md`): ≥3 different-role D-type interviewees
pending owner scheduling. Verdict stays B (single domain source D); if no domain
consensus emerges, verdict stays B or drops to C and the work stops. Level 3 is
not claimed.

**FIX PROPOSAL (NOT applied — 另案授權 required per charter §4/§5):**
Smallest production change: add a structured `channelPrice` field
(`status: CLEAR|DUMPING_RISK`, `dumpingRisk`, `policy`) and a gate check at the
top of `evaluateDecision` — dumping risk → `DO_NOT_PURSUE` (after sanctions and
margin checks, before KYC-incomplete). No scoring, no new states, no new
dependencies; clean-input behavior unchanged. **Requires owner/Codex review AND
domain validation — NOT authorized by this experiment.**

## 7. Maturity & status

- **CDD MATURITY: LEVEL 2 — SCENARIO TESTED (CONFIRMED).**
- LEVEL 3 DOMAIN REVIEWED: NOT CLAIMED.
- CHANNEL-PRICE GATE: **UNKNOWN / OWNER REVIEW REQUIRED** (evidence now exists).
- KYC GATE: implemented (provisional). MARGIN GATE: implemented (provisional).
- ENGINE: UNCHANGED by this experiment. All cases SYNTHETIC / DESIGN-ONLY.
