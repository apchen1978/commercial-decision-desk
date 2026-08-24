# CDD — AI-Assisted Commercial Intake: Future Architecture (Vision)

> Status: **PRODUCT DIRECTION / DESIGN ONLY — NOT IMPLEMENTED.**
> Adopted 2026-08-25 per product direction. This document records the intended
> future architecture. No AI calls, API keys, voice recognition, extraction,
> backend, database, or new scoring are implemented today. The Decision Core,
> Commercial Momentum formula, Evidence Coverage formula, gates, economics,
> recommendation logic, and evidence contracts are unchanged (ZERO diff).

## Future architecture (intended)

```
VOICE / TEXT
    ↓
AI COMMERCIAL INTAKE          ← understands and structures (future)
    ↓
STRUCTURED CDD SCHEMA
    ↓
HUMAN CONFIRMATION            ← human reviews BEFORE assessment
    ↓
EXISTING DECISION CORE        ← unchanged; judges and controls
    ↓
EXECUTIVE DEAL BRIEF
```

### Example future workflow (illustrative)

A salesperson or sales director says:

> “We have a Dubai hotel group asking for 12,000 meters of window treatment,
> around USD 480K, CIF. They mentioned 30% deposit and 70% before shipment,
> but payment terms are not formally confirmed.”

Future AI Intake could extract: Buyer · Market · Product · Quantity · Revenue ·
Currency · Incoterm · Payment structure · Evidence status · Buyer authority ·
UNKNOWN / uncertain fields — then **pre-fill the existing CDD form**. The human
reviews and confirms the extraction **before** the assessment runs.

## Core AI principle

> **AI UNDERSTANDS AND STRUCTURES. CDD CORE JUDGES AND CONTROLS.**

AI must NOT silently invent missing commercial facts. Examples:

- Payment Terms = UNKNOWN
- Buyer Authority = UNCERTAIN
- Incoterm = CIF — mentioned, not confirmed

**Unknown remains UNKNOWN until evidence or human confirmation resolves it.**
This boundary is fundamental and non-negotiable.

## Provider-ready direction

Provider-agnostic where practical (OpenAI / Gemini / DeepSeek / other compatible
AI APIs). Do not couple the product narrative to one vendor. Codex stays part of
the development / agent workflow, not an end-user inference provider.

Potential future configuration: AI Provider → API Key → Model → standardized CDD
structured schema. **API keys and provider integrations are NOT implemented in
this task.**

## Future capability path (documented, NOT built)

| Phase | Capability | Note |
|---|---|---|
| 1 | **Text-to-Deal Intake** | Paste/type commercial notes → AI extracts structured fields → human confirms → populate existing CDD → run assessment |
| 2 | **Voice-to-Deal Brief** | Speak commercial notes → speech-to-text → same AI Intake pipeline → human confirmation → assessment |
| 3 | **External Intelligence** | Optional market / buyer / trade / commercial data enrichment |
| 4 | **Scenario Intelligence** | e.g. “What changes if payment moves from 30/70 to LC at sight?” — reuse existing deterministic logic where possible |
| 5 | **Evidence-Calibrated Intelligence** | Only after sufficient real shadow-use cases exist; use historical human decisions/outcomes to evaluate whether heuristics should be calibrated. **Do not claim this exists today.** |

## Product evolution story

```
TODAY   Evidence-Grounded Decision Desk
NEXT    AI-Assisted Commercial Intake
THEN    AI-Augmented Decision Intelligence
LATER   Evidence-Calibrated Commercial System  (only with real evidence)
```

Communicate: **“Useful now. Designed to learn and evolve.”** — not “Future AI
will magically predict deals.”

## Guardrails (unchanged)

- Deterministic, evidence-grounded, traceable, owner-governed, human-confirmed.
- Commercial Momentum is an **owner-governed heuristic**, not win/closing
  probability, AI prediction, credit score, or approval probability.
- See `SHADOW_USE_MOMENTUM_RECORD.md` for the shadow-use evidence template.
