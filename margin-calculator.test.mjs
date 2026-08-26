// margin-calculator.test.mjs — tests for the Trade Margin Calculator.
// Node-only; independent from verify.mjs (untouched).
import { calculateMargin, marginBps, marginAfterCostShiftBps, thresholdStatus } from "./margin-calculator.js";

const results = [];
const check = (name, cond, detail = "") => {
  results.push([name, !!cond]);
  console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  | " + detail));
};

// 1. deterministic full case (L3-shaped: 480k revenue, 250k direct, 60k trade, 50k deal)
{
  const r = calculateMargin({ revenue: 480000, directCost: 250000, tradeCost: 60000, dealSpecificCost: 50000, contingency: 0, minimumNetContribution: 80000, thresholdBps: 800 });
  check("net contribution = 120000", r.expectedNetContribution === 120000, String(r.expectedNetContribution));
  check("margin bps = 2500 (25%)", r.marginBps === 2500, String(r.marginBps));
  check("reading POSITIVE", r.reading === "POSITIVE");
  check("meets 800 threshold", r.thresholdStatus === "MEETS");
  const again = calculateMargin({ revenue: 480000, directCost: 250000, tradeCost: 60000, dealSpecificCost: 50000, contingency: 0, minimumNetContribution: 80000, thresholdBps: 800 });
  check("deterministic (two runs identical)", JSON.stringify(r) === JSON.stringify(again));
}

// 2. L3 interview case — 5% margin + certification-cost shift on supplier
{
  // revenue 100k, direct 90k, trade 4k, deal 1k (certification) -> net 5k = 5%
  const r = calculateMargin({ revenue: 100000, directCost: 90000, tradeCost: 4000, dealSpecificCost: 1000, contingency: 0, thresholdBps: 800 });
  check("5% margin case -> bps 500", r.marginBps === 500, String(r.marginBps));
  check("5% margin below 8% threshold -> BELOW", r.thresholdStatus === "BELOW");
  // cost-shift: if certification (dealSpecificCost 1000) is pushed onto us, the
  // display isolates its marginal effect: (5000-1000)/100000 = 4% = 400bps.
  // This is a display line, not a decision input.
  check("cost-shift line = net minus deal-specific (400bps)", r.marginAfterCostShiftBps === 400, String(r.marginAfterCostShiftBps));
  check("reading POSITIVE (tool does not veto)", r.reading === "POSITIVE");
}

// 3. no invented threshold
{
  const r = calculateMargin({ revenue: 100000, directCost: 90000, tradeCost: 4000, dealSpecificCost: 1000, contingency: 0 });
  check("no threshold input -> NO_THRESHOLD (never invents)", r.thresholdStatus === "NO_THRESHOLD" && r.thresholdBps === null);
}

// 4. missing inputs stay UNKNOWN
{
  const r = calculateMargin({ revenue: 100000, directCost: 90000 });
  check("incomplete inputs -> not calculated", r.calculationStatus === "NOT_CALCULATED");
  check("margin UNKNOWN when incomplete", r.marginBps === null);
  check("reading UNKNOWN when incomplete", r.reading === "UNKNOWN");
  const empty = calculateMargin({});
  check("empty input -> everything UNKNOWN", empty.expectedNetContribution === null && empty.marginBps === null && empty.thresholdStatus === "NO_FIGURE");
}

// 5. threshold statuses
{
  check("BELOW when bps < threshold", thresholdStatus(500, 800) === "BELOW");
  check("MEETS when bps >= threshold", thresholdStatus(800, 800) === "MEETS");
  check("NO_FIGURE when bps null", thresholdStatus(null, 800) === "NO_FIGURE");
  check("NO_THRESHOLD when threshold missing", thresholdStatus(500, "") === "NO_THRESHOLD");
}

// 6. negative / zero revenue guards
{
  check("zero revenue -> margin null (no division crash)", marginBps({ calculationStatus: "CALCULATED", revenue: 0, expectedNetContribution: 0 }) === null);
  check("negative revenue -> margin null", marginBps({ calculationStatus: "CALCULATED", revenue: -5, expectedNetContribution: -5 }) === null);
  check("cost-shift guard on zero revenue", marginAfterCostShiftBps({ calculationStatus: "CALCULATED", revenue: 0, expectedNetContribution: 0, dealSpecificCost: 1 }) === null);
}

const failed = results.filter(([, ok]) => !ok);
console.log(`\nMARGIN CALC RESULT: ${results.length - failed.length}/${results.length} PASS`);
process.exitCode = failed.length ? 1 : 0;
