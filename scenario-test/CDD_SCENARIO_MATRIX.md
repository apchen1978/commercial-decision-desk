# CDD Scenario Matrix — Evidence-Depth Stress Test

**Repository under test:** `apchen1978/commercial-decision-desk`
**Baseline commit:** `539f945` (HEAD at experiment start; working tree clean)
**Experiment artifacts:** `6141606` (scenario experiment, Level 2, verdict B)
**Post-fix commits:** `7ecbe5c` (S10/S11 fixes + S08/S12 documentation + S10R/S11R regressions) → `fbe8548` (inbound lead scan S13–S15 + protocol examples + interview 001) → `9c1ae4a` (KYC boundary experiment) → KYC gate implementation + S16–S18 (see Git section)
**Harness:** `scenario-test/run-scenarios.mjs` (isolated, reads `fixtures.js` + `decision-engine.js`, never modifies them)
**Raw output:** `scenario-test/outputs/scenario-results.raw.json` (full mutated fixtures + actual states, verbatim)
**Run log:** `scenario-test/outputs/run-log.txt`
**Date:** 2026-08-23 · **Owner approval:** CDD Evidence Depth Experiment (AUTHORIZED — scenario stress test only; no product development; no CDD V2)

> Method per owner amendment: expected behavior declared **before** execution; existing
> decision contract run deterministically; actual recorded; expected vs actual compared;
> every mismatch preserved and classified. No engine modification. No claim inflation.

## POST-FIX RUN (owner-review closing)

After owner review (EXPERIMENT ACCEPTED, VERDICT B ACCEPTED), the following were
authorized and executed:

1. Experiment artifacts committed as `6141606`.
2. **S11 fix** — `paymentExposure()` de-duplicates complete events by
   `(label, amountCny, daysFromSign)`, first occurrence preserved; `dedupedCount`
   reports dropped duplicates. No payment-model redesign.
3. **S10 fix** — `evaluateDecision()` whitelists dimension values
   (`HIGH/STRONG/MEDIUM/LOW/WEAK/UNKNOWN/NONE/IRRELEVANT`); invalid values are
   surfaced in `reasons` and fail closed to the evidence-required path
   (`HOLD_FOR_EVIDENCE`; `PURSUE_NOW`/`PURSUE_CONDITIONALLY` unavailable).
   No scoring, no new states.
4. **S08 documented only** — evidence freshness/expiry is NOT evaluated by the
   engine; no universal expiry threshold invented (see README "Documented boundaries").
5. **S12 documented only** — contradiction records are expected to be normalized
   upstream before `evaluateDecision()`; the engine reflects registered
   contradictions only; no NLP/agent detection (see README).
6. Regression scenarios S10R/S11R added; original S10/S11 preserved as pre-fix
   baselines (expected to diverge — divergence confirms the fix).
7. Full suite re-run: `verify.mjs` 38/38 PASS; scenario matrix 14/14 (12 PASS,
   2 BASELINE_FIX_CONFIRMED, 0 FAIL, 0 BASELINE_FIX_ABSENT), deterministic.
8. Evidence maturity remains **LEVEL 2 SCENARIO TESTED** (not promoted).
9. Paul OS rule **FEATURE DEPTH ≠ EVIDENCE DEPTH** adopted (see Paul OS principles).
10. Document Parity Closing Rule evaluated — no public copy changes required
    (Level 2 evidence does not materially change any existing external claim).

## INBOUND LEAD SCAN + KYC GATE (owner tasks, commits `fbe8548` + KYC implementation)

Three real-shaped inbound-lead emails (L1/L2/L3, anonymized synthetic) were run
through the contract and archived as **S13/S14/S15** (tags `SYNTHETIC` +
`PRE-MARGIN-GATE`); the owner-authorized KYC gate added **S16/S17/S18** (tags
`SYNTHETIC` + `KYC-GATE`). Full matrix now: **20 scenarios — 18 PASS, 2
BASELINE_FIX_CONFIRMED, 0 FAIL, deterministic**.

| ID | Lead / case | Engine state | Finding |
|---|---|---|---|
| S13 | L1 — EU distributor $2M / OA-90 (cold inbound) | `HOLD_FOR_EVIDENCE` | Evidence-first discipline: unverified volume + OA-90 credit + unknown switch reason → HOLD, never pursuit from self-asserted claims |
| S14 | L2 — industry referral, 500 A-302 samples by Sep 15, 30% T/T | `HOLD_FOR_EVIDENCE` | Guardrail: no quote without spec evidence — drawings/BOM not yet provided, the quoted object is UNKNOWN |
| S15 | L3 — end-customer custom equipment, 5% margin, certification costs on supplier, HQ committee decides | `ESCALATE` | **KEY EDGE CASE** — see below |
| S16 | KYC sanctions hit / adverse finding (+ high margin) | `DO_NOT_PURSUE` | **KYC GATE**: one-vote veto — margin cannot rescue (margin × KYC: veto wins) |
| S17 | KYC incomplete / beneficial owner unknown (+ referral, high margin) | `HOLD_FOR_EVIDENCE` | **KYC GATE**: evidence-required; insurance does not clear it |
| S18 | KYC clear (clean positive) | `PURSUE_NOW` | **KYC GATE**: transparent pass-through; clean-input unchanged |

**S15 (L3) — the margin-not-yet-a-gate edge case.** The system receives the relevant
descriptions in the input (`commercialFeasibility: LOW`, "5% margin",
"certification costs on supplier"), but the current contract does **not** convert
margin / cost-burden into an independent, explainable go/no-go gate. The engine
fires on the *registered* material contradiction (no decision authority at the
contact point → `ESCALATE`), not on the commercial killer. Gross Margin Threshold
and Compliance Cost Payer are candidates for a future Margin gate, pending
Domain Review interview 001 (`docs/interviews/001_MARGIN_AND_COST_GATE.md`).
**FUTURE FLIP (pre-declared, not current result):** after a Margin gate lands,
S15's expected state must become `DO_NOT_PURSUE` — that flip is the measured
evidence of decision evolution. **Margin gate is UNKNOWN until interview 001.**

### S10 before / after (malformed enum)

| | Before fix | After fix |
|---|---|---|
| Input | `buyerFit.value="HYPERSONIC"` | identical |
| Recommendation | `PURSUE_CONDITIONALLY` (silent downgrade — garbage consumed as "not strong") | `HOLD_FOR_EVIDENCE` (fail closed to evidence-required path) |
| Reason surfaced | none | `Rule: Invalid dimension value in buyerFit — value is not in the accepted vocabulary; treated as UNKNOWN; evidence-required path is recommended.` |
| UNKNOWN marker | absent | present (invalid value treated as UNKNOWN) |

### S11 before / after (duplicate payment event)

| | Before fix | After fix |
|---|---|---|
| Input | PE-1 + PE-1b (identical label/amount/day) + PE-2 | identical |
| Total committed exposure | 109,200 (25,200 counted twice) | 84,000 (true commitments) |
| dedupedCount | n/a | 1 |
| Peak window | 58,800 (safe only because duplicates shared a day) | 58,800 (same, now correct by construction) |

---

## 1. Decision-state coverage (5/5 states exercised)

| State | Scenario(s) | Result |
|---|---|---|
| PURSUE_NOW | S01 (clean positive) | PASS |
| PURSUE_CONDITIONALLY | S02 (MEDIUM buyer fit) | PASS |
| HOLD_FOR_EVIDENCE | S03 (LOW evidence), S04 (UNKNOWN evidence), S05 (blocking UNKNOWN) | PASS |
| ESCALATE | S06 (material contradiction; boundary: non-material must not escalate) | PASS |
| DO_NOT_PURSUE | S07 (weak category fit despite all-positive signals) | PASS |

All 5 decision states reached and behave per the declared contract.

## 2. Adversarial coverage (8 types, 7 exercised + 1 structural)

| Adversarial type | Scenario | Result | Weakness revealed |
|---|---|---|---|
| Contradictory evidence | S06 + boundary | PASS | none (escalation path correct; non-material does not escalate) |
| Incomplete evidence | S03/S04/S05 | PASS | none |
| Expired evidence | S08 | PASS* | **YES — expiry has no signal** |
| Incomparable evidence | S09 | PASS | none (Rule 4 disclosure gate holds; no force-ranking) |
| Malformed input | S10 | PASS* | **YES — no enum validation** |
| Duplicate input | S11 | PASS* | **YES — no input de-dup; exposure double-counted** |
| Inconsistent source evidence | S12 | PASS* | **YES — contradiction detection is human-only, undocumented** |
| Boundary-condition | S06 boundary | PASS | none |

\* PASS = engine behaved exactly as the pre-declared reading of the *current* contract
predicts. The asterisk marks scenarios that nonetheless **expose a decision-contract
boundary the contract does not define** — see §4.

---

## 3. Scenario matrix (expected vs actual, per scenario)

### S01 — PURSUE_NOW reachable
- **Claim:** All gates clear + strong Buyer Fit + strong Evidence Quality ⇒ PURSUE_NOW.
- **Input:** cleanPositive fixture (no contradictions, complete terms, comparable bases, complete events, no unknowns, buyerFit HIGH, evidenceQuality HIGH).
- **Expected:** recommended PURSUE_NOW, availableNow true.
- **Actual:** recommended PURSUE_NOW, availableNow true, exposure 84,000/peak 58,800.
- **Invariant:** positive pursuit path reachable. **PASS**
- **UNKNOWN preserved:** n/a. **Limitation discovered:** none. **Follow-up:** none.

### S02 — PURSUE_CONDITIONALLY (not forced)
- **Claim:** Strong evidence but MEDIUM Buyer Fit ⇒ conditional only.
- **Input:** cleanPositive, buyerFit MEDIUM.
- **Expected:** PURSUE_CONDITIONALLY, PURSUE_NOW unavailable.
- **Actual:** PURSUE_CONDITIONALLY; availableNow false. **PASS**
- **Invariant:** no forced pursuit without strong fit. **UNKNOWN preserved:** n/a. **Limitation:** none. **Follow-up:** none.

### S03 — HOLD on LOW evidence (missing ≠ negative)
- **Claim:** LOW Evidence Quality ⇒ HOLD_FOR_EVIDENCE, never DO_NOT_PURSUE.
- **Input:** cleanPositive, evidenceQuality LOW.
- **Expected:** HOLD_FOR_EVIDENCE, availableNow false.
- **Actual:** HOLD_FOR_EVIDENCE, availableNow false; reason surfaces evidence-quality rule. **PASS**
- **Invariant:** missing/weak evidence is not negative evidence. **UNKNOWN preserved:** n/a. **Limitation:** none. **Follow-up:** none.

### S04 — HOLD on UNKNOWN evidence (UNKNOWN stays)
- **Claim:** Evidence Quality UNKNOWN ⇒ HOLD; no conversion to fact, no negative treatment.
- **Input:** cleanPositive, evidenceQuality UNKNOWN.
- **Expected:** HOLD_FOR_EVIDENCE, availableNow false.
- **Actual:** HOLD_FOR_EVIDENCE; reason states LOW-or-UNKNOWN rule. **PASS**
- **Invariant:** UNKNOWN remains UNKNOWN until supported. **UNKNOWN preserved:** yes (value stays UNKNOWN; recommendation holds). **Limitation:** none. **Follow-up:** none.

### S05 — HOLD on blocking UNKNOWN (gate)
- **Claim:** Blocking UNKNOWN remains despite strong evidence ⇒ HOLD; PURSUE_NOW requires none.
- **Input:** cleanPositive + `unknowns=[{id:UNK-X, blocksPursue:true}]`.
- **Expected:** HOLD_FOR_EVIDENCE, availableNow false.
- **Actual:** HOLD_FOR_EVIDENCE, availableNow false; reason names UNK-X. **PASS**
- **Invariant:** blocking UNKNOWN gates pursuit. **UNKNOWN preserved:** yes. **Limitation:** none. **Follow-up:** none.

### S06 — ESCALATE on material contradiction (+ boundary)
- **Claim:** Material UNRESOLVED contradiction ⇒ ESCALATE, PURSUE_NOW unavailable; **boundary:** non-material contradiction must NOT escalate.
- **Input:** cleanPositive + material UNRESOLVED CTR-M; boundary variant: material:false CTR-NM.
- **Expected:** ESCALATE / availableNow false; boundary ⇒ PURSUE_NOW / true.
- **Actual:** ESCALATE; boundary ⇒ PURSUE_NOW (non-material does not escalate). **PASS** (both main and boundary)
- **Invariant:** contradictory material evidence ⇒ escalation; escalation requires materiality. **UNKNOWN preserved:** n/a. **Limitation:** none. **Follow-up:** none.

### S07 — DO_NOT_PURSUE on weak category fit (attractive signals cannot override)
- **Claim:** Weak Category Fit ⇒ DO_NOT_PURSUE even with every other signal positive.
- **Input:** cleanPositive, categoryFit WEAK.
- **Expected:** DO_NOT_PURSUE, availableNow false.
- **Actual:** DO_NOT_PURSUE; Rule 1 reason present. **PASS**
- **Invariant:** weak commercial/category fit is not overridden by attractive signals. **UNKNOWN preserved:** n/a. **Limitation:** none. **Follow-up:** none.

### S08 — EXPIRED evidence (adversarial)
- **Claim:** Evidence tier records EXPIRED but `value` stays HIGH. Engine consumes only `dimensions.value` — does it detect expiry?
- **Input:** cleanPositive, evidenceQuality.evidence = two EXPIRED-tier notes, value HIGH.
- **Expected (pre-declared reading):** PURSUE_NOW — engine has no expiry signal; tier is human-facing annotation.
- **Actual:** PURSUE_NOW, availableNow true (identical to fresh evidence). **PASS** (behavior matches pre-declared reading)
- **Invariant:** expired evidence must not be treated as current — **not enforced by engine**.
- **UNKNOWN preserved:** n/a. **Limitation discovered: YES.** Expiry is invisible to the engine: a 14-month-old verification note is commercially indistinguishable from a current one. The fixture tier vocabulary (PRIMARY/SUPPORTING/VERIFICATION_REQUIRED) has no EXPIRED tier, and the contract never states that tiers do not affect decisions.
- **Follow-up:** owner decision — either document "tiers are annotation-only; humans screen expiry" or introduce an expiry gate. **See §4.1.**

### S09 — INCOMPARABLE quote bases (adversarial)
- **Claim:** Non-comparable quote bases must not be force-ranked; Rule 4 is a disclosure gate, not a pursuit gate.
- **Input:** cleanPositive, quoteBasesComparable false, two COMPLETE quotes on FOB vs DDP bases.
- **Expected:** PURSUE_NOW still available (rule 4 blocks ranking, not pursuit); reason surfaced.
- **Actual:** PURSUE_NOW, availableNow true; Rule 4 reason present ("quotes are NOT ranked"). **PASS**
- **Invariant:** incomparable evidence never force-ranked. **UNKNOWN preserved:** n/a. **Limitation:** none. **Follow-up:** none.

### S10 — MALFORMED enum (adversarial)
- **Claim:** `buyerFit.value = "HYPERSONIC"` (outside HIGH/STRONG/MEDIUM/LOW/UNKNOWN vocabulary). Engine must not silently treat garbage as a meaningful level or convert it to a fact.
- **Input:** cleanPositive, buyerFit.value HYPERSONIC.
- **Expected (pre-declared reading):** PURSUE_CONDITIONALLY — unknown value is treated as "not strong" and falls through to the conditional branch; no error, no UNKNOWN marker.
- **Actual:** PURSUE_CONDITIONALLY, availableNow false; **no validation, no UNKNOWN flag, no error surfaced.** **PASS** (matches pre-declared reading)
- **Invariant:** malformed input must not fabricate a level — **partially violated in spirit**: the engine neither fabricates a *strong* level nor rejects the input; it silently downgrades to conditional pursuit without telling the human the input was unparsable.
- **UNKNOWN preserved:** no — the malformed value is consumed as if it were a valid MEDIUM-ish level; the unparsability itself is never recorded as UNKNOWN.
- **Limitation discovered: YES.** No input-enum validation. A typo in any dimension value silently changes the recommendation with no diagnostic.
- **Follow-up:** owner decision — add value-whitelist validation (reject or mark UNKNOWN) or document "values are trusted inputs." **See §4.2.**

### S11 — DUPLICATE payment event (adversarial)
- **Claim:** Duplicate payment event submitted twice — exposure must not double-count unless the engine de-duplicates inputs.
- **Input:** cleanPositive + PE-1 ("Deposit 30%", 25,200, day 0) duplicated as PE-1b.
- **Expected (pre-declared reading):** exposure total 109,200 (double-counted), peak unchanged 58,800 — engine has no de-dup.
- **Actual:** exposure total **109,200** (should be 84,000); peak 58,800 unchanged (duplicates share the same day). Decision still PURSUE_NOW. **PASS** (matches pre-declared reading)
- **Invariant:** duplicate inputs must not silently inflate exposure — **not enforced**. 25,200 CNY of commitment is counted twice.
- **UNKNOWN preserved:** n/a. **Limitation discovered: YES.** No input de-dup; a duplicated event (common when assembling schedules from spreadsheets) inflates total committed exposure. Peak is only safe while duplicates share a day.
- **Follow-up:** owner decision — de-dup by (label, amountCny, daysFromSign) at input boundary, or document "caller must de-dup." **See §4.3.**

### S12 — INCONSISTENT SOURCE EVIDENCE (adversarial)
- **Claim:** Two evidence notes in the same dimension directly contradict each other, but the `contradictions` array is empty. Does the engine detect it autonomously?
- **Input:** cleanPositive + evidenceQuality.evidence = two PRIMARY notes: "volume confirmed in writing" vs "volume was a typo, 10× smaller". No entry in `contradictions`.
- **Expected (pre-declared reading):** PURSUE_NOW — engine only sees `value`; contradiction detection is the human's job (pre-filled `contradictions` array).
- **Actual:** PURSUE_NOW, availableNow true; no contradiction surfaced. **PASS** (matches pre-declared reading)
- **Invariant:** contradictory material evidence ⇒ escalation — **enforced only when the human pre-registers the contradiction.** A screening miss silently yields PURSUE_NOW on directly conflicting primary evidence.
- **UNKNOWN preserved:** no — the conflict exists in the evidence notes but is never surfaced as UNKNOWN or contradiction.
- **Limitation discovered: YES.** The division of responsibility (human screens contradictions; engine reflects registered ones) is **undocumented**: the contract reads as if contradictions are auto-detected, but they are not.
- **Follow-up:** owner decision — document the boundary explicitly ("engine reflects human-registered contradictions only"), or add a note-level conflict heuristic (feature expansion — not recommended without owner). **See §4.4.**

### S13 — INBOUND L1 (EU distributor $2M / OA-90) — PRE-MARGIN-GATE
- **Claim:** Cold inbound, all claims self-asserted (volume, OA-90 credit, switch reason). Evidence-first: HOLD, never a pursuit recommendation from unverified claims.
- **Input:** base fixture mutated to lead L1: buyerFit MEDIUM, categoryFit HIGH, evidenceQuality LOW, terms INCOMPLETE, blocking unknowns (volume unverified, OA-90 credit unverified).
- **Expected:** HOLD_FOR_EVIDENCE, availableNow false.
- **Actual:** HOLD_FOR_EVIDENCE; reasons surface Rule 3 (terms incomplete), Rule 5 (exposure UNKNOWN), evidence-quality rule, blocking UNKNOWNs. **PASS**
- **Invariant:** B-bucket (structurable) conditions insufficient ⇒ system refuses to reach A-bucket (gate) judgment. **UNKNOWN preserved:** yes. **Limitation:** none. **Follow-up:** none.
- **Tags:** `SYNTHETIC`, `PRE-MARGIN-GATE`.

### S14 — INBOUND L2 (referral, 500 A-302 samples, 30% T/T) — PRE-MARGIN-GATE
- **Claim:** Real urgent need + acceptable payment terms, but drawings/BOM not yet provided — the quoted object is UNKNOWN. Guardrail: no quote without spec evidence.
- **Input:** base fixture mutated to lead L2: buyerFit HIGH, categoryFit MEDIUM, evidenceQuality MEDIUM, terms INCOMPLETE (delivery deadline hard condition), blocking unknowns (drawings/BOM, 500-sample feasibility).
- **Expected:** HOLD_FOR_EVIDENCE, availableNow false.
- **Actual:** HOLD_FOR_EVIDENCE; blocking UNKNOWNs (UNK-1, UNK-2) gate pursuit; COND remains available once spec arrives. **PASS**
- **Invariant:** no spec evidence ⇒ no quote; referral/urgency does not bypass the spec-unknown guardrail (C-bucket human instinct would rush to quote; the system blocks). **UNKNOWN preserved:** yes. **Limitation:** none. **Follow-up:** none.
- **Tags:** `SYNTHETIC`, `PRE-MARGIN-GATE`.

### S15 — INBOUND L3 (custom equipment, 5% margin, cost shift) — KEY EDGE CASE
- **Claim:** No decision authority at the contact point (HQ committee decides) → material contradiction → ESCALATE. **Key finding:** the system receives the margin/cost descriptions in the input but the current contract does not semanticize them into an independent go/no-go gate.
- **Input:** base fixture mutated to lead L3: buyerFit LOW, categoryFit MEDIUM, evidenceQuality LOW, commercialFeasibility LOW, terms INCOMPLETE (5% margin, certification costs on supplier), material contradiction CTR-1 (authority vs commitment), blocking unknowns (spec, budget/authority).
- **Expected:** ESCALATE, availableNow false.
- **Actual:** ESCALATE; Rule 2 fires on the registered authority contradiction. **PASS** (current contract)
- **Invariant:** commercial killer (5% margin + certification-cost shift) is **not yet a gate** — the engine sees it only as descriptive input. Gross Margin Threshold / Compliance Cost Payer are A-bucket candidates pending interview 001.
- **FUTURE FLIP (pre-declared, not current):** after a Margin gate lands, expected state must become `DO_NOT_PURSUE`. **Margin gate = UNKNOWN until interview 001.**
- **Tags:** `SYNTHETIC`, `PRE-MARGIN-GATE`.

### S16 — KYC sanctions veto (KYC-GATE)
- **Claim:** Sanctions hit / adverse finding → `DO_NOT_PURSUE` one-vote veto regardless of margin (margin × KYC: veto wins).
- **Input:** cleanPositive + structured `kyc={status:ADVERSE, sanctionsHit, adverseFinding}` + `margin={bps:2000}`.
- **Expected:** DO_NOT_PURSUE, availableNow false, availableConditionally false.
- **Actual:** DO_NOT_PURSUE (kycGate=SANCTIONS_VETO). **PASS**
- **Invariant:** one-vote veto; high margin cannot rescue. **UNKNOWN preserved:** n/a. **Limitation:** gate semantics provisional (single domain source, interview 002 pending). **Follow-up:** none — gate implemented.
- **Tags:** `SYNTHETIC`, `KYC-GATE`.

### S17 — KYC incomplete (KYC-GATE)
- **Claim:** Beneficial owner unverified → `HOLD_FOR_EVIDENCE` even with referral + high margin; insurance does not clear it.
- **Input:** cleanPositive + `kyc={status:INCOMPLETE, beneficialOwnerVerified:false}` + `margin={bps:1800}`.
- **Expected:** HOLD_FOR_EVIDENCE, availableNow false, availableConditionally false.
- **Actual:** HOLD_FOR_EVIDENCE (kycGate=KYC_INCOMPLETE). **PASS**
- **Invariant:** evidence-required path; insurance is not a KYC substitute. **UNKNOWN preserved:** yes (KYC status stays UNKNOWN until verified). **Limitation:** none. **Follow-up:** none.
- **Tags:** `SYNTHETIC`, `KYC-GATE`.

### S18 — KYC clear pass-through (KYC-GATE)
- **Claim:** Clear or absent kyc field → gate transparent; clean positive path preserved.
- **Input:** cleanPositive + `kyc={status:CLEAR, beneficialOwnerVerified:true}`.
- **Expected:** PURSUE_NOW, availableNow true.
- **Actual:** PURSUE_NOW (kycGate=CLEAR). **PASS**
- **Invariant:** pass-through; clean-input behavior unchanged (H6). **UNKNOWN preserved:** n/a. **Limitation:** none. **Follow-up:** none.
- **Tags:** `SYNTHETIC`, `KYC-GATE`.

---

## 4. Classified decision-contract weaknesses (EVIDENCE_FOUND)

Four adversarial scenarios behaved exactly as the current contract predicts, and each
exposed a boundary the contract does not define. Classification per owner taxonomy:

### 4.1 S08 — expired evidence (class: **missing boundary / undocumented UNKNOWN**)
- **What happened:** EXPIRED-tier evidence with value HIGH produced an unqualified PURSUE_NOW, identical to fresh evidence.
- **Commercial significance:** In trade, a 14-month-old verification call is materially different from a current one. If a stale note sits in a HIGH-valued dimension, the deck recommends immediate pursuit with no flag — a real risk of chasing dead opportunities or pricing against outdated facts.
- **Smallest correction (proposal only, NOT applied):** either (a) document in README/contract that evidence `tier` is annotation-only and expiry screening is a human duty; or (b) if owner wants an engine gate, define an EXPIRED tier that caps the effective evidenceQuality at UNKNOWN. (b) changes decision semantics — requires owner/Codex review.

### 4.2 S10 — malformed enum (class: **missing boundary — no input validation**)
- **What happened:** `buyerFit.value="HYPERSONIC"` silently produced PURSUE_CONDITIONALLY with no diagnostic and no UNKNOWN marker.
- **Commercial significance:** A data-entry typo anywhere in a dimension silently changes the recommendation. The human never learns the input was unparsable — the engine converts garbage into a plausible-looking conditional pursuit.
- **Smallest correction (proposal only, NOT applied):** whitelist dimension values at the contract boundary; on violation, mark the dimension UNKNOWN (→ HOLD) and surface a validation reason. This changes semantics for malformed inputs only; valid inputs are unaffected.

### 4.3 S11 — duplicate payment event (class: **missing boundary — no input de-dup**)
- **What happened:** Duplicated event inflated total committed exposure to 109,200 (true 84,000) with no warning.
- **Commercial significance:** Payment schedules assembled from spreadsheets routinely contain duplicate rows. Double-counting committed exposure undermines the one number the deck computes deterministically — the concentration/exposure figure that feeds the decision brief.
- **Smallest correction (proposal only, NOT applied):** de-dup at the input boundary by (label, amountCny, daysFromSign), or reject duplicates loudly. No change to decision semantics for clean inputs.

### 4.4 S12 — inconsistent source evidence (class: **ambiguous decision rule / undocumented boundary**)
- **What happened:** Two directly contradictory PRIMARY notes yielded PURSUE_NOW because `contradictions` was empty.
- **Commercial significance:** The deck's central guard — "contradictory material evidence ⇒ escalation" — is only as strong as the human's screening pass. A missed contradiction (the most dangerous kind, since it is the one the human did not see) sails through to PURSUE_NOW.
- **Smallest correction (proposal only, NOT applied):** document the responsibility boundary explicitly ("engine reflects human-registered contradictions only; screening is a human duty"). No engine change required for correctness of the *documented* contract; auto-detection would be feature expansion (CDD V2 territory — not authorized).

---

## 5. UNKNOWN ledger

| Scenario | UNKNOWN created | UNKNOWN preserved | UNKNOWN resolved | Note |
|---|---|---|---|---|
| S03 | – | n/a | – | LOW evidence held |
| S04 | – | yes (evidenceQuality) | – | held as UNKNOWN |
| S05 | – | yes (UNK-X) | – | blocking gate held |
| S10 | **should have been** (unparsable value) | **no (pre-fix) / yes (post-fix)** | – | malformed value consumed as if valid — §4.2; fixed in `7ecbe5c` |
| S12 | **should have been** (conflict) | **no** | – | conflict never surfaced — §4.4 (documented boundary) |
| S13 | – | yes (volume, OA-90 credit, switch reason) | – | lead scan: HOLD on unverified claims |
| S14 | – | yes (drawings/BOM, feasibility) | – | lead scan: spec-unknown guardrail |
| S15 | – | yes (spec, budget/authority) | – | lead scan: ESCALATE on authority contradiction; **Margin gate UNKNOWN pending interview 001** |
| All others | – | – | – | no UNKNOWN conversion observed |

Net: 2 UNKNOWNs that should have been created (S10, S12) were not under the
pre-fix contract — both are consequences of the same class of boundary gap
(unvalidated / unscreened inputs). S10 resolved post-fix; S12 documented. S15
adds a third pending UNKNOWN: whether margin belongs in the contract at all.

## 6. Invariant summary (core invariants)

| Invariant | Status |
|---|---|
| Missing evidence ≠ negative evidence | **Held** (S03) |
| Contradictory material evidence → escalation | **Held when registered** (S06); gap when not (S12) |
| Incomparable evidence not force-ranked | **Held** (S09) |
| Weak fit not overridden by attractive signals | **Held** (S07) |
| Conditional pursuit exposes unresolved condition | **Held** (S02 — condition is the MEDIUM fit itself, surfaced in recommendation) |
| UNKNOWN remains UNKNOWN | **Held** (S04/S05); gap for unparsable inputs (S10) |
| Human approval mandatory | **Held** (all — brief boundary note present in every scenario) |
| CDD never approves supplier/pricing/margin/communication/commitment | **Held** (structural — engine output contains no approval fields; verified in invariantChecks for every scenario) |

## 7. Evidence maturity

- **Before:** LEVEL 1 VERIFIED (23/23 verify.mjs hard-rule checks, deterministic).
- **After experiment (pre-fix):** LEVEL 2 SCENARIO TESTED (12 scenarios + 1 boundary variant, 5/5 states, 8 adversarial types, deterministic across independent runs).
- **After owner-review closing:** **LEVEL 2 SCENARIO TESTED** — S10/S11 fixes + S10R/S11R regression coverage (14 scenarios: 12 PASS + 2 baseline-confirmed; verify.mjs 38/38).
- **After inbound lead scan (commit `fbe8548`):** **LEVEL 2 SCENARIO TESTED** — S13/S14/S15 added (17 scenarios: 15 PASS + 2 BASELINE_FIX_CONFIRMED + 0 FAIL, deterministic).
- **After KYC gate implementation (owner-authorized):** **LEVEL 2 SCENARIO TESTED** — S16/S17/S18 added (20 scenarios: 18 PASS + 2 BASELINE_FIX_CONFIRMED + 0 FAIL, deterministic; verify.mjs 44/44; KYC boundary experiment 10/10). The KYC gate is a contract extension with synthetic-verified behavior; it does not by itself raise evidence maturity. **Not promoted beyond Level 2.**
- **Not claimed:** DOMAIN REVIEWED / WORKFLOW OBSERVED / REAL-WORLD EVIDENCE / OUTCOME EVIDENCE. Synthetic scenario coverage proves decision-contract behavior only — not adoption, real-deal accuracy, ROI, time saved, better decisions, or market demand.

## 8. Verdict

**B — EVIDENCE_FOUND_FIX_RECOMMENDED** (owner-accepted).

Post-fix status: authorized corrections applied (S10 fail-closed enum, S11 input
de-dup), S08/S12 documented as contract boundaries, regressions pass, full suite
green. Remaining findings (S08, S12) are **documented boundaries**, not open defects.
No engine changes beyond the two authorized fixes. Evidence maturity stays at
LEVEL 2. STOP per owner closing instructions.
