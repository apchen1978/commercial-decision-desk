// fx-exposure.js — currency exposure of the cost side against the quote currency.
//
// Pure and deterministic. It makes no network request itself. The rate that
// matters is the one declared at quote or hedge time, with a date and a source.
// A live reference rate can be supplied by the caller (see fx-rate-source.js,
// which the user triggers with a button) and is compared against the declared
// rate; it never replaces it silently, so a recorded assessment stays
// reproducible from its inputs. Age is judged against a `today` the caller
// passes in.
//
// It never gates the engine. The exposure is visible and can register a
// non-blocking UNKNOWN; whether a given move is tolerable is the owner's call.

import { buildEconomicsBridge } from "./economics-bridge.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const pct = (v) => (finite(v) && v >= 0 && v <= 100 ? v : null);

export const FX_UNKNOWN_ID = "UNK-FX";
export const FX_MOVES_PCT = [3, 5, 10];
export const HEDGES = ["UNKNOWN", "NONE", "NATURAL", "FORWARD"];
export const DEFAULT_MAX_RATE_AGE_DAYS = 7;

const DAY_MS = 86400000;
function ageInDays(asOf, today) {
  if (!asOf || !today) return null;
  const from = Date.parse(`${asOf}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  return Number.isNaN(from) || Number.isNaN(to) ? null : Math.round((to - from) / DAY_MS);
}

export function assessFx(opp, { today = null, maxRateAgeDays = DEFAULT_MAX_RATE_AGE_DAYS, reference = null } = {}) {
  const fx = opp.fx;
  const economics = opp.economics ?? {};
  const bridge = buildEconomicsBridge(economics); // form input arrives as strings; the bridge normalises it
  if (!fx) return { state: "NOT_ASSESSED" };
  const quote = fx.quoteCurrency ?? economics.currency ?? null;
  const sameCurrency = quote !== null && fx.costCurrency === quote;
  const share = pct(fx.costSharePct);
  const directCost = bridge.directCost;
  const hedge = HEDGES.includes(fx.hedge) ? fx.hedge : "UNKNOWN";
  const hedgedPct = hedge === "NONE" ? 0 : pct(fx.hedgedPct);
  const rate = finite(fx.rate) && fx.rate > 0 ? fx.rate : null;
  const age = ageInDays(fx.asOf, today);
  const rateInfo = {
    rate,
    asOf: fx.asOf ?? null,
    source: fx.source ?? null,
    ageDays: age,
    dateKnown: age !== null,
    stale: age !== null && age > maxRateAgeDays,
  };

  if (sameCurrency || share === 0) return { state: "NO_EXPOSURE", quote, costCurrency: fx.costCurrency ?? null, rateInfo };
  if (share === null || directCost === null) return { state: "UNKNOWN", quote, costCurrency: fx.costCurrency ?? null, hedge, rateInfo };

  const exposed = (directCost * share) / 100;
  const hedgeKnown = hedgedPct !== null && hedge !== "UNKNOWN";
  const unhedged = hedgeKnown ? exposed * (1 - hedgedPct / 100) : exposed;
  const headroom = bridge.gap; // net contribution minus the owner's reference minimum; null unless both are known
  const moves = FX_MOVES_PCT.map((p) => {
    const impact = (unhedged * p) / 100;
    return { pct: p, impact, headroomUsedPct: headroom !== null && headroom > 0 ? (impact / headroom) * 100 : null };
  });
  const state = hedgeKnown && unhedged === 0 ? "HEDGED" : hedgeKnown && hedgedPct > 0 ? "PARTLY_HEDGED" : "OPEN";
  // Declared vs reference rate. Cost is fixed in the cost currency at the declared
  // rate; if the reference rate is lower, the same cost is worth more in the quote
  // currency (the cost currency has strengthened).
  let referenceShift = null;
  if (reference && finite(reference.rate) && reference.rate > 0 && rate !== null) {
    const changePct = (rate / reference.rate - 1) * 100;
    const impact = (unhedged * changePct) / 100;
    referenceShift = {
      referenceRate: reference.rate,
      asOf: reference.asOf ?? null,
      source: reference.source ?? null,
      declaredRate: rate,
      changePct,
      impact,
      headroomUsedPct: headroom !== null && headroom > 0 ? (impact / headroom) * 100 : null,
      exceedsHeadroom: headroom !== null && impact > headroom,
    };
  }
  return {
    state,
    quote,
    costCurrency: fx.costCurrency ?? null,
    costSharePct: share,
    hedge,
    hedgedPct: hedgeKnown ? hedgedPct : null,
    exposed,
    unhedged,
    headroom,
    breakEvenMovePct: headroom !== null && unhedged > 0 ? (headroom / unhedged) * 100 : null,
    moves,
    rateInfo,
    referenceShift,
    needsAttention: state === "OPEN" || state === "PARTLY_HEDGED",
    hedgeUnknown: !hedgeKnown,
  };
}

// Non-blocking: currency risk is a margin risk the owner should see, not a veto.
export function fxUnknown(opp, options) {
  const a = assessFx(opp, options);
  if (!a.needsAttention) return null;
  return {
    id: FX_UNKNOWN_ID,
    label: "Currency exposure on cost",
    detail: `${Math.round(a.unhedged).toLocaleString("en-US")} ${a.quote ?? ""} of cost is paid in ${a.costCurrency ?? "another currency"} with no confirmed hedge. ${a.breakEvenMovePct === null ? "" : `A ${a.breakEvenMovePct.toFixed(1)}% move would use up the headroom above the owner's minimum.`}`.trim(),
    blocksPursue: false,
    resolveWith: "A dated rate with its source, the share of cost in that currency, and a hedge (forward or natural) or the owner's acceptance of the open position",
  };
}
