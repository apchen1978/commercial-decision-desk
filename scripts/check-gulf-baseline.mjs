// Calculation-only gate. Does not write files, update golden data, or publish.
// node scripts/check-gulf-baseline.mjs <TPN checkout>
// Add --check-runtime AFTER the approved baseline has been synced to both cases.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildEconomicsBridge } from "../economics-bridge.js";
import { opportunity, PLANNING_FX_CNY_PER_USD } from "../fixtures.js";
import { paymentExposure, evaluateDecision } from "../decision-engine.js";
import { assessPaymentSecurity } from "../payment-security.js";

const args = process.argv.slice(2);
const tpnRootArg = args.find((arg) => !arg.startsWith("--"));
assert.ok(tpnRootArg, "Provide the inspected TPN checkout path; no implicit checkout or network retrieval.");
assert.ok(args.every((arg) => arg === tpnRootArg || arg === "--check-runtime"), "Unknown argument.");
const tpnRoot = resolve(tpnRootArg);
const loadTpn = (file) => import(pathToFileURL(resolve(tpnRoot, file)).href);
const [{ CASE_GULF_001 }, { calculateCase }, { calculateLanded, sensitivity, compareTerms }, { DEFAULT_PACK }] = await Promise.all([
  loadTpn("cases.js"), loadTpn("navigator.js"), loadTpn("landed.js"), loadTpn("pack.js"),
]);
const baseline = JSON.parse(readFileSync(new URL("../cases/gulf-hospitality-baseline.json", import.meta.url), "utf8"));
let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };
const near = (actual, expected, message, tolerance = 1e-7) => {
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
};
const money = (value) => Math.round(value * 100) / 100;

equal([baseline.id, baseline.schemaVersion, baseline.version], ["gulf-hospitality-baseline", 1, "2026-10-05.1"], "approved case identity and version");
equal(baseline.currency, "USD", "quote currency");
equal(baseline.unit.id, "metre-of-finished-width", "finished width, not fabric length");
equal(baseline.unit.includedProducts, ["hospitality interior products"], "product scope");
equal(baseline.unit.excludedScope, ["on-site installation"], "installation remains excluded");
equal([baseline.quantity, baseline.pricePerUnitUsd, baseline.incoterm], [12000, 12, "CIF"], "approved quantity, price and basis");
equal(baseline.costsPerUnitUsd, { goods: 6.6, tradeLogistics: 1.05, dealSpecific: 0.9, contingency: 0.45 }, "approved unit costs");
equal(baseline.minimumNetContributionUsd, 28800, "fixed owner minimum, not a moving percentage during sensitivity");
check(Object.values(baseline.costsPerUnitUsd).every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0), "blank costs cannot become zero or an old default");
equal([DEFAULT_PACK.id, DEFAULT_PACK.version], [baseline.provenance.sensitivityPackId, baseline.provenance.sensitivityPackVersion], "unchanged sensitivity pack identity");
equal(baseline.supplierPaymentFx.cnyPerUsd, PLANNING_FX_CNY_PER_USD, "unchanged demo CDD FX");

const fundingKeys = ["dutyRate", "dutyBearer", "costOfCapital", "fxShare", "timeline", "terms", "activeTerms"];
for (const key of fundingKeys) equal(baseline.funding[key], CASE_GULF_001.landed[key], `existing TPN funding assumption unchanged: ${key}`);

// Project both tools from ONE approved input and verify runtime parity.
const reference = { id: baseline.id, version: baseline.version };
const q = baseline.quantity;
const costs = baseline.costsPerUnitUsd;
const economics = {
  currency: baseline.currency,
  revenue: money(q * baseline.pricePerUnitUsd),
  directCost: money(q * costs.goods),
  tradeCost: money(q * costs.tradeLogistics),
  dealSpecificCost: money(q * costs.dealSpecific),
  contingency: money(q * costs.contingency),
  minimumNetContribution: baseline.minimumNetContributionUsd,
};
const draftCdd = structuredClone(opportunity);
draftCdd.caseBaseline = reference;
draftCdd.economics = economics;
draftCdd.paymentEvents = [
  { id: "PE-1", label: "Demo supplier deposit", amountCny: Math.round(economics.directCost * baseline.funding.timeline.depositShare * baseline.supplierPaymentFx.cnyPerUsd), daysFromSign: baseline.funding.timeline.depositDay, status: "COMPLETE" },
  { id: "PE-2", label: "Demo supplier balance", amountCny: Math.round(economics.directCost * (1 - baseline.funding.timeline.depositShare) * baseline.supplierPaymentFx.cnyPerUsd), daysFromSign: baseline.funding.timeline.balanceDay, status: "COMPLETE" },
];
const draftTpn = {
  ...structuredClone(CASE_GULF_001),
  caseBaseline: reference,
  quantity: q,
  sellingPrice: baseline.pricePerUnitUsd,
  purchasePrice: costs.goods,
  knownCosts: { manufacturing: costs.goods, tradeAndProject: money(costs.tradeLogistics + costs.dealSpecific + costs.contingency) },
  landed: {
    ...structuredClone(baseline.funding),
    tradeCost: costs.tradeLogistics,
    dealCost: costs.dealSpecific,
    contingency: costs.contingency,
    minimumContribution: baseline.minimumNetContributionUsd,
  },
};
const cfgFor = (c) => ({ ...c.landed, quantity: c.quantity, price: c.sellingPrice, goodsCost: c.purchasePrice });
const cfg = cfgFor(draftTpn);
const cdd = buildEconomicsBridge(draftCdd.economics);
const tpn = calculateCase(draftTpn);
const base = calculateLanded(cfg);
const noFunding = calculateLanded({ ...cfg, costOfCapital: 0 });
const risks = sensitivity(cfg, DEFAULT_PACK);
const priceLimit = risks.rows.find((row) => row.id === "price").cushion;
const concession3 = calculateLanded(cfg, { priceMult: 0.97 });
const concession5 = calculateLanded(cfg, { priceMult: 0.95 });
const sellerDuty = calculateLanded({ ...cfg, dutyBearer: "SELLER" });
const security = assessPaymentSecurity(draftCdd);
const supplier = paymentExposure(draftCdd.paymentEvents);

equal(draftCdd.caseBaseline, draftTpn.caseBaseline, "same case version in both projected tools");
equal([economics.revenue, economics.directCost, economics.tradeCost, economics.dealSpecificCost, economics.contingency], [144000, 79200, 12600, 10800, 5400], "totals reconcile with approved Owner inputs");
near(economics.minimumNetContribution / economics.revenue, 0.2, "minimum is 20% of undiscounted revenue");
near(cdd.totalKnownCosts, 108000, "cost sum");
near(cdd.expectedNetContribution, 36000, "CDD contribution before funding");
near(tpn.knownTotalContribution, cdd.expectedNetContribution, "TPN simple contribution equals CDD before funding");
near(noFunding.net, cdd.expectedNetContribution, "TPN landed contribution at zero funding rate equals CDD");
near(base.revenue, economics.revenue, "same revenue in both tools");
for (const [id, key] of [["goods", "directCost"], ["trade", "tradeCost"], ["deal", "dealSpecificCost"], ["contingency", "contingency"]]) {
  near(base.stack.find((row) => row.id === id).total, economics[key], `same ${id} cost in both tools`);
}
// Independent hand calculation from whole-order cash, not the production financing loop:
// day 0-45: 23,760 funded; day 45-60: 79,200; day 60-165: 102,600.
// The 5,400 contingency reserve is deducted from contribution but is NOT a dated cash outflow in the existing model.
const independentFunding = (23760 * 45 + 79200 * 15 + 102600 * 105) * 0.08 / 365;
near(base.financing.perUnit * q, independentFunding, "funding equals independent interval calculation");
near(base.net, 36000 - independentFunding, "after-funding contribution reconciles");
near(base.headroom, base.net - 28800, "headroom uses the fixed owner minimum");
near(base.financing.peakFundingPerUnit * q, 102600, "peak funding is not the receivable exposure");
near(priceLimit.magnitude, base.headroom / 144000 * 100, "concession threshold verified independently for default terms A");
near(calculateLanded(cfg, { priceMult: 1 - priceLimit.magnitude / 100 }).net, 28800, "computed concession actually reaches the fixed minimum");
near(concession3.revenue, 139680, "3% concession revenue");
near(concession5.revenue, 136800, "5% concession revenue");
near(sellerDuty.net, base.net - 7200 - 7200 * 0.08 * 90 / 365, "seller duty plus carrying cost verified independently");
equal(security.exposureKnown, false, "buyer advance remains unconfirmed");
near(security.exposure, 144000, "upper receivable bound, not a cash shortfall");
near(assessPaymentSecurity({ ...draftCdd, paymentSecurity: { ...draftCdd.paymentSecurity, advancePct: 30 } }).exposure, 100800, "30% confirmed advance illustration");
near(supplier.totalCommittedCny, 594000, "supplier commitment based on goods cost");
near(supplier.peakWindowCny, 415800, "supplier peak event, not peak working capital");
equal(evaluateDecision(draftCdd).recommended, evaluateDecision(opportunity).recommended, "repricing alone does not resolve payment contradiction or confer authority");
equal(JSON.stringify(calculateLanded(cfg)), JSON.stringify(calculateLanded(cfg)), "repeatable calculation");

const runtimeSyncRequested = args.includes("--check-runtime");
if (runtimeSyncRequested) {
  // Projections alone do not prove that runtime fixtures and static mirrors were synchronized.
  const { GULF_BASELINE: cddMirror } = await import("../cases/gulf-hospitality-baseline.js");
  const { GULF_BASELINE: tpnMirror } = await loadTpn("cases/gulf-hospitality-baseline.js");
  equal(cddMirror, baseline, "CDD browser mirror matches canonical JSON");
  equal(tpnMirror, baseline, "TPN browser mirror matches canonical JSON");
  equal(opportunity.caseBaseline, reference, "CDD runtime version");
  equal(CASE_GULF_001.caseBaseline, reference, "TPN runtime version");
  equal(opportunity.economics, economics, "CDD runtime economics");
  equal(CASE_GULF_001.quantity, q, "TPN runtime quantity");
  equal(CASE_GULF_001.sellingPrice, draftTpn.sellingPrice, "TPN runtime price");
  equal(CASE_GULF_001.purchasePrice, draftTpn.purchasePrice, "TPN runtime goods cost");
  equal(CASE_GULF_001.knownCosts, draftTpn.knownCosts, "TPN runtime cost aggregate");
  equal(CASE_GULF_001.landed, draftTpn.landed, "TPN runtime costs, minimum and funding assumptions");
  equal(JSON.parse(readFileSync(resolve(tpnRoot, "cases/gulf-hospitality-baseline.json"), "utf8")), baseline, "TPN baseline copy matches canonical data exactly");
  near(buildEconomicsBridge(opportunity.economics).expectedNetContribution, calculateCase(CASE_GULF_001).knownTotalContribution, "actual runtime pre-funding results match");
  near(calculateLanded(cfgFor(CASE_GULF_001)).net, base.net, "actual runtime funded result matches canonical projection");
}

console.log(JSON.stringify({
  scope: runtimeSyncRequested ? "RUNTIME_PARITY_CHECK" : "PRE_SYNC_CALCULATION_REVIEW",
  baseline: reference,
  checks,
  result: "PASS",
  runtimeSynchronizationChecked: runtimeSyncRequested,
  economics,
  beforeFundingContribution: cdd.expectedNetContribution,
  fundingCost: base.financing.perUnit * q,
  afterFundingContribution: base.net,
  headroom: base.headroom,
  concessionLimitPct: priceLimit.magnitude,
  concessionPriceFloor: cfg.price * (1 - priceLimit.magnitude / 100),
  concession3Pct: { net: concession3.net, headroom: concession3.headroom },
  concession5Pct: { net: concession5.net, headroom: concession5.headroom },
  weakest: risks.weakest && { id: risks.weakest.id, cushion: risks.weakest.cushion },
  sensitivity: risks.rows.map(({ id, deltaNet, netAfter, cushion }) => ({ id, deltaNet, netAfter, cushion })),
  sellerBorneImportDuty: { net: sellerDuty.net, headroom: sellerDuty.headroom, belowMinimum: sellerDuty.belowMinimum },
  peakFundingUsd: base.financing.peakFundingPerUnit * q,
  termsComparison: compareTerms(cfg),
  receivableExposureUsd: security.exposure,
  supplierCommitmentCny: supplier.totalCommittedCny,
  supplierPeakEventCny: supplier.peakWindowCny,
  sourceDecision: evaluateDecision(draftCdd).recommended,
}, null, 2));
