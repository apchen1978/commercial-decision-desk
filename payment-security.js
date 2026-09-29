// payment-security.js — how well is an open (post-delivery) receivable secured?
//
// Covers documentary letters of credit and export-credit insurance. Pure and
// deterministic; no network, no persistence. It does not change the decision
// engine: the only way it reaches evaluateDecision() is by registering an
// UNKNOWN through withDerivedUnknowns(), the documented caller discipline
// ("register it as a blocking UNKNOWN; the engine returns HOLD_FOR_EVIDENCE").
//
// The engine invents no thresholds, so neither does this module: a receivable is
// "covered in full" only when a declared instrument says so. Insurance and an
// L/C over the same receivable are not added together; the larger coverage is
// used, which is the conservative reading.

import { buildEconomicsBridge } from "./economics-bridge.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const pct = (v) => (finite(v) && v >= 0 && v <= 100 ? v : null);

export const INSTRUMENT_STATUS = ["UNKNOWN", "NOT_USED", "REQUESTED", "IN_PLACE"];
export const SECURITY_UNKNOWN_ID = "UNK-SEC";

function instrumentCoverage(instrument, needsConfirmation = false) {
  const status = INSTRUMENT_STATUS.includes(instrument?.status) ? instrument.status : "UNKNOWN";
  if (status !== "IN_PLACE") return { status, coverage: 0, incomplete: false };
  const coverage = pct(instrument.coveragePct);
  const confirmedOk = !needsConfirmation || instrument.confirmed === "YES";
  return { status, coverage: coverage === null || !confirmedOk ? 0 : coverage, incomplete: coverage === null, unconfirmed: needsConfirmation && !confirmedOk };
}

export function assessPaymentSecurity(opp) {
  const security = opp.paymentSecurity ?? {};
  const revenue = buildEconomicsBridge(opp.economics).revenue; // form input arrives as strings; the bridge normalises it
  const advance = pct(security.advancePct);
  const lc = instrumentCoverage(security.lc, true);
  const insurance = instrumentCoverage(security.insurance, false);
  const currency = opp.economics?.currency ?? null;

  const exposureBasis = finite(revenue) ? revenue : null;
  const openShare = advance === null ? 100 : 100 - advance;
  const exposure = exposureBasis === null ? null : (exposureBasis * openShare) / 100;
  const securedShare = Math.max(lc.coverage, insurance.coverage);
  const secured = exposure === null ? null : (exposure * securedShare) / 100;
  const residual = exposure === null ? null : exposure - secured;

  const costs = [
    { id: "lc", pct: pct(security.lc?.feePct), inPlace: lc.status === "IN_PLACE" },
    { id: "insurance", pct: pct(security.insurance?.premiumPct), inPlace: insurance.status === "IN_PLACE" },
  ].filter((c) => c.inPlace).map((c) => ({ id: c.id, pct: c.pct, amount: c.pct === null || exposureBasis === null ? null : (exposureBasis * c.pct) / 100 }));

  let state;
  if (exposure === 0) state = "NO_OPEN_RISK";
  else if (security.ownerAcceptsUnsecured === true) state = "OWNER_ACCEPTED";
  else if (lc.incomplete || insurance.incomplete || lc.unconfirmed) state = "INCOMPLETE";
  else if (residual !== null && residual === 0 && securedShare > 0) state = "COVERED";
  else if (securedShare > 0) state = "PARTIAL";
  else if ([security.lc?.status, security.insurance?.status].every((s) => s === "NOT_USED")) state = "UNSECURED";
  else state = "UNKNOWN";

  return {
    state,
    currency,
    exposure,
    exposureKnown: advance !== null,
    advancePct: advance,
    securedShare,
    secured,
    residual,
    lc: { status: lc.status, confirmed: security.lc?.confirmed ?? "UNKNOWN", coveragePct: pct(security.lc?.coveragePct), unconfirmed: Boolean(lc.unconfirmed) },
    insurance: { status: insurance.status, coveragePct: pct(security.insurance?.coveragePct) },
    costs,
    needsAttention: !["NO_OPEN_RISK", "OWNER_ACCEPTED", "COVERED"].includes(state),
  };
}

// The UNKNOWN the engine reads. It blocks PURSUE_NOW until the receivable is
// covered, the exposure disappears, or the owner explicitly accepts the risk.
export function paymentSecurityUnknown(opp) {
  const a = assessPaymentSecurity(opp);
  if (!a.needsAttention || !opp.paymentSecurity) return null;
  return {
    id: SECURITY_UNKNOWN_ID,
    label: "Payment security for the open receivable",
    detail: `An open receivable of up to ${a.exposure === null ? "an unknown amount" : `${a.currency ?? ""} ${Math.round(a.exposure).toLocaleString("en-US")}`.trim()} is not yet covered by a letter of credit, credit insurance, an advance, or the owner's acceptance of the residual risk.`,
    blocksPursue: true,
    resolveWith: "Confirmed L/C or credit-insurance limit in place for this buyer, an advance that covers the exposure, or the owner's written acceptance of the residual risk",
  };
}
