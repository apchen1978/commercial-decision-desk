# Experiment Record — Decision Ledger（decision-asset slice, charter-approved 2026-08-25）

> **MODE**: implementation slice (owner approved charter with refinements).
> **STATUS**: IMPLEMENTED + TESTED. Decision core frozen (decision-engine.js untouched).
> **Repo**: apchen1978/commercial-decision-desk @ `9727947` (post-commit).
> **Charter**: `docs/interviews/CHARTER_DECISION_LEDGER_001.md` (b7f7b9d).

---

## 1. What was built

| File | Role |
|---|---|
| `workbench-ledger.js` | Snapshot serializer: **reuses `buildDealBriefViewModel` output verbatim** — never recalculates, re-evaluates, or reinterprets. Schema v1, kind `decision-snapshot`, `exportedAt`. `parseLedgerSnapshot` rejects invalid JSON / non-ledger / unsupported schema. |
| `ledger.html` + `workbench-ledger-view.js` | **Pure-static, read-only review page** — local-file-only (FileReader), no server/network/API. Presents recommendation vs human decision **separately**; unknowns / blockers / contradictions / reasons verbatim; evidence-trace line; boundary note. Error path shows message + hides content. |
| `app.js` / `index.html` / `i18n.js` | Minimal export hook: `匯出決策快照` button next to Deal Brief export (zh + en). |
| `workbench-ledger.test.mjs` | 17/17 PASS. |

## 2. Refinements honored (owner)

- **One JSON snapshot per assessment** — yes (`CDD-Decision-Ledger-<date>-<name>.json`).
- **Reuse existing Deal Brief view model** — `serializeLedgerSnapshot(brief)` takes the
  brief built by `currentDealBrief()`; no parallel view logic.
- **Minimum app.js export hook** — one button + one handler, alongside existing export.
- **Static, local-file-only, read-only, no recalc/reinterpret** — ledger page has no
  engine import; it only maps snapshot fields to DOM.
- **Preserved**: UNKNOWN (position.unknowns verbatim), NOT_RECORDED (humanDecision
  defaults to NOT_RECORDED, never fabricated), human-decision separation (own
  section, own field), synthetic markers (`synthetic` flag + tag), evidence
  traceability (actions/negotiationPrep evidenceTrace carried into snapshot).

## 3. Verification

- `workbench-ledger.test.mjs` **17/17 PASS** (shape, determinism except exportedAt,
  NOT_RECORDED default, UNKNOWN/contradiction/reason preservation, round-trip
  parse + rejection paths, filename determinism + safety).
- `verify.mjs` **50/50 PASS** (unchanged). Matrix **21 scenarios (19+2+0) unchanged**.
- **decision-engine.js untouched** (git diff empty).
- Playwright: ledger page loads a real snapshot — rec "Escalate" vs human "Hold for
  evidence" shown separately, note displayed, SYNTHETIC tag, 3 UNKNOWN / 5 blockers /
  5 reasons rendered; **390px no overflow**; **0 console errors**; non-ledger JSON
  correctly rejected (message + content hidden).

## 4. Limitations discovered

- Snapshot files are local-only by design — no multi-device sync (out of scope).
- Ledger page is presentational; it does not aggregate patterns across snapshots
  (deliberate: no AI/reinterpretation per charter OUT list).
- `exportedAt` differs per export — content determinism holds on the rest.

## 5. Maturity & status

- CDD maturity: LEVEL 2 SCENARIO TESTED (unchanged). No Level 3 claim.
- Decision core: UNCHANGED. No new gates / states / scoring.
- This is the first Tradecraft Workbench series block (decision asset layer).

## 6. Verdict

**SLICE COMPLETE.** Implemented per charter + refinements, tested (17/17 + 50/50 +
21-matrix), engine untouched. Awaiting owner review of the live review page.
