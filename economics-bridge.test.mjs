import { buildEconomicsBridge, economicsEvidenceTrace, economicsReading } from "./economics-bridge.js";

const results = [];
const check = (name, condition, detail = "") => {
  results.push(Boolean(condition));
  console.log((condition ? "PASS " : "FAIL ") + name + (condition ? "" : " | " + detail));
};

const incomplete = buildEconomicsBridge({ revenue: 100000, directCost: 40000 });
check("missing costs remain NOT_CALCULATED", incomplete.calculationStatus === "NOT_CALCULATED" && incomplete.expectedNetContribution === null);
check("missing cost trace is explicit", economicsEvidenceTrace(incomplete).includes("tradeCost") && economicsEvidenceTrace(incomplete).includes("contingency"));
check("minimum contribution stays separate", incomplete.minimumNetContribution === null);

const complete = buildEconomicsBridge({ revenue: 100000, directCost: 40000, tradeCost: 10000, dealSpecificCost: 5000, contingency: 5000, minimumNetContribution: 30000 });
check("complete bridge calculates contribution", complete.expectedNetContribution === 40000 && complete.totalKnownCosts === 60000);
check("gap compares only owner-provided minimum", complete.gap === 10000);
check("zero is valid evidence", buildEconomicsBridge({ revenue: 0, directCost: 0, tradeCost: 0, dealSpecificCost: 0, contingency: 0 }).expectedNetContribution === 0);
check("negative or invalid inputs stay UNKNOWN", buildEconomicsBridge({ revenue: -1, directCost: "not-a-number" }).revenue === null && buildEconomicsBridge({ revenue: -1 }).directCost === null);
check("positive contribution reads POSITIVE", economicsReading(complete) === "POSITIVE");
check("zero contribution reads BREAK_EVEN", economicsReading(buildEconomicsBridge({ revenue: 0, directCost: 0, tradeCost: 0, dealSpecificCost: 0, contingency: 0 })) === "BREAK_EVEN");
check("negative contribution reads NEGATIVE", economicsReading(buildEconomicsBridge({ revenue: 100, directCost: 150, tradeCost: 0, dealSpecificCost: 0, contingency: 0 })) === "NEGATIVE");
check("incomplete economics reads UNKNOWN", economicsReading(incomplete) === "UNKNOWN");

console.log("\nECONOMICS BRIDGE RESULT: " + results.filter(Boolean).length + "/" + results.length + " PASS");
process.exitCode = results.every(Boolean) ? 0 : 1;
