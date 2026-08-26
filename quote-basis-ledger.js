// quote-basis-ledger.js — Quote Basis Ledger (workbench series block 3).
// Turns a set of quotes into an auditable comparison table WITHOUT ranking
// incomparable bases (Rule 4 discipline). Pure deterministic presentation:
// it classifies each quote's Incoterm/basis, flags whether the set is
// comparable, and never makes a price decision. Never enters evaluateDecision().
//
// Incoterm responsibility map (presentation aid, not legal advice):
// which party bears freight / insurance / duties for the typical term.
export const INCOTERM_RESPONSIBILITY = {
  EXW: { freight: "BUYER", insurance: "BUYER", duties: "BUYER", note: "Ex works — buyer collects at seller's premises." },
  FOB: { freight: "BUYER", insurance: "BUYER", duties: "BUYER", note: "Free on board — seller to the named port, buyer from there." },
  CFR: { freight: "SELLER", insurance: "BUYER", duties: "BUYER", note: "Cost & freight — seller pays freight, buyer insures." },
  CIF: { freight: "SELLER", insurance: "SELLER", duties: "BUYER", note: "Cost, insurance & freight — seller to the named port incl. insurance." },
  DAP: { freight: "SELLER", insurance: "SELLER", duties: "BUYER", note: "Delivered at place — seller bears all transport to destination." },
  DDP: { freight: "SELLER", insurance: "SELLER", duties: "SELLER", note: "Delivered duty paid — seller bears everything incl. import duties." },
};

const clean = (v) => String(v ?? "").trim();
const UNKNOWN = "UNKNOWN";

// Normalize one quote row. All fields optional; blanks stay UNKNOWN.
export function normalizeQuote(input = {}) {
  const incoterm = clean(input.incoterm).toUpperCase();
  const basis = clean(input.basis) || (incoterm ? incoterm : UNKNOWN);
  const currency = clean(input.currency).toUpperCase() || UNKNOWN;
  const amount = input.amount === "" || input.amount === null || input.amount === undefined ? null : Number(input.amount);
  return {
    id: clean(input.id) || UNKNOWN,
    label: clean(input.label) || basis,
    basis,
    incoterm: incoterm || UNKNOWN,
    currency,
    amount: Number.isFinite(amount) ? amount : null,
    validUntil: clean(input.validUntil) || UNKNOWN,
    note: clean(input.note) || UNKNOWN,
    responsibility: INCOTERM_RESPONSIBILITY[incoterm] || null,
  };
}

// Comparability of a set: same basis AND same currency for every quote.
// Different bases -> NOT_COMPARABLE (Rule 4: never force-rank).
export function compareQuotes(quotes = []) {
  const list = quotes.filter((q) => q && q.label).map(normalizeQuote);
  const distinctBases = new Set(list.map((q) => q.basis));
  const distinctCurrencies = new Set(list.map((q) => q.currency));
  const allComplete = list.length > 0 && list.every((q) => q.amount !== null && q.incoterm !== UNKNOWN && q.currency !== UNKNOWN);
  const comparable = allComplete && distinctBases.size === 1 && distinctCurrencies.size === 1;
  const reasons = [];
  if (list.length === 0) reasons.push("NO_QUOTES");
  if (distinctBases.size > 1) reasons.push("MIXED_BASES");
  if (distinctCurrencies.size > 1) reasons.push("MIXED_CURRENCIES");
  if (!allComplete) reasons.push("INCOMPLETE_ENTRIES");
  return {
    quotes: list,
    count: list.length,
    comparable,
    distinctBases: [...distinctBases],
    distinctCurrencies: [...distinctCurrencies],
    reasons,
  };
}

// Sorted view ONLY when comparable; otherwise amounts are shown unsorted with
// a NOT_RANKED flag. Never ranks incomparable quotes. Stable ids: each quote
// gets Q-<index> when the caller didn't supply one (deterministic, no random).
export function quoteLedger(input = {}) {
  const quotes = (input.quotes || []).map((q, i) =>
    normalizeQuote({ ...(q || {}), id: (q && q.id) || `Q-${i + 1}` })
  );
  const cmp = compareQuotes(quotes);
  const sorted = cmp.comparable
    ? [...cmp.quotes].sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity))
    : cmp.quotes;
  return {
    ...cmp,
    sorted: cmp.comparable ? sorted : null,
    notRanked: !cmp.comparable,
  };
}
