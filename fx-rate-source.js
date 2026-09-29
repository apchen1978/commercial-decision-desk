// fx-rate-source.js — optional, user-initiated reference exchange rate.
//
// This is the ONLY module in the workbench that makes a network request, and it
// runs only when the user presses "Fetch reference rate". It sends nothing but a
// currency pair in the URL: no opportunity data, no identifiers. The result is a
// dated input (rate, date, source) that is shown to the user; the decision
// engine never calls it and never sees a live value on its own, so a recorded
// assessment stays reproducible from its declared inputs.
//
// Fails closed: an unsupported currency, a timeout, a bad status or an implausible
// payload returns { ok: false } with the reasons and changes nothing.

const CODE = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const plausible = (rate) => typeof rate === "number" && Number.isFinite(rate) && rate > 0.00001 && rate < 1e7;

// `quote` is the base currency, `cost` the other one: rate = units of `cost` per 1 `quote`.
export const PROVIDERS = [
  {
    id: "frankfurter",
    name: "European Central Bank reference rate (Frankfurter)",
    attribution: "https://frankfurter.dev",
    url: (quote, cost) => `https://api.frankfurter.dev/v1/latest?base=${quote}&symbols=${cost}`,
    read: (json, cost) => ({ rate: json?.rates?.[cost], asOf: json?.date }),
  },
  {
    id: "er-api",
    name: "Exchange Rate API (open.er-api.com)",
    attribution: "https://www.exchangerate-api.com",
    url: (quote) => `https://open.er-api.com/v6/latest/${quote}`,
    read: (json, cost) => {
      const stamp = typeof json?.time_last_update_unix === "number" ? new Date(json.time_last_update_unix * 1000).toISOString().slice(0, 10) : undefined;
      return { rate: json?.result === "success" ? json?.rates?.[cost] : undefined, asOf: stamp };
    },
  },
];

async function readWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchReferenceRate({ quote, cost, fetchImpl = globalThis.fetch, providers = PROVIDERS, timeoutMs = 6000 } = {}) {
  if (!CODE.test(quote ?? "") || !CODE.test(cost ?? "")) return { ok: false, reason: "INVALID_CURRENCY", attempts: [] };
  if (quote === cost) return { ok: false, reason: "SAME_CURRENCY", attempts: [] };
  if (typeof fetchImpl !== "function") return { ok: false, reason: "NO_FETCH", attempts: [] };
  const attempts = [];
  for (const provider of providers) {
    try {
      const json = await readWithTimeout(fetchImpl, provider.url(quote, cost), timeoutMs);
      const { rate, asOf } = provider.read(json, cost);
      if (!plausible(rate)) { attempts.push({ provider: provider.id, error: "RATE_UNAVAILABLE" }); continue; }
      if (!DATE.test(asOf ?? "")) { attempts.push({ provider: provider.id, error: "DATE_UNAVAILABLE" }); continue; }
      return { ok: true, rate, asOf, source: provider.name, providerId: provider.id, attribution: provider.attribution, attempts };
    } catch (error) {
      attempts.push({ provider: provider.id, error: error?.name === "AbortError" ? "TIMEOUT" : String(error?.message ?? error) });
    }
  }
  return { ok: false, reason: "ALL_PROVIDERS_FAILED", attempts };
}

// Abuse guard for the button: results are cached in memory (never persisted) and
// network requests are spaced out, so repeated clicks cannot hammer the free
// providers on a visitor's behalf. The clock is injectable for tests.
export function createReferenceRateFetcher({ ttlMs = 10 * 60 * 1000, cooldownMs = 5000, now = () => Date.now(), ...defaults } = {}) {
  const cache = new Map();
  let lastRequestAt = -Infinity;
  return async function fetchWithGuard({ quote, cost, ...rest } = {}) {
    const key = `${quote}/${cost}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return { ...hit.result, cached: true };
    const wait = cooldownMs - (now() - lastRequestAt);
    if (wait > 0) return { ok: false, reason: "COOLDOWN", retryInMs: wait, attempts: [] };
    lastRequestAt = now();
    const result = await fetchReferenceRate({ quote, cost, ...defaults, ...rest });
    if (result.ok) cache.set(key, { at: now(), result });
    return result;
  };
}

export const fetchReferenceRateGuarded = createReferenceRateFetcher();
