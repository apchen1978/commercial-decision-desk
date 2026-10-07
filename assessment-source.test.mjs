import { opportunity } from "./fixtures.js";
import { opportunityForAssessment } from "./assessment-source.js";
import { blankAssessmentDefaults } from "./workbench-adapter.js";
import { buildEconomicsBridge } from "./economics-bridge.js";
import { evaluateDecision } from "./decision-engine.js";

const check = (description, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${description}`);
  if (!condition) process.exitCode = 1;
};

let sample = structuredClone(opportunity);
const originalEconomics = structuredClone(sample.economics);
for (let run = 1; run <= 2; run += 1) {
  // The real click handler passes no blank-form input in sample mode.
  sample = opportunityForAssessment("sample", sample, null);
  evaluateDecision(sample);
  const bridge = buildEconomicsBridge(sample.economics);
  check(`sample run ${run} keeps USD 144,000 revenue`, bridge.revenue === 144000);
  check(`sample run ${run} keeps USD 36,000 net contribution`, bridge.expectedNetContribution === 36000);
  check(`sample run ${run} keeps the declared delivery term`, sample.trade.deliveryTerm === opportunity.trade.deliveryTerm);
  check(`sample run ${run} leaves fixture economics unchanged`, JSON.stringify(sample.economics) === JSON.stringify(originalEconomics));
}

const blank = opportunityForAssessment("blank", null, { ...blankAssessmentDefaults(), deliveryTerm: "notAssessed" });
check("blank mode does not inherit sample economics", buildEconomicsBridge(blank.economics).revenue === null);
check("blank mode keeps unassessed delivery", blank.trade.deliveryTerm === "notAssessed");
