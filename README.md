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
