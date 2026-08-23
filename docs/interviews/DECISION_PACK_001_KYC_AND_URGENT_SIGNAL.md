# Decision Pack 001 — Sanctions/KYC Gate & Urgent-Order Dual Signal

> **MODE**: Evidence design + synthetic boundary testing only.
> **STATUS**: PROVISIONAL — NOT DOMAIN CONSENSUS. Owner-reviewable pack; no engine,
> contract, UI, dependency, production, or Level-3 change.
> **SOURCES (source of truth)**: RECORD_DEF_2026-08-23.md · 001/002/003 interview
> outlines · DOMAIN_REVIEW_PROTOCOL.md · CDD_SCENARIO_MATRIX.md · decision-engine.js ·
> README.md. Nothing outside these was used. **No interview responses were fabricated.**
> **Repo**: apchen1978/commercial-decision-desk @ `3d168b3` (main, clean).

---

## 1. Known evidence (what we actually have)

| # | Evidence | Provenance | Strength |
|---|---|---|---|
| E1 | E (group finance/compliance): sanctions/KYC is a one-vote veto — "公司能不能活的問題", "暴利 500% 也斬" | RECORD_DEF_2026-08-23 (interview transcript) | Single-interviewee statement; NOT consensus |
| E2 | E: 中信保 insurability is checked first among commercial metrics | same | Single-interviewee statement |
| E3 | F (SOHO trader): urgent order + switching supplier is usually a red flag ("八成自己問題") | same | Single-interviewee statement; directly contradicts engine's buyerFit-HIGH semantics |
| E4 | D (brand agent): channel-price discipline is a one-vote veto; "看人" is human-only | same | Single-interviewee statement |
| E5 | Current engine contract: 8 dimensions (Buyer/Category Fit, Evidence Quality, Terms, Quote Comparability, Payment Exposure, Contradictions, UNKNOWNs, Human Decision); dimension values whitelisted (S10); payment events de-duped (S11) | decision-engine.js, CDD_SCENARIO_MATRIX.md | Verified (38/38 verify.mjs; 17 scenarios) |
| E6 | Engine has NO field for KYC, sanctions, beneficial owner, insurance, margin, supplier-switch reason, urgency direction, or profile | decision-engine.js (read) | Verified by inspection |

## 2. Inferred interpretation (analysis, clearly labeled)

- **I1 (KYC)**: IF sanctions/KYC is a hard veto for a real group buyer AND the engine
  has no compliance dimension, THEN a KYC-gate experiment would be the minimal way to
  test whether the veto can be represented. **Inference, not fact.**
- **I2 (Urgent-order)**: IF "urgent + switching supplier" is frequently a red flag,
  THEN the current buyerFit-HIGH semantics may be directionally wrong for that profile.
  **Inference, not fact — the engine currently has no direction concept at all.**
- **I3**: Both issues are representable WITHOUT new dependencies: KYC as a blocking
  UNKNOWN or material contradiction (existing primitives); urgent-direction as a
  profile-tagged dimension value or contradiction. **Representation feasibility only.**

## 3. Unresolved UNKNOWNs

| ID | UNKNOWN | Why unresolved |
|---|---|---|
| U1 | Is sanctions/KYC a *universal* gate or E-specific? | Only one interviewee (E); sample size 1 |
| U2 | What is the exact KYC gate trigger (list match? beneficial-owner unverified? AML flag?)? | Not defined in any source |
| U3 | Is "urgent = red flag" true across profiles, or only for F's SOHO context? | Only F; contradicts engine baseline |
| U4 | What distinguishes a justified urgent order from a suspicious one? | No operator data; would need interview 003 |
| U5 | Would a KYC gate change any current S01–S15 outcome? | Untested; all current fixtures lack compliance fields |
| U6 | Who maintains sanctions/KYC data (human, external service, both)? | Undecided; E mentioned 中信保 as an external validation proxy |
| U7 | Margin gate priority vs KYC gate priority | Both UNKNOWN; no owner ruling yet |

## 4. Evidence provenance

- All interview-derived claims come from `docs/interviews/RECORD_DEF_2026-08-23.md`
  (three anonymized transcripts D/E/F, owner-provided; method limitation noted:
  interviews preceded formal pre-registration).
- No response was invented, extrapolated, or merged across interviewees.
- Engine behavior claims come from `decision-engine.js` source inspection and the
  17-scenario matrix output; not from the interviews.

## 5. Owner decision questions

1. **Q1**: Should a KYC/Sanctions gate experiment be authorized (synthetic, Level-2
   boundary test — not production)?
2. **Q2**: If yes, which trigger semantics to test: (a) sanctions-list hit → veto,
   (b) beneficial-owner unverified → blocking UNKNOWN → HOLD, (c) both?
3. **Q3**: Should the urgent-order dual-signal be tested as: (a) a profile-tagged
   buyerFit modifier, (b) a contradiction pattern (urgency + switch-reason unknown),
   (c) not tested (defer to interview 003)?
4. **Q4**: What confidence level do you assign to E's and F's claims as preliminary
   evidence (the pack's default: LOW for gate semantics, MEDIUM for "issue exists")?
5. **Q5**: Priority between margin gate (interview 001), KYC gate (002), urgent signal
   (003)?

## 6. Explicit non-claims

- ✗ NOT claiming the engine evaluates KYC, sanctions, urgency direction,
  supplier-switch reason, or profile-specific meaning.
- ✗ NOT claiming "KYC gate approved" / "Margin gate approved" /
  "buyerFit semantics approved".
- ✗ NOT claiming LEVEL 3 DOMAIN REVIEWED — CDD stays LEVEL 2 SCENARIO TESTED.
- ✗ NOT claiming real-world accuracy, adoption, ROI, or outcome evidence.
- ✗ NOT claiming D/E/F statements constitute domain consensus.
- ✗ NOT claiming implementation is authorized (it is not; this is design-only).
- ✗ NOT claiming any signal is "evaluated" where the engine ignores it — those
  signals are recorded as **RECEIVED BUT NOT SEMANTICIZED INTO AN INDEPENDENT GATE**.

---

## 7. Owner adjudication table

| Question | Current evidence | Provisional owner position | Confidence | What would falsify it | Domain interview still needed? | Implementation authorized? |
|---|---|---|---|---|---|---|
| KYC gate worth an experiment? | E1 (one-vote veto claim); engine has no compliance field | **PROVISIONAL — NOT DOMAIN CONSENSUS**: worth a synthetic boundary test, not a gate | MEDIUM (issue exists) / LOW (gate semantics) | Second independent operator says sanctions are not a first-order veto | Yes (interview 002) | **NO** |
| KYC trigger semantics | U2 unresolved | **PROVISIONAL**: start with (a) sanctions-hit → veto, (b) beneficial-owner unverified → HOLD | LOW | Operator defines different triggers | Yes (interview 002) | **NO** |
| Urgent-order dual signal | E3 (F's red-flag claim); engine treats urgency as buyerFit HIGH | **PROVISIONAL**: direction is profile-dependent; do NOT flip global semantics on one SOHO sample | MEDIUM (conflict exists) / LOW (resolution) | A second trader with different profile confirms opposite direction; or interview 003 refutes | Yes (interview 003) | **NO** |
| Margin vs KYC priority | U7 | **PROVISIONAL**: KYC ranks at/above margin (E's "company survival") — but both UNKNOWN | LOW | Owner rules otherwise | Yes (001 + 002) | **NO** |
| Any production/portfolio claim change | None | **PROVISIONAL**: none | HIGH | — | No | **NO** |

---

## 8. Maturity boundary

- **CDD MATURITY: LEVEL 2 — SCENARIO TESTED (CONFIRMED).**
- LEVEL 3 DOMAIN REVIEWED: NOT CLAIMED (sample size 3 roles, no pre-registration).
- KYC GATE: **UNKNOWN / OWNER REVIEW REQUIRED**.
- URGENT SIGNAL SEMANTICS: **UNKNOWN / OWNER REVIEW REQUIRED**.
- ENGINE: UNCHANGED. CONTRACT: UNCHANGED.
