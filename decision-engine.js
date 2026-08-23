// decision-engine.js — pure, deterministic decision-support rules + payment math.
// No external calls. No persistence. The engine RECOMMENDS states; it never
// contacts, negotiates, quotes, commits, approves, or rejects anything.

export const DECISION_STATES = ["PURSUE_NOW", "PURSUE_CONDITIONALLY", "HOLD_FOR_EVIDENCE", "ESCALATE", "DO_NOT_PURSUE"];

export const PAYMENT_DISCLOSURE =
  "Payment exposure = committed payment events only. Not cash balance, liquidity, affordability, cash shortfall, or credit capacity. Concentration = payment commitments only.";

// ---------------------------------------------------------------------------
// Small pure helper: dedupe while preserving first-occurrence order.
// No text rewriting. Used by the UI for the "Next evidence needed" list.
// ---------------------------------------------------------------------------
export function dedupePreserveOrder(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deterministic payment exposure — only from COMPLETE events (hard rule 5).
// S11 fix: duplicate complete events (same label+amountCny+daysFromSign) are
// de-duplicated, first occurrence preserved — duplicates must not silently
// inflate committed exposure. dedupedCount reports how many were dropped.
// ---------------------------------------------------------------------------
export function paymentExposure(events, opts = {}) {
  const windowDays = opts.windowDays ?? 7;
  const raw = events || [];
  const complete = [];
  const seen = new Set();
  for (const e of raw) {
    if (e.status === "COMPLETE" && Number.isFinite(e.amountCny) && Number.isFinite(e.daysFromSign)) {
      const key = `${e.label ?? ""}|${e.amountCny}|${e.daysFromSign}`;
      if (!seen.has(key)) {
        seen.add(key);
        complete.push(e);
      }
    }
  }
  const incomplete = raw.filter((e) => e.status !== "COMPLETE" || !Number.isFinite(e.amountCny) || !Number.isFinite(e.daysFromSign));
  const completeInputs = raw.filter((e) => e.status === "COMPLETE" && Number.isFinite(e.amountCny) && Number.isFinite(e.daysFromSign));
  const dedupedCount = completeInputs.length - complete.length;

  if (complete.length === 0) {
    return {
      computed: false,
      reason: "UNKNOWN — no complete payment-event inputs; exposure is NOT calculated.",
      incompleteCount: incomplete.length,
      dedupedCount,
    };
  }

  const total = complete.reduce((a, e) => a + e.amountCny, 0);
  // Deterministic 7-day rolling peak across the event schedule (day 0..max).
  const maxDay = Math.max(...complete.map((e) => e.daysFromSign));
  let peak = 0;
  for (let d = 0; d <= maxDay; d++) {
    const window = complete.filter((e) => e.daysFromSign >= d && e.daysFromSign < d + windowDays);
    const sum = window.reduce((a, e) => a + e.amountCny, 0);
    if (sum > peak) peak = sum;
  }
  const byEvent = complete.map((e) => ({
    label: e.label,
    amountCny: e.amountCny,
    daysFromSign: e.daysFromSign,
    share: total > 0 ? e.amountCny / total : 0,
  }));
  return {
    computed: true,
    totalCommittedCny: total,
    peakWindowCny: peak,
    windowDays,
    byEvent,
    incompleteCount: incomplete.length,
    incompleteLabels: incomplete.map((e) => e.label),
    dedupedCount,
  };
}

// ---------------------------------------------------------------------------
// Decision rules — deterministic guards; no opaque overall score is produced.
// The recommendation consults POSITIVE evidence dimensions (Buyer Fit,
// Evidence Quality) plus conservative gates. No weights anywhere.
// ---------------------------------------------------------------------------
export function evaluateDecision(opp) {
  const d = opp.dimensions;
  const categoryFit = String(d.categoryFit.value || "").toUpperCase();
  const buyerFit = String(d.buyerFit.value || "").toUpperCase();
  const evidenceQuality = String(d.evidenceQuality.value || "").toUpperCase();
  const materialContradictions = (opp.contradictions || []).filter((c) => c.material && c.status === "UNRESOLVED");
  const quoteBasesComparable = Boolean(opp.quoteBasesComparable);
  const termsIncomplete = (opp.commercialTerms && opp.commercialTerms.status === "INCOMPLETE") || false;
  const blockingUnknowns = (opp.unknowns || []).filter((u) => u.blocksPursue === true);

  // S10 fix: fail closed on invalid enum values. A value outside the accepted
  // vocabulary (HIGH/STRONG/MEDIUM/LOW/WEAK/UNKNOWN/NONE/IRRELEVANT, or empty)
  // is NOT silently treated as a meaningful level — it is surfaced and the
  // recommendation falls into the UNKNOWN/evidence-required path.
  const VALID_DIM_VALUES = new Set(["HIGH", "STRONG", "MEDIUM", "LOW", "WEAK", "UNKNOWN", "NONE", "IRRELEVANT"]);
  const invalidDimensions = [];
  if (!VALID_DIM_VALUES.has(categoryFit)) invalidDimensions.push("categoryFit");
  if (!VALID_DIM_VALUES.has(buyerFit)) invalidDimensions.push("buyerFit");
  if (!VALID_DIM_VALUES.has(evidenceQuality)) invalidDimensions.push("evidenceQuality");
  const hasInvalidDim = invalidDimensions.length > 0;

  const strongBuyerFit = ["HIGH", "STRONG"].includes(buyerFit);
  const strongEvidence = ["HIGH", "STRONG"].includes(evidenceQuality);
  const weakEvidence = ["LOW", "WEAK"].includes(evidenceQuality);
  const evidenceMissing = !evidenceQuality || evidenceQuality === "UNKNOWN";

  const reasons = [];

  // S10 — invalid enum surfaced, not silently consumed.
  if (hasInvalidDim) {
    reasons.push(`Rule: Invalid dimension value in ${invalidDimensions.join(", ")} — value is not in the accepted vocabulary; treated as UNKNOWN; evidence-required path is recommended.`);
  }

  // Hard rule 1 — weak/irrelevant Category Fit can never produce PURSUE_NOW.
  const categoryWeak = ["WEAK", "LOW", "IRRELEVANT", "NONE"].includes(categoryFit);
  if (categoryWeak) {
    reasons.push("Rule 1: Weak/irrelevant Category Fit — PURSUE_NOW is not available.");
  }

  // Hard rule 2 — material contradiction must surface and may require ESCALATE.
  if (materialContradictions.length > 0) {
    reasons.push(
      `Rule 2: Material contradiction (${materialContradictions.map((c) => c.id).join(", ")}) is unresolved — it is surfaced visibly; PURSUE_NOW is not available; ESCALATE is recommended.`,
    );
  }

  // Hard rule 3 — missing commercial terms remain UNKNOWN → HOLD_FOR_EVIDENCE candidate.
  if (termsIncomplete) {
    reasons.push("Rule 3: Commercial terms are incomplete — missing items remain UNKNOWN; HOLD_FOR_EVIDENCE is available.");
  }

  // Hard rule 4 — non-comparable quote bases must NOT be ranked.
  if (!quoteBasesComparable) {
    reasons.push("Rule 4: Quote bases are not comparable — quotes are NOT ranked.");
  }

  // Hard rule 5 — exposure only from complete payment-event inputs.
  const exposure = paymentExposure(opp.paymentEvents);
  if (!exposure.computed) {
    reasons.push("Rule 5: Payment exposure is UNKNOWN — no complete payment-event inputs.");
  }

  // Positive evidence — evidence-first: strong evidence may support pursuit,
  // LOW/UNKNOWN evidence quality prefers HOLD_FOR_EVIDENCE. No weighting.
  if (weakEvidence || evidenceMissing) {
    reasons.push("Rule: Evidence Quality is LOW or UNKNOWN — strong pursuit is not recommended; HOLD_FOR_EVIDENCE is preferred.");
  } else if (!strongEvidence) {
    reasons.push("Rule: Evidence Quality is not strong — only a conditional pursue is considered.");
  }
  if (blockingUnknowns.length > 0) {
    reasons.push(`Rule: Blocking UNKNOWN remains (${blockingUnknowns.map((u) => u.id).join(", ")}) — PURSUE_NOW requires no blocking UNKNOWN.`);
  }
  if (strongBuyerFit && strongEvidence && materialContradictions.length === 0 && !termsIncomplete && exposure.computed && blockingUnknowns.length === 0 && !categoryWeak) {
    reasons.push("Positive evidence supports pursuit: Buyer Fit strong + Evidence Quality strong and all gates are clear — PURSUE_NOW is available.");
  }

  // Deterministic recommendation (pure decision-support state).
  let recommended = "HOLD_FOR_EVIDENCE";
  if (hasInvalidDim) {
    recommended = "HOLD_FOR_EVIDENCE"; // S10: invalid input → evidence-required path, never a valid commercial recommendation
  } else if (categoryWeak) {
    recommended = "DO_NOT_PURSUE"; // rule 1
  } else if (materialContradictions.length > 0) {
    recommended = "ESCALATE"; // rule 2
  } else if (weakEvidence || evidenceMissing) {
    recommended = "HOLD_FOR_EVIDENCE"; // weak/unknown evidence → HOLD
  } else if (termsIncomplete) {
    recommended = "HOLD_FOR_EVIDENCE"; // rule 3
  } else if (!exposure.computed) {
    recommended = "HOLD_FOR_EVIDENCE"; // rule 5
  } else if (blockingUnknowns.length > 0) {
    recommended = "HOLD_FOR_EVIDENCE"; // blocking UNKNOWN remains
  } else if (strongBuyerFit && strongEvidence) {
    recommended = "PURSUE_NOW"; // all gates clear + strong positive evidence
  } else {
    recommended = "PURSUE_CONDITIONALLY";
  }

  // State availability under the hard rules (what the human may select).
  const available = {
    PURSUE_NOW:
      !hasInvalidDim &&
      !categoryWeak &&
      materialContradictions.length === 0 &&
      !termsIncomplete &&
      exposure.computed &&
      blockingUnknowns.length === 0 &&
      strongBuyerFit &&
      strongEvidence &&
      !weakEvidence &&
      !evidenceMissing,
    PURSUE_CONDITIONALLY: !hasInvalidDim && !categoryWeak && !weakEvidence && !evidenceMissing,
    HOLD_FOR_EVIDENCE: true,
    ESCALATE: true,
    DO_NOT_PURSUE: true,
  };

  return { recommended, available, reasons, categoryWeak, materialContradictions, termsIncomplete, quoteBasesComparable, exposure, blockingUnknowns, strongBuyerFit, strongEvidence, invalidDimensions };
}

// ---------------------------------------------------------------------------
// Decision brief — assembled locally, never persisted.
// ---------------------------------------------------------------------------
export function buildBrief(opp, humanDecision, engine) {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    opportunityId: opp.id,
    opportunityName: opp.name,
    humanDecision,
    engineRecommended: engine.recommended,
    reasons: engine.reasons,
    exposure: engine.exposure,
    unknowns: opp.unknowns.map((u) => ({ id: u.id, label: u.label })),
    contradictions: opp.contradictions.map((c) => ({ id: c.id, label: c.label, material: c.material, status: c.status })),
    boundaryNote: "This brief supports a human decision. It does not approve, reject, quote, or commit. Human approval is always required before any external action.",
    synthetic: opp.synthetic === true, // explicit data flag, never inferred from id
  };
}
