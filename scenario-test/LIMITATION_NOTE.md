# CDD Limitation Note — Evidence-Depth Stress Test (2026-08-23)

**Repository:** apchen1978/commercial-decision-desk @ 539f945 (baseline) → post-fix
**Experiment:** CDD Evidence Depth (owner-authorized; scenario stress test only)
**Result:** Verdict B — EVIDENCE_FOUND_FIX_RECOMMENDED (owner-accepted; closing executed)

## Limitations status (post owner review)

| # | Gap | Status after closing |
|---|---|---|
| 1 | Expired evidence (S08) | **DOCUMENTED boundary** — engine does not evaluate freshness/expiry; no universal threshold invented (README §Documented boundaries) |
| 2 | Malformed enum (S10) | **FIXED** — whitelist validation, fail-closed to HOLD_FOR_EVIDENCE, reason surfaced; regression S10R PASS |
| 3 | Duplicate events (S11) | **FIXED** — de-dup by (label, amountCny, daysFromSign), dedupedCount reported; regression S11R PASS |
| 4 | Unscreened contradictions (S12) | **DOCUMENTED boundary** — contradiction records must be normalized upstream; engine reflects registered contradictions only; no NLP/agent (README §Documented boundaries) |

## Known limitations remaining (post-fix)

1. **Evidence freshness / expiry is not evaluated (S08, documented).** The engine
   consumes only `dimensions.value`; `tier` is a human-facing annotation and never
   gates a decision. A stale verification note is commercially indistinguishable
   from a current one. Freshness screening remains a human responsibility at intake.
   No universal expiry threshold exists by design.

2. **Contradiction detection is human-only (S12, documented).** The engine surfaces
   contradictions that appear in the pre-filled `contradictions` array; it does not
   scan evidence notes. Callers must normalize contradiction records upstream of
   `evaluateDecision()`. A screening miss can still silently yield pursuit on
   conflicting primary evidence — this is now an explicit, documented contract
   boundary rather than an undocumented gap.

## What the experiment does NOT prove (evidence maturity boundary)

- NOT commercial adoption, real-deal accuracy, ROI, saved time, improved decisions, or
  market demand.
- NOT that a real deal would behave like the synthetic fixtures.
- Synthetic scenario coverage proves decision-contract behavior only.

## Deliberately unchanged

- No engine changes beyond the two owner-authorized fixes (S10 fail-closed enum,
  S11 input de-dup). No CDD V2, no UI changes, no new agents, no new integrations.
- No fixture changes to production `fixtures.js` (the isolated harness builds its own
  mutated fixtures in-memory; `fixtures.js` untouched).
- No portfolio copy, One-Pager, or Capability Brief changes (Document Parity: N/A —
  Level 2 evidence does not materially change any existing external claim).
- No evidence-maturity promotion beyond LEVEL 2 SCENARIO TESTED.

## Proposed smallest corrections (owner decision required for the documented gaps)

| # | Gap | Smallest correction | Changes decision semantics? | Status |
|---|---|---|---|---|
| 1 | Expired evidence (S08) | (a) Document tiers as annotation-only; or (b) EXPIRED tier caps effective evidenceQuality at UNKNOWN | (a) no / (b) yes | **(a) done — documented; (b) NOT authorized** |
| 2 | Malformed enum (S10) | Whitelist dimension values; on violation mark UNKNOWN + surface reason | yes (malformed inputs only) | **FIXED (authorized)** |
| 3 | Duplicate events (S11) | De-dup at input boundary by (label, amountCny, daysFromSign) or reject loudly | no (clean inputs unaffected) | **FIXED (authorized)** |
| 4 | Unscreened contradictions (S12) | Document the human-only detection boundary explicitly | no | **done — documented** |

Owner/Codex decision required before any of these are implemented.
