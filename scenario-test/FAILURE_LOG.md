# CDD Failure / Disagreement Log — Evidence-Depth Stress Test (2026-08-23)

**Scope:** disagreements between *ideal contract expectations* and *engine behavior*,
and any scenario whose actual state diverged from expected. Per owner amendment:
"a failed adversarial scenario is valuable evidence" — disagreements are preserved, not
smoothed over.

## Summary

- Scenarios: 12 + 1 boundary variant
- Expected-vs-actual mismatches (strict): **0** — every scenario matched its pre-declared
  reading of the current contract; determinism verified across two independent runs.
- Ideal-vs-actual disagreements (contract-boundary findings): **4** — S08, S10, S11, S12.
  These are not violations of a *stated* rule; they are boundaries the contract does not
  define. Each is recorded below with classification per owner taxonomy.

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
- **Actual:** buyerFit "HYPERSONIC" → PURSUE_CONDITIONALLY, no error, no UNKNOWN marker.
- **Classification:** missing boundary — no input validation.
- **UNKNOWN preserved:** no — the unparsable value was converted into a plausible
  conditional-pursuit recommendation.
- **Limitation:** any dimension-value typo silently changes the recommendation.
- **Follow-up:** owner decision — value whitelist (§4.2 matrix).

### D3 — S11 · DUPLICATE payment event
- **Ideal expectation:** duplicate committed events must not inflate exposure.
- **Actual:** total committed exposure 109,200 CNY (true 84,000) — double-counted;
  peak 58,800 unchanged only because duplicates share the same day.
- **Classification:** missing boundary — no input de-dup.
- **UNKNOWN preserved:** n/a.
- **Limitation:** schedule-assembly duplicates silently inflate the one deterministic
  number the deck produces.
- **Follow-up:** owner decision — de-dup at input boundary (§4.3 matrix).

### D4 — S12 · INCONSISTENT SOURCE EVIDENCE
- **Ideal expectation:** contradictory material evidence must surface (escalation).
- **Actual:** two directly conflicting PRIMARY notes, empty contradictions array →
  PURSUE_NOW; conflict invisible to the engine.
- **Classification:** ambiguous decision rule / undocumented boundary (human-only
  detection, never stated).
- **UNKNOWN preserved:** no — the conflict never surfaced as contradiction or UNKNOWN.
- **Limitation:** the central escalation guard is only as strong as the human screening
  pass; the miss case is exactly the case that would silently pass.
- **Follow-up:** owner decision — document boundary, or (feature expansion, not
  recommended) note-level conflict heuristic (§4.4 matrix).

## Non-findings (checked, held)

- Weak/unknown evidence never produced DO_NOT_PURSUE (missing ≠ negative): held.
- Non-material contradiction did not escalate: held.
- Incomparable quote bases were never force-ranked: held.
- Weak category fit was not overridden by all-positive signals: held.
- Human approval remained mandatory in every brief; no approval fields exist in engine
  output: held (structural).

## Bottom line

0 strict mismatches; 4 boundary disagreements discovered; 0 engine-logic defects
(violations of stated rules). No engine modification performed — STOP at pre-fix owner
review gate.
