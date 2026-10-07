// Keep the sample fixture intact when its assessment is run again. Only the
// manual path reads and normalizes form input; hidden form fields are not sample data.
import { buildOpportunityFromInput } from "./workbench-adapter.js";
import { withDerivedUnknowns } from "./derived-unknowns.js";

export function opportunityForAssessment(mode, current, input) {
  if (mode === "sample") return current;
  if (mode !== "blank") throw new Error(`Cannot assess mode: ${mode}`);

  const opportunity = buildOpportunityFromInput(input);
  opportunity.trade = { deliveryTerm: input.deliveryTerm };
  opportunity.commercialContext = input.commercialContext;
  opportunity.economics = input.economics;
  return withDerivedUnknowns(opportunity);
}
