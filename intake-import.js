// CDD Intake Proposal Import v0.1.
// Trust boundary: proposal -> preview -> per-signal human confirmation.
// This module never evaluates a decision, registers contradictions, or creates
// a recommendation. Unsupported source values remain PROPOSED_UNMAPPED.

const SIGNALS = ["BUYER_FIT", "CATEGORY_FIT", "IMPORT_OPENNESS"];
const FORBIDDEN = ["recommendation", "momentum", "coverage", "probability", "priorityScore", "humanDecision", "commercialOutcome"];
const MAPPED_VALUES = {
  BUYER_FIT: { HIGH: "strong", STRONG: "strong", MEDIUM: "some", PARTIAL: "some", LOW: "weak", WEAK: "weak", UNKNOWN: "unknown" },
  CATEGORY_FIT: { HIGH: "strong", STRONG: "strong", MEDIUM: "partial", PARTIAL: "partial", LOW: "weak", WEAK: "weak", UNKNOWN: "unknown" },
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const nonBlank = (value) => typeof value === "string" && value.trim().length > 0;

function hasForbiddenDeep(value, path = "proposal") {
  if (!isObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.includes(key)) return `${path}.${key}`;
    const nested = hasForbiddenDeep(child, `${path}.${key}`);
    if (nested) return nested;
  }
  return null;
}

export function validateImportProposal(proposal) {
  const errors = [];
  if (!isObject(proposal)) return { valid: false, errors: ["proposal must be an object"] };
  if (proposal.kind !== "cdd-intake-proposal") errors.push("unsupported proposal kind");
  if (proposal.schemaVersion !== 1) errors.push("unsupported proposal schemaVersion");
  if (proposal.sourceSystem !== "overseas-lead-discovery") errors.push("unsupported sourceSystem");
  if (!nonBlank(proposal.sourceRecordId)) errors.push("sourceRecordId is required");
  const d = proposal.sourceDisclosure;
  if (!isObject(d) || d.classification !== "REPRESENTATIVE_ANONYMIZED" || d.anonymized !== true || d.syntheticElements !== true || d.realProspectIdentitiesExposed !== false || !nonBlank(d.note)) {
    errors.push("sourceDisclosure truth boundary is invalid");
  }
  if (hasForbiddenDeep(proposal)) errors.push(`forbidden field path detected: ${hasForbiddenDeep(proposal)}`);
  const op = proposal.opportunityProposal;
  if (!isObject(op) || !isObject(op.buyer) || !nonBlank(op.buyer.name) || !isObject(op.market) || !nonBlank(op.market.category)) errors.push("opportunityProposal context is incomplete");
  if (isObject(op) && ("entryBarrier" in op || "asiaSourcing" in op)) errors.push("source-only field leaked into opportunityProposal");
  if (!Array.isArray(proposal.proposedSignals) || proposal.proposedSignals.length !== SIGNALS.length) errors.push("proposedSignals must contain the allowed signal set");
  else {
    const seen = new Set();
    for (const signal of proposal.proposedSignals) {
      if (!isObject(signal) || !SIGNALS.includes(signal.signal)) errors.push("unknown proposed signal");
      else {
        seen.add(signal.signal);
        if (!nonBlank(signal.value)) errors.push(`signal ${signal.signal} has no value`);
        if ("rationale" in signal || "sourceRefs" in signal) errors.push(`signal ${signal.signal} contains unsupported per-signal provenance`);
      }
    }
    if (seen.size !== SIGNALS.length) errors.push("proposedSignals must cover BUYER_FIT, CATEGORY_FIT, IMPORT_OPENNESS");
  }
  if (!Array.isArray(proposal.unknowns) || !Array.isArray(proposal.potentialTensions)) errors.push("unknowns and potentialTensions must be arrays");
  for (const tension of proposal.potentialTensions || []) if (!isObject(tension) || tension.notCanonicalContradiction !== true) errors.push("potentialTension must remain non-canonical");
  if (proposal.humanReviewRequired !== true) errors.push("humanReviewRequired must be true");
  return { valid: errors.length === 0, errors };
}

function mapSignal(signal) {
  const value = String(signal.value || "").trim().toUpperCase();
  const inputField = signal.signal === "BUYER_FIT" ? "buyerFit" : signal.signal === "CATEGORY_FIT" ? "categoryFit" : null;
  const inputValue = inputField ? MAPPED_VALUES[signal.signal]?.[value] : null;
  return {
    signal: signal.signal,
    sourceField: signal.sourceField,
    originalValue: value || "UNKNOWN",
    inputField,
    inputValue,
    mappingStatus: value === "UNKNOWN" ? "UNKNOWN" : inputValue ? "MAPPED" : "PROPOSED_UNMAPPED",
    reviewState: "PROPOSED",
  };
}

export function createImportPreview(proposal) {
  const validation = validateImportProposal(proposal);
  if (!validation.valid) return { valid: false, errors: validation.errors, audit: [{ event: "import_blocked" }] };
  return {
    valid: true,
    proposalId: `${proposal.sourceSystem}:${proposal.sourceRecordId}:${proposal.generatedAt}`,
    sourceRecordId: proposal.sourceRecordId,
    generatedAt: proposal.generatedAt,
    sourceDisclosure: proposal.sourceDisclosure,
    context: {
      buyerName: proposal.opportunityProposal.buyer.name,
      buyerType: proposal.opportunityProposal.buyer.type || "UNKNOWN",
      marketCategory: proposal.opportunityProposal.market.category,
      sourceTiers: [...proposal.opportunityProposal.sourceTiers],
      rationale: [...proposal.opportunityProposal.rationale],
      confirmed: false,
    },
    unknowns: [...proposal.unknowns],
    potentialTensions: proposal.potentialTensions.map((tension) => ({ ...tension, reviewState: "PROPOSED" })),
    signals: proposal.proposedSignals.map(mapSignal),
    audit: [
      { event: "preview_created", proposalId: `${proposal.sourceSystem}:${proposal.sourceRecordId}:${proposal.generatedAt}` },
      ...proposal.proposedSignals.filter((signal) => mapSignal(signal).mappingStatus === "PROPOSED_UNMAPPED").map((signal) => ({ event: "signal_unmapped", signal: signal.signal, proposalId: `${proposal.sourceSystem}:${proposal.sourceRecordId}:${proposal.generatedAt}` })),
    ],
  };
}

export function reviewImportSignal(preview, signalName, action) {
  if (!preview?.valid) return preview;
  if (!["CONFIRMED", "PROPOSED", "REJECTED"].includes(action)) throw new Error("invalid signal review action");
  const signals = preview.signals.map((signal) => {
    if (signal.signal !== signalName) return signal;
    if (action === "CONFIRMED" && signal.mappingStatus !== "MAPPED") throw new Error(`${signalName} is not safely mapped`);
    return { ...signal, reviewState: action };
  });
  return { ...preview, signals, audit: [...preview.audit, { event: action === "CONFIRMED" ? "signal_confirmed" : action === "REJECTED" ? "signal_rejected" : "signal_kept_proposed", signal: signalName, proposalId: preview.proposalId }] };
}

export function confirmImportContext(preview, confirmed = true) {
  return { ...preview, context: { ...preview.context, confirmed: confirmed === true } };
}

export function buildConfirmedInput(preview) {
  if (!preview?.valid) return { input: null, errors: ["invalid preview"] };
  const input = {};
  if (preview.context.confirmed) {
    input.name = preview.context.buyerName;
    input.note = `Imported proposal ${preview.proposalId}; source evidence remains human-confirmed proposal context.`;
  }
  for (const signal of preview.signals) {
    if (signal.reviewState === "CONFIRMED" && signal.mappingStatus === "MAPPED") input[signal.inputField] = signal.inputValue;
  }
  return { input, errors: [] };
}
