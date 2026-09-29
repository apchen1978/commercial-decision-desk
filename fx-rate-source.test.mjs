// fx-rate-source.test.mjs — the network is faked; nothing here touches the internet.
import assert from "node:assert/strict";
import { PROVIDERS, createReferenceRateFetcher, fetchReferenceRate } from "./fx-rate-source.js";

let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks += 1; };

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const recorder = (handler) => { const calls = []; const fn = async (url, options) => { calls.push({ url, options }); return handler(url, options, calls.length); }; fn.calls = calls; return fn; };
const frankfurter = { amount: 1, base: "USD", date: "2026-09-28", rates: { CNY: 6.7105 } };
const erApi = { result: "success", time_last_update_unix: 1790640151, rates: { USD: 1, CNY: 6.721579, TWD: 31.811614 } };

// Input validation happens before any request.
const untouched = recorder(() => json(frankfurter));
check((await fetchReferenceRate({ quote: "usd", cost: "CNY", fetchImpl: untouched })).reason === "INVALID_CURRENCY", "lowercase code is rejected");
check((await fetchReferenceRate({ quote: "USD", cost: "CN", fetchImpl: untouched })).reason === "INVALID_CURRENCY", "short code is rejected");
check((await fetchReferenceRate({ quote: "USD", cost: "USD", fetchImpl: untouched })).reason === "SAME_CURRENCY", "same currency needs no rate");
check((await fetchReferenceRate({ quote: "USD/../x", cost: "CNY", fetchImpl: untouched })).reason === "INVALID_CURRENCY", "a path-like code is rejected");
check((await fetchReferenceRate({ quote: "USD", cost: "CNY", fetchImpl: null })).reason === "NO_FETCH", "no fetch available fails closed");
check(untouched.calls.length === 0, "no request was made for invalid input");

// Primary provider.
const ok = recorder(() => json(frankfurter));
const primary = await fetchReferenceRate({ quote: "USD", cost: "CNY", fetchImpl: ok });
check(primary.ok && primary.rate === 6.7105 && primary.asOf === "2026-09-28" && primary.providerId === "frankfurter", "the primary provider's rate and date are returned");
check(ok.calls.length === 1 && ok.calls[0].url === "https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY", "the request carries only the currency pair");
check(ok.calls[0].options.headers.Accept === "application/json" && !("body" in ok.calls[0].options) && ok.calls[0].options.method === undefined, "a plain GET with no body");

// Fallback when the primary lacks the currency (the ECB does not publish TWD).
const twd = recorder((url) => (url.includes("frankfurter") ? json({ amount: 1, base: "USD", date: "2026-09-28", rates: {} }) : json(erApi)));
const fallback = await fetchReferenceRate({ quote: "USD", cost: "TWD", fetchImpl: twd });
check(fallback.ok && fallback.providerId === "er-api" && fallback.rate === 31.811614 && fallback.asOf === "2026-09-29", "TWD falls back to the second provider and takes its date from the update time");
check(fallback.attempts.length === 1 && fallback.attempts[0].error === "RATE_UNAVAILABLE", "the missing currency is recorded as an attempt");

// Errors and implausible payloads never yield a rate.
const httpError = recorder((url) => (url.includes("frankfurter") ? json({}, 500) : json(erApi)));
check((await fetchReferenceRate({ quote: "USD", cost: "CNY", fetchImpl: httpError })).providerId === "er-api", "an HTTP error on the first provider falls through");
const allDown = recorder(() => { throw new Error("offline"); });
const down = await fetchReferenceRate({ quote: "USD", cost: "CNY", fetchImpl: allDown });
check(!down.ok && down.reason === "ALL_PROVIDERS_FAILED" && down.attempts.length === PROVIDERS.length, "all providers failing returns ok:false with every attempt");
for (const bad of [0, -1, "6.7", null, NaN, 1e9]) {
  const r = await fetchReferenceRate({ quote: "USD", cost: "CNY", fetchImpl: recorder(() => json({ ...frankfurter, rates: { CNY: bad } })), providers: [PROVIDERS[0]] });
  check(!r.ok, `rate ${String(bad)} is rejected`);
}
const badDate = await fetchReferenceRate({ quote: "USD", cost: "CNY", fetchImpl: recorder(() => json({ ...frankfurter, date: "yesterday" })), providers: [PROVIDERS[0]] });
check(!badDate.ok && badDate.attempts[0].error === "DATE_UNAVAILABLE", "a rate without a valid date is rejected");
const failedFlag = await fetchReferenceRate({ quote: "USD", cost: "CNY", fetchImpl: recorder(() => json({ ...erApi, result: "error" })), providers: [PROVIDERS[1]] });
check(!failedFlag.ok, "a provider reporting an error is rejected");

// Timeout.
const hangs = recorder((url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))));
const timedOut = await fetchReferenceRate({ quote: "USD", cost: "CNY", fetchImpl: hangs, providers: [PROVIDERS[0]], timeoutMs: 20 });
check(!timedOut.ok && timedOut.attempts[0].error === "TIMEOUT", "a hanging request times out");

// Abuse guard: in-memory cache and cooldown, with an injectable clock.
let clock = 1000;
const guardFetch = recorder(() => json(frankfurter));
const guarded = createReferenceRateFetcher({ ttlMs: 60000, cooldownMs: 5000, now: () => clock, fetchImpl: guardFetch, providers: [PROVIDERS[0]] });
const first = await guarded({ quote: "USD", cost: "CNY" });
check(first.ok && !first.cached && guardFetch.calls.length === 1, "the first click makes one request");
clock += 1000;
const second = await guarded({ quote: "USD", cost: "CNY" });
check(second.ok && second.cached === true && guardFetch.calls.length === 1, "a repeat click is served from memory");
clock += 1000;
const other = await guarded({ quote: "USD", cost: "EUR" });
check(!other.ok && other.reason === "COOLDOWN" && other.retryInMs > 0 && guardFetch.calls.length === 1, "a different pair inside the cooldown is refused without a request");
clock += 10000;
const later = await guarded({ quote: "USD", cost: "EUR" });
check(guardFetch.calls.length === 2 && later.ok === false, "after the cooldown a new request is allowed (this fake has no EUR rate, so it fails, and is not cached)");
clock += 70000;
await guarded({ quote: "USD", cost: "CNY" });
check(guardFetch.calls.length === 3, "an expired cache entry is refreshed");
let failing = true;
const flaky = createReferenceRateFetcher({ cooldownMs: 0, now: () => clock, fetchImpl: recorder(() => (failing ? json({}, 503) : json(frankfurter))), providers: [PROVIDERS[0]] });
check(!(await flaky({ quote: "USD", cost: "CNY" })).ok, "a failure is returned");
failing = false;
check((await flaky({ quote: "USD", cost: "CNY" })).ok, "a failure is never cached, so the next attempt can succeed");

console.log(`FX rate source tests: ${checks}/${checks} PASS`);
