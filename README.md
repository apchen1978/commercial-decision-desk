# Commercial Decision Desk

Decision-support prototype for one question: **"Should we pursue this overseas
commercial opportunity now?"**

A convergence proof — **not** a production product. No backend, no database,
no persistence, no network calls, no real prospect data.

## Core principle

> Human defines the decision boundary. AI operates inside it.

The desk assembles evidence, applies deterministic rules, and recommends a
**decision-support state**. It never contacts, negotiates, quotes, commits,
approves, or rejects anything. The final commercial decision always belongs to
the human.

## Run

```bash
# any static server works (no build step)
python -m http.server 8080
# or: npx serve .
```

## Files

- `index.html` — one-screen flow: Opportunity → Evidence → Commercial →
  Payment Exposure → WHY/WHY NOT/UNKNOWN → Decision Brief → Human Decision
- `app.js` — client-side rendering (no framework)
- `fixtures.js` — the synthetic opportunity (clearly labeled)
- `decision-engine.js` — pure, deterministic rules + payment math
- `verify.mjs` — automated hard-rule + determinism checks

## Synthetic scenario (OPP-2026-008)

A Gulf-region hospitality procurement desk invites international suppliers to
quote window treatments (curtains + hardware) for a multi-property rollout.
Strong Buyer Fit and Category Fit; a **material payment-terms contradiction**
(90-day vs 30% advance) is unresolved; indicative volumes are
VERIFICATION_REQUIRED; installation/customs liability is outside the standard
scope; three quote bases are **not comparable**; one payment event is
incomplete.

The fixture is designed to land on a genuine human trade-off: escalate to
resolve the contradiction, proceed conditionally on written terms, hold for
volume evidence, or decline on the liability scope.

## Decision rules (hard rules, enforced deterministically)

1. Weak/irrelevant Category Fit can never produce `PURSUE_NOW`.
2. A material contradiction is surfaced visibly and blocks `PURSUE_NOW`
   (recommendation moves to `ESCALATE`).
3. Missing commercial terms stay `UNKNOWN`; incomplete terms allow
   `HOLD_FOR_EVIDENCE`.
4. Non-comparable quote bases are never ranked.
5. Payment exposure is calculated **only** from complete payment-event inputs;
   otherwise it is `UNKNOWN` and not calculated.
6. Payment concentration means payment commitments only.
7. Exposure is never described as cash balance, liquidity, affordability, cash
   shortfall, or credit capacity (disclosure shown in the UI).
8. The final commercial decision always belongs to the human.

The desk **consults positive evidence** (Buyer Fit, Evidence Quality) when
forming its recommendation — no weighting/scoring is used. `PURSUE_NOW` is
recommended only when every gate is clear (acceptable Category Fit, no
material contradiction, complete commercial terms, complete payment events,
no blocking UNKNOWN) **and** Buyer Fit and Evidence Quality are strong.
LOW/UNKNOWN Evidence Quality prefers `HOLD_FOR_EVIDENCE`. Human approval is
still required in every case.

## Deterministic calculations

- Payment exposure: sum of complete committed events; peak rolling N-day
  window (default 7); per-event share; single-buyer concentration. Pure
  function of the fixture — identical output on every run.
- Recommendation: pure rule evaluation (`decision-engine.js`).

## Validation

```bash
node verify.mjs
```

Checks: all hard rules, UNKNOWN stays UNKNOWN, contradiction visible,
deterministic payment reproducible (two runs identical), disclosure present,
human approval required, no network/persistence usage, no real records.

## Documented boundaries (evidence-depth experiment findings)

These are **explicit contract boundaries** — documented so callers and reviewers
share the same expectations. They are not defects by themselves; they define
what the engine does and does not evaluate.

### Evidence freshness / expiry is NOT evaluated (S08 finding)

The decision engine evaluates **evidence quality values only**. It does **not**
evaluate how fresh evidence is — no expiry timestamp, no staleness check, no
age threshold. A verification note from 14 months ago is treated exactly like
one from yesterday if both carry the same dimension value.

Freshness / expiry screening is currently a **human responsibility** at intake.
There is deliberately **no universal expiry threshold** — a 90-day-old price
confirmation may be useless while a 2-year-old buyer relationship record may
still matter; only domain judgment can decide. If you want an engine-level
expiry gate, that is a separate, owner-approved design decision — not something
this engine invents on its own.

### Contradiction records are expected to be normalized UPSTREAM (S12 finding)

`evaluateDecision()` reads the opportunity's `contradictions` array **as given**.
The engine does **not** scan evidence notes or free text to detect contradictions
itself. Callers / the human workflow are expected to **normalize contradiction
records before calling `evaluateDecision()`** — i.e., conflicting evidence must
already be registered as entries in `contradictions` (with `material: true` and
`status: "UNRESOLVED"`) for Rule 2 to fire.

This is a documented responsibility boundary: the engine reflects registered
contradictions; it does not discover them. There is no automatic NLP/agent-based
contradiction detection, and none is planned under the current scope.

### Malformed dimension values fail closed (S10 fix)

Dimension values outside the accepted vocabulary
(`HIGH / STRONG / MEDIUM / LOW / WEAK / UNKNOWN / NONE / IRRELEVANT`, or empty)
are **not** silently treated as a meaningful level. `evaluateDecision()` marks
the dimension invalid, surfaces it in `reasons`, and fails closed to the
evidence-required path — the recommendation becomes `HOLD_FOR_EVIDENCE` and
`PURSUE_NOW` / `PURSUE_CONDITIONALLY` are unavailable.

### Duplicate payment events are de-duplicated (S11 fix)

`paymentExposure()` de-duplicates complete payment events by
`(label, amountCny, daysFromSign)`, preserving first occurrence. Duplicate
inputs no longer silently inflate committed exposure. `dedupedCount` reports how
many duplicate complete events were dropped (0 for clean inputs).

### KYC / sanctions gate (owner-authorized implementation, 2026-08-23)

`evaluateDecision()` reads an optional structured `kyc` field:

- `kyc.status` — `CLEAR` / `INCOMPLETE` / `ADVERSE`
- `kyc.sanctionsHit`, `kyc.adverseFinding`, `kyc.beneficialOwnerVerified`

Gate semantics (verified by the KYC boundary experiment, 10/10 PASS):

- **Sanctions hit / adverse finding → `DO_NOT_PURSUE`** — a one-vote veto,
  regardless of margin, insurance availability, or commercial signals
  (matches the domain-record claim "利潤再高都沒用 / 公司能不能活的問題").
- **KYC incomplete / beneficial owner unverified → `HOLD_FOR_EVIDENCE`** —
  evidence-required; insurance availability does NOT clear this gate.
- **Clear or absent `kyc` field → gate transparent** — clean-input behavior
  unchanged (no field = no gate).

The `kycGate` result field reports `SANCTIONS_VETO` / `KYC_INCOMPLETE` /
`CLEAR` / `ABSENT`. No scoring, no new decision states, no new dependencies.
KYC gate semantics remain **provisional** (single domain source so far —
interview 002 pending) but the engine behavior is deterministic and tested.

### Margin gate (owner-authorized building phase, 2026-08-23)

`evaluateDecision()` reads an optional structured `margin` field:

- `margin.bps` — gross margin in basis points (e.g. 500 = 5%)
- `margin.thresholdBps` — the **caller-declared** minimum viable margin. The engine
  does NOT invent a universal threshold (same discipline as S08 expiry: no
  threshold input, no gate).
- `margin.costPayer` / `margin.costType` — cost-shift signal (e.g.
  `costPayer:"SUPPLIER", costType:"CERTIFICATION"`).

Gate semantics (verified by verify.mjs + S19):

- **`bps < thresholdBps` → `DO_NOT_PURSUE`** — commercial-viability veto; the
  margin/cost killer becomes an independent, explainable gate. This is the
  **realized S15 future flip** (L3 lead: 5% margin + certification-cost shift was
  previously only `ESCALATE` on the authority contradiction; S19 proves it now
  vetoes with structured margin input).
- **Cost-shift to supplier alone → risk signal, not a veto** (the declared
  threshold comparison decides).
- **Absent `margin` field, or no declared threshold → gate transparent** — clean
  behavior unchanged.

The `marginGate` result field reports `BELOW_THRESHOLD` / `COST_SHIFT` / `CLEAR` /
`ABSENT`. Margin gate semantics are **provisional** (interview 001 deferred) —
the threshold is a caller decision, never engine-invented.

## Scenario evidence

`scenario-test/` holds the owner-approved evidence-depth experiment: a **21-scenario
matrix** (5/5 decision states, 8 adversarial types, 3 inbound-lead scans S13–S15,
3 KYC-gate regressions S16–S18, 1 margin-gate flip S19) with pre-declared
expectations, raw deterministic output, and a limitation/classification record.
Run it with:

```bash
node scenario-test/run-scenarios.mjs
```

S13–S15 are tagged `SYNTHETIC` + `PRE-MARGIN-GATE`: S15 (a 5%-margin custom-equipment
lead with certification costs shifted to the supplier) is the key edge case; S19
(`MARGIN-GATE` tag) proves the same case now vetoes (`DO_NOT_PURSUE`) once the
structured margin field declares bps below the caller threshold — the realized
S15 future flip. S16–S18 are tagged `SYNTHETIC` + `KYC-GATE` (sanctions veto /
KYC-incomplete HOLD / clear pass-through). See "Documented boundaries".
Current matrix: **21 scenarios — 19 PASS, 2 BASELINE_FIX_CONFIRMED, 0 FAIL,
deterministic** (see `scenario-test/outputs/run-log.txt`).
