// derived-unknowns.js — registers the payment-security and FX unknowns the engine reads.
//
// The decision engine is unchanged. Following the documented caller discipline
// ("register it as an UNKNOWN; the engine applies its existing rule"), a payment
// receivable with no cover registers a blocking UNKNOWN and an unhedged currency
// exposure registers a non-blocking one. Returns a new object; never mutates.

import { paymentSecurityUnknown } from "./payment-security.js";
import { fxUnknown } from "./fx-exposure.js";

export function withDerivedUnknowns(opp) {
  const derived = [paymentSecurityUnknown(opp), fxUnknown(opp)].filter(Boolean);
  const existing = new Set((opp.unknowns || []).map((u) => u.id));
  const added = derived.filter((u) => !existing.has(u.id));
  if (!added.length) return opp;
  return { ...opp, unknowns: [...(opp.unknowns || []), ...added] };
}
