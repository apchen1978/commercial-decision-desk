// flip-map.js — "what would change this recommendation?" as an overview.
//
// Not a second decision engine. Every state below is produced by the existing
// evaluateDecision() run on a HYPOTHETICAL copy of the opportunity; nothing here
// mutates the opportunity, persists anything, or counts as evidence. The map only
// shows which confirmations would move the deterministic gate chain, in what
// order, and which adverse findings would move it the other way. The human
// decision stays separate and final.
//
// The economics reading is presentation-only, exactly as in economics-bridge.js:
// it is never a gate. It only reaches the engine if the owner declares a margin
// threshold (`margin.thresholdBps`), which is what the adverse scenario models.

import { evaluateDecision } from "./decision-engine.js";
import { buildEconomicsBridge } from "./economics-bridge.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const idsIn = (text) => String(text ?? "").match(/\b(?:CTR|UNK)-\d+\b/g) ?? [];
const isStrong = (value) => ["HIGH", "STRONG"].includes(String(value ?? "").toUpperCase());

// One blocker = one gate the engine currently reads, with the confirmation that
// would clear it. `patch` builds the hypothetical opportunity; null means the
// missing fact cannot be simulated (it must be supplied as real data).
function listBlockers(opp, engine) {
  const blockers = [];
  if (engine.kycGate === "KYC_INCOMPLETE") {
    blockers.push({
      id: "kyc", kind: "kyc", stage: "gate",
      patch: (o) => { o.kyc = { ...o.kyc, status: "CLEAR", beneficialOwnerVerified: true }; },
    });
  }
  for (const c of engine.materialContradictions) {
    const linked = idsIn(c.resolveWith).filter((id) => id !== c.id);
    blockers.push({
      id: c.id, kind: "contradiction", stage: "gate", label: c.label, resolveWith: c.resolveWith ?? null,
      clears: [c.id, ...linked],
      patch: (o) => {
        o.contradictions = o.contradictions.map((x) => (x.id === c.id ? { ...x, status: "RESOLVED" } : x));
        o.unknowns = (o.unknowns || []).filter((u) => !linked.includes(u.id));
      },
    });
  }
  const evidence = String(opp.dimensions?.evidenceQuality?.value ?? "").toUpperCase();
  if (["LOW", "WEAK", "", "UNKNOWN"].includes(evidence)) {
    blockers.push({
      id: "evidence-floor", kind: "evidence", stage: "gate",
      patch: (o) => { o.dimensions.evidenceQuality = { ...o.dimensions.evidenceQuality, value: "MEDIUM" }; },
    });
  }
  if (engine.termsIncomplete) {
    blockers.push({
      id: "terms", kind: "terms", stage: "gate", resolveWith: opp.commercialTerms?.resolveWith ?? null,
      patch: (o) => { o.commercialTerms = { ...o.commercialTerms, status: "COMPLETE" }; },
    });
  }
  if (!engine.exposure.computed) {
    blockers.push({ id: "payment-events", kind: "payment-events", stage: "gate", patch: null });
  }
  for (const u of engine.blockingUnknowns) {
    blockers.push({
      id: u.id, kind: "unknown", stage: "gate", label: u.label, resolveWith: u.resolveWith ?? null, clears: [u.id],
      patch: (o) => { o.unknowns = o.unknowns.filter((x) => x.id !== u.id); },
    });
  }
  // Final stage: PURSUE_NOW additionally needs strong buyer fit and strong evidence.
  if (!engine.strongBuyerFit) {
    blockers.push({
      id: "buyer-fit", kind: "buyer-fit", stage: "final",
      patch: (o) => { o.dimensions.buyerFit = { ...o.dimensions.buyerFit, value: "HIGH" }; },
    });
  }
  if (!engine.strongEvidence) {
    blockers.push({
      id: "evidence-strong", kind: "evidence-strong", stage: "final",
      patch: (o) => { o.dimensions.evidenceQuality = { ...o.dimensions.evidenceQuality, value: "HIGH" }; },
    });
  }
  return blockers;
}

// Gates evidence cannot clear inside this tool: a veto, or a fit that must be reassessed.
function terminalGates(engine) {
  const terminal = [];
  if (engine.kycGate === "SANCTIONS_VETO") terminal.push({ id: "kyc-veto", kind: "kyc-veto" });
  if (engine.marginGate === "BELOW_THRESHOLD") terminal.push({ id: "margin-veto", kind: "margin-veto" });
  if (engine.categoryWeak) terminal.push({ id: "category-weak", kind: "category-weak" });
  return terminal;
}

function applied(opp, blocker) {
  const copy = clone(opp);
  blocker.patch(copy);
  return copy;
}

function publicBlocker(b) {
  const { patch, ...rest } = b;
  return { ...rest, simulable: patch !== null };
}

// Clear one blocker at a time in the engine's own priority order, re-running the
// engine after each, until PURSUE_NOW, a gate that needs real data, or a veto.
function upsideRoute(opp, startEngine) {
  const steps = [];
  let working = clone(opp);
  let engine = startEngine;
  let stoppedBecause = null;
  for (let guard = 0; guard < 30 && engine.recommended !== "PURSUE_NOW"; guard++) {
    const blockers = listBlockers(working, engine);
    const next = blockers[0];
    if (!next) { stoppedBecause = "no-blockers"; break; }
    if (next.patch === null) { stoppedBecause = next.kind; steps.push({ ...publicBlocker(next), before: engine.recommended, after: engine.recommended, flips: false }); break; }
    next.patch(working);
    const after = evaluateDecision(working);
    steps.push({ ...publicBlocker(next), before: engine.recommended, after: after.recommended, flips: after.recommended !== engine.recommended });
    engine = after;
  }
  return { steps, finalState: engine.recommended, reachedPursueNow: engine.recommended === "PURSUE_NOW", stoppedBecause };
}

// What each single confirmation would do on its own. Confirmations whose effect
// is hidden behind a higher-priority gate are reported as masked, not as useless.
function singleEffects(opp, engine) {
  return listBlockers(opp, engine).filter((b) => b.patch !== null).map((b) => {
    const after = evaluateDecision(applied(opp, b)).recommended;
    return { id: b.id, kind: b.kind, state: after, flips: after !== engine.recommended };
  });
}

// Adverse findings, each evaluated by the real engine on a hypothetical copy.
function adverseScenarios(opp, engine) {
  const scenarios = [];
  const add = (id, patch) => {
    const copy = clone(opp);
    patch(copy);
    const state = evaluateDecision(copy).recommended;
    scenarios.push({ id, state, changes: state !== engine.recommended });
  };
  if (engine.kycGate !== "SANCTIONS_VETO") add("kyc-adverse", (o) => { o.kyc = { ...o.kyc, status: "ADVERSE", sanctionsHit: true }; });
  if (engine.kycGate !== "KYC_INCOMPLETE" && engine.kycGate !== "SANCTIONS_VETO") add("kyc-incomplete", (o) => { o.kyc = { ...o.kyc, status: "INCOMPLETE", beneficialOwnerVerified: false }; });
  if (!engine.categoryWeak) add("category-weak", (o) => { o.dimensions.categoryFit = { ...o.dimensions.categoryFit, value: "WEAK" }; });
  if (!["LOW", "WEAK"].includes(String(opp.dimensions?.evidenceQuality?.value ?? "").toUpperCase())) add("evidence-low", (o) => { o.dimensions.evidenceQuality = { ...o.dimensions.evidenceQuality, value: "LOW" }; });
  const bridge = buildEconomicsBridge(opp.economics);
  if (bridge.calculationStatus === "CALCULATED" && bridge.minimumNetContribution !== null && bridge.revenue > 0 && engine.marginGate !== "BELOW_THRESHOLD") {
    const thresholdBps = Math.round((bridge.minimumNetContribution / bridge.revenue) * 10000);
    add("margin-below-threshold", (o) => { o.margin = { ...o.margin, thresholdBps, bps: thresholdBps - 1 }; });
  }
  return scenarios;
}

// Presentation-only headroom: how far net contribution sits from the owner's
// reference minimum. It is not a gate and carries no approval meaning.
function economicsHeadroom(opp) {
  const bridge = buildEconomicsBridge(opp.economics);
  if (bridge.calculationStatus !== "CALCULATED" || bridge.minimumNetContribution === null) return null;
  return {
    currency: opp.economics?.currency ?? null,
    net: bridge.expectedNetContribution,
    minimum: bridge.minimumNetContribution,
    gap: bridge.gap,
    gapPctOfRevenue: bridge.revenue > 0 ? (bridge.gap / bridge.revenue) * 100 : null,
    gapPctOfNet: bridge.expectedNetContribution > 0 ? (bridge.gap / bridge.expectedNetContribution) * 100 : null,
    gateActive: Boolean(opp.margin && Number.isFinite(opp.margin.thresholdBps)),
  };
}

export function buildFlipMap(opp) {
  const engine = evaluateDecision(opp);
  const terminal = terminalGates(engine);
  const blocked = terminal.length > 0;
  return {
    current: engine.recommended,
    terminal,
    route: blocked
      ? { steps: [], finalState: engine.recommended, reachedPursueNow: false, stoppedBecause: "terminal" }
      : upsideRoute(opp, engine),
    singles: blocked ? [] : singleEffects(opp, engine),
    adverse: adverseScenarios(opp, engine),
    economics: economicsHeadroom(opp),
  };
}
