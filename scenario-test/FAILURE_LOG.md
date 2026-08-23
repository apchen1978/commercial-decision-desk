# CDD Failure / Disagreement Log — Evidence-Depth Stress Test (2026-08-23)

**Scope:** disagreements between *ideal contract expectations* and *engine behavior*,
and any scenario whose actual state diverged from expected. Per owner amendment:
"a failed adversarial scenario is valuable evidence" — disagreements are preserved, not
smoothed over.

## Post-fix closing note

Owner accepted Verdict B and authorized two fixes + two documentation items. After the
fixes, the two original adversarial scenarios (S10, S11) became **pre-fix baselines**
and now intentionally diverge from their recorded pre-fix expected states — the
divergence is the evidence the fixes exist (verdict `BASELINE_FIX_CONFIRMED`). The
disagreement log below therefore records both the pre-fix behavior (as evidence) and
the post-fix resolution.

## Summary (post-fix run)

- Scenarios: 14 (12 original + S10R/S11R regressions) + 1 boundary variant
- PASS: 12 · BASELINE_FIX_CONFIRMED: 2 (S10, S11) · FAIL: 0 · BASELINE_FIX_ABSENT: 0
- Determinism: identical across two independent runs
- verify.mjs: 38/38 PASS (no regression to the existing suite)
- **Later extension (commit `fbe8548`):** inbound lead scan S13/S14/S15 added —
  current matrix is **17 scenarios: 15 PASS, 2 BASELINE_FIX_CONFIRMED, 0 FAIL**
  (S13–S15 tagged SYNTHETIC + PRE-MARGIN-GATE; S15 is the margin-not-yet-a-gate edge case).
  This log records the post-fix run; the latest full output lives in
  `outputs/run-log.txt` / `outputs/scenario-results.raw.json`.

## Disagreement log

### D1 — S08 · EXPIRED evidence
- **Ideal expectation:** expired evidence should not be treated as current.
- **Actual:** PURSUE_NOW, unqualified — engine has no expiry signal.
- **Classification:** missing boundary / undocumented UNKNOWN.
- **UNKNOWN preserved:** n/a (no expiry concept exists in the contract).
- **Limitation:** tiers are annotation-only; expiry screening is implicitly a human duty.
- **Follow-up:** owner decision — document, or add expiry gate (§4.1 matrix).

### D2 — S10 · MALFORMED enum value
- **Ideal expectation:** unparsable input should be rejected or marked UNKNOWN, never
  silently consumed as if valid.
- **Actual (pre-fix):** buyerFit "HYPERSONIC" → PURSUE_CONDITIONALLY, no error, no UNKNOWN marker.
- **Actual (post-fix):** → HOLD_FOR_EVIDENCE, reason "Invalid dimension value in buyerFit"
  surfaced, PURSUE_NOW/PURSUE_CONDITIONALLY unavailable. Regression S10R PASS.
- **Classification:** missing boundary — no input validation. **RESOLVED (authorized fix).**
- **UNKNOWN preserved:** now yes (invalid value treated as UNKNOWN).
- **Follow-up:** none — closed.

### D3 — S11 · DUPLICATE payment event
- **Ideal expectation:** duplicate committed events must not inflate exposure.
- **Actual (pre-fix):** total committed exposure 109,200 CNY (true 84,000) — double-counted;
  peak 58,800 unchanged only because duplicates share the same day.
- **Actual (post-fix):** total 84,000; dedupedCount=1; regression S11R PASS.
- **Classification:** missing boundary — no input de-dup. **RESOLVED (authorized fix).**
- **UNKNOWN preserved:** n/a.
- **Follow-up:** none — closed.

### D4 — S12 · INCONSISTENT SOURCE EVIDENCE
- **Ideal expectation:** contradictory material evidence must surface (escalation).
- **Actual:** two directly conflicting PRIMARY notes, empty contradictions array →
  PURSUE_NOW; conflict invisible to the engine.
- **Classification:** ambiguous decision rule / undocumented boundary (human-only
  detection, never stated). **RESOLVED as documented boundary** — README now states
  contradiction records must be normalized upstream; engine reflects registered
  contradictions only; no NLP/agent detection.
- **UNKNOWN preserved:** n/a (boundary documented, engine behavior unchanged by design).
- **Follow-up:** none — closed as documentation.

## Non-findings (checked, held)

- Weak/unknown evidence never produced DO_NOT_PURSUE (missing ≠ negative): held.
- Non-material contradiction did not escalate: held.
- Incomparable quote bases were never force-ranked: held.
- Weak category fit was not overridden by all-positive signals: held.
- Human approval remained mandatory in every brief; no approval fields exist in engine
  output: held (structural).

## Bottom line (post-fix)

Original run: 0 strict mismatches; 4 boundary disagreements discovered; 0 engine-logic
defects. Owner accepted Verdict B. Post-fix: S10 and S11 resolved by authorized engine
fixes (verified by S10R/S11R regressions and BASELINE_FIX_CONFIRMED divergence); S08 and
S12 resolved as documented boundaries in README. verify.mjs 38/38 PASS; scenario matrix
14 scenarios — 12 PASS, 2 BASELINE_FIX_CONFIRMED, 0 FAIL. Evidence maturity remains
LEVEL 2 SCENARIO TESTED. STOP per owner closing instructions.
