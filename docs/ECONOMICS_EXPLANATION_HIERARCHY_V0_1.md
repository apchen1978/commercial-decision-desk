# CDD Economics Explanation Hierarchy v0.1

Evidence provenance: DSH Red Team #001 → RT-003 → Economic Sanity Review #001 → Economics Semantics Design Gate #001 → `EXPLANATION_HIERARCHY` → implementation → frozen-probe validation.

Evidence classification: bounded synthetic / scenario validation. This is not customer validation, ROI evidence, conversion evidence, or economic prediction accuracy.

## Contract

`economicsReading` is derived only from the existing Economics Bridge:

- calculated Expected Net Contribution `> 0` → `POSITIVE`
- calculated Expected Net Contribution `=== 0` → `BREAK_EVEN`
- calculated Expected Net Contribution `< 0` → `NEGATIVE`
- incomplete calculation → `UNKNOWN`

The reading is presentation-only. It does not enter `evaluateDecision()`, create a gate, change Momentum or Coverage, or represent profitability approval.

Canonical boundary: **PURSUE_NOW ≠ COMMIT_TO_DEAL**.

## Validation

- positive / zero / slightly negative / severely negative: PASS
- incomplete economics / UNKNOWN: PASS
- economics reading changes without recommendation change: PASS
- negative economics with KYC veto: existing KYC `DO_NOT_PURSUE` remains controlling: PASS
- ZH / EN interpretation: PASS
- 390px / 1440px overflow: PASS
- console errors and warnings: 0

## Interpretation

Negative economics now reads as a commercial signal that may support continued evidence gathering while not supporting direct commitment. Positive economics remains an estimate, not approval. UNKNOWN remains evidence incompleteness, not negative evidence. Owner judgment remains separate.
