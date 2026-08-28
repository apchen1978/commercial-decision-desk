import { createImportPreview, validateImportProposal, reviewImportSignal, confirmImportContext, buildConfirmedInput } from "./intake-import.js";
const fixture = {
  kind: "cdd-intake-proposal", schemaVersion: 1, sourceSystem: "overseas-lead-discovery", sourceRecordId: "R6", generatedAt: "2026-08-26T00:00:00.000Z",
  sourceDisclosure: { classification: "REPRESENTATIVE_ANONYMIZED", anonymized: true, syntheticElements: true, realProspectIdentitiesExposed: false, note: "Representative anonymized synthetic source; not real buyer evidence." },
  opportunityProposal: { buyer: { name: "Delphi Textile Distributors", type: "Wholesale distributor" }, market: { category: "Window treatments · fabrics", importOpenness: "YES" }, rationale: ["Trade-only distributor (PRIMARY)", "Carries international brands (PRIMARY)"], sourceTiers: ["PRIMARY", "SUPPORTING"] },
  proposedSignals: [{ signal: "BUYER_FIT", value: "HIGH", sourceField: "buyerFit" }, { signal: "CATEGORY_FIT", value: "STRONG", sourceField: "categoryFit" }, { signal: "IMPORT_OPENNESS", value: "YES", sourceField: "importOpenness" }],
  unknowns: ["Asia sourcing", "Finished curtains or fabric only"], potentialTensions: [{ note: "Asia sourcing not confirmed", notCanonicalContradiction: true, reviewNote: "Human review required." }], humanReviewRequired: true,
};
const results = [];
const check = (name, value) => { results.push(Boolean(value)); console.log(`${value ? "PASS" : "FAIL"} ${name}`); };

check("valid source proposal accepted", validateImportProposal(fixture).valid);
const preview = createImportPreview(fixture);
check("preview preserves synthetic disclosure", preview.sourceDisclosure.syntheticElements === true && preview.sourceDisclosure.anonymized === true);
check("preview keeps global rationale and tiers", preview.context.rationale.length === 2 && preview.context.sourceTiers.includes("PRIMARY"));
check("buyer fit is explicitly mapped but still proposed", preview.signals.find((s) => s.signal === "BUYER_FIT")?.mappingStatus === "MAPPED" && preview.signals.find((s) => s.signal === "BUYER_FIT")?.reviewState === "PROPOSED");
check("import openness stays unmapped", preview.signals.find((s) => s.signal === "IMPORT_OPENNESS")?.mappingStatus === "PROPOSED_UNMAPPED");
check("unknowns and tension remain visible", preview.unknowns.length === 2 && preview.potentialTensions[0].notCanonicalContradiction === true);
const oneConfirmed = reviewImportSignal(preview, "BUYER_FIT", "CONFIRMED");
check("one signal confirmation is isolated", oneConfirmed.signals.find((s) => s.signal === "BUYER_FIT")?.reviewState === "CONFIRMED" && oneConfirmed.signals.find((s) => s.signal === "CATEGORY_FIT")?.reviewState === "PROPOSED");
const input = buildConfirmedInput(confirmImportContext(oneConfirmed));
check("only confirmed mapped signal enters input", input.input.buyerFit === "strong" && !("categoryFit" in input.input) && !("importOpenness" in input.input));
const nested = JSON.parse(JSON.stringify(fixture)); nested.opportunityProposal.asiaSourcing = "CONFIRMED";
check("nested source-only field fails closed", !validateImportProposal(nested).valid);
const leaked = JSON.parse(JSON.stringify(fixture)); leaked.opportunityProposal.buyer.humanDecision = "PURSUE_NOW";
check("nested forbidden field fails closed", !validateImportProposal(leaked).valid);
const unsupported = JSON.parse(JSON.stringify(fixture)); unsupported.proposedSignals[0].value = "PERFECT";
check("unsupported value remains unmapped", createImportPreview(unsupported).signals.find((s) => s.signal === "BUYER_FIT")?.mappingStatus === "PROPOSED_UNMAPPED");
console.log(`RESULT: ${results.every(Boolean) ? "PASS" : "FAIL"} (${results.filter(Boolean).length}/${results.length})`);
process.exitCode = results.every(Boolean) ? 0 : 1;
