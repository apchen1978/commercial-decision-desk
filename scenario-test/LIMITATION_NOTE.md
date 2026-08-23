# CDD Limitation Note — Evidence-Depth Stress Test (2026-08-23)

**Repository:** apchen1978/commercial-decision-desk @ 539f945 (baseline, unmodified)
**Experiment:** CDD Evidence Depth (owner-authorized; scenario stress test only)
**Result:** Verdict B — EVIDENCE_FOUND_FIX_RECOMMENDED (see CDD_SCENARIO_MATRIX.md §4)

## Known limitations discovered by the experiment (new)

1. **Expired evidence carries no signal (S08).** The engine consumes only
   `dimensions.value`; evidence `tier` is a human-facing annotation and never gates a
   decision. A stale verification note is commercially indistinguishable from a current
   one. The fixture tier vocabulary has no EXPIRED tier, and the contract never states
   that tiers are annotation-only.

2. **No dimension-value validation (S10).** A value outside the
   HIGH/STRONG/MEDIUM/LOW/WEAK/UNKNOWN/NONE/IRRELEVANT vocabulary is silently treated as
   "not strong" and falls through to PURSUE_CONDITIONALLY — no error, no UNKNOWN marker,
   no diagnostic. Garbage input changes the recommendation quietly.

3. **No payment-event de-dup (S11).** Duplicated events double-count committed exposure
   (S11: total 109,200 vs true 84,000). Peak happened to be safe because the duplicates
   shared a day; duplicates on different days would corrupt the peak too.

4. **Contradiction detection is human-only and undocumented (S12).** The engine surfaces
   contradictions that appear in the pre-filled `contradictions` array; it does not scan
   evidence notes. A screening miss silently yields PURSUE_NOW on directly conflicting
   primary evidence. The division of responsibility is not stated in the contract.

## What the experiment does NOT prove (evidence maturity boundary)

- NOT commercial adoption, real-deal accuracy, ROI, saved time, improved decisions, or
  market demand.
- NOT that a real deal would behave like the synthetic fixtures.
- Synthetic scenario coverage proves decision-contract behavior only.

## Deliberately unchanged

- No engine modification (STOP at pre-fix owner review gate per owner amendment).
- No fixture changes to production `fixtures.js` (the isolated harness builds its own
  mutated fixtures in-memory; `fixtures.js` untouched).
- No portfolio copy, One-Pager, or Capability Brief changes.
- No CDD V2. No feature expansion.

## Proposed smallest corrections (for owner/Codex review — NOT applied)

| # | Gap | Smallest correction | Changes decision semantics? |
|---|---|---|---|
| 1 | Expired evidence (S08) | (a) Document tiers as annotation-only; or (b) EXPIRED tier caps effective evidenceQuality at UNKNOWN | (a) no / (b) yes |
| 2 | Malformed enum (S10) | Whitelist dimension values; on violation mark UNKNOWN + surface reason | yes (malformed inputs only) |
| 3 | Duplicate events (S11) | De-dup at input boundary by (label, amountCny, daysFromSign) or reject loudly | no (clean inputs unaffected) |
| 4 | Unscreened contradictions (S12) | Document the human-only detection boundary explicitly | no |

Owner/Codex decision required before any of these are implemented.
