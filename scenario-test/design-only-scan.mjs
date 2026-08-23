// design-only-scan.mjs — synthetic boundary scan for Decision Pack 001.
// DESIGN-ONLY: no engine/contract changes. Reads decision-engine.js, builds
// in-memory fixtures for the KYC and urgent-order cases, records ACTUAL behavior.
// Output is used only inside SYNTHETIC_BOUNDARY_MATRIX_001.md (design evidence).
import { evaluateDecision, paymentExposure } from "../decision-engine.js";

// base opportunity template (mirrors fixture shape, synthetic)
function base() {
  return {
    id: "SYNTH-BASE",
    synthetic: true,
    name: "Synthetic boundary case (design-only)",
    dimensions: {
      buyerFit: { value: "HIGH" },
      categoryFit: { value: "HIGH" },
      evidenceQuality: { value: "HIGH" },
      importOpenness: { value: "HIGH" },
      commercialFeasibility: { value: "CONDITIONAL" },
    },
    contradictions: [],
    unknowns: [],
    whyNot: [],
    why: [],
    commercialTerms: { status: "COMPLETE", detail: "" },
    quotes: [],
    quoteBasesComparable: true,
    paymentEvents: [
      { id: "PE-1", label: "Deposit", amountCny: 30000, daysFromSign: 0, status: "COMPLETE" },
      { id: "PE-2", label: "Balance", amountCny: 70000, daysFromSign: 30, status: "COMPLETE" },
    ],
    buyers: [{ id: "B1", label: "Synthetic buyer" }],
    paymentDisclosure: "synthetic",
  };
}

// NOTE on how each KYC/urgency signal would be (or would NOT be) represented in the
// CURRENT contract: the engine has NO fields for kyc/sanctions/insurance/margin/
// switch-reason/urgency-direction. The only existing primitives we can legitimately
// use to express such signals are: dimension values (buyerFit/categoryFit/
// evidenceQuality), contradictions[], unknowns[], commercialTerms, paymentEvents.
// Anything else is "received but not semanticized".

const KYC_CASES = {
  "KYC-1": { label: "KYC confirmed clear", mutate: (c) => { /* clear → nothing to add; engine sees a clean positive deal */ } },
  "KYC-2": { label: "KYC incomplete / beneficial owner unknown", mutate: (c) => { c.unknowns.push({ id: "U-KYC", label: "Beneficial owner verification", detail: "KYC incomplete (synthetic)", blocksPursue: true }); } },
  "KYC-3": { label: "sanctions hit / adverse finding", mutate: (c) => { c.contradictions.push({ id: "CTR-SAN", label: "Sanctions-list hit", detail: "Adverse finding (synthetic)", material: true, status: "UNRESOLVED" }); } },
  "KYC-4": { label: "insurance available but KYC unresolved", mutate: (c) => { c.unknowns.push({ id: "U-KYC", label: "Beneficial owner verification", detail: "KYC incomplete despite insurability (synthetic)", blocksPursue: true }); } },
  "KYC-5": { label: "high-margin deal with failed KYC", mutate: (c) => { c.contradictions.push({ id: "CTR-SAN", label: "Sanctions-list hit", detail: "High-margin but adverse finding (synthetic)", material: true, status: "UNRESOLVED" }); } },
  "KYC-6": { label: "low-margin deal with clear KYC", mutate: (c) => { c.dimensions.commercialFeasibility.value = "LOW"; } },
};

const URGENT_CASES = {
  "U-1": { label: "urgent order with verified supplier-switch reason", mutate: (c) => { c.dimensions.buyerFit.value = "HIGH"; /* engine: no switch-reason field */ } },
  "U-2": { label: "urgent order with unknown switch reason", mutate: (c) => { c.unknowns.push({ id: "U-SW", label: "Supplier-switch reason", detail: "Unknown (synthetic)", blocksPursue: false }); } },
  "U-3": { label: "urgent order after repeated prior-vendor failure", mutate: (c) => { /* engine: no prior-vendor-history field */ } },
  "U-4": { label: "urgent order from trusted referral", mutate: (c) => { c.dimensions.buyerFit.value = "HIGH"; } },
  "U-5": { label: "urgent order with weak payment history", mutate: (c) => { c.unknowns.push({ id: "U-PH", label: "Buyer payment history", detail: "Weak/unverified (synthetic)", blocksPursue: true }); } },
  "U-6": { label: "urgent order where urgency is operationally justified", mutate: (c) => { /* engine: no urgency-direction field; buyerFit stays HIGH */ } },
};

console.log("=== KYC CASES (design-only) ===");
for (const [id, cse] of Object.entries(KYC_CASES)) {
  const opp = base();
  cse.mutate(opp);
  const e = evaluateDecision(opp);
  const x = paymentExposure(opp.paymentEvents);
  console.log(`${id} [${cse.label}] -> recommended=${e.recommended} availNow=${e.available.PURSUE_NOW} matContr=${e.materialContradictions.length} blockUnk=${e.blockingUnknowns.length}`);
}

console.log("\n=== URGENT-ORDER CASES (design-only) ===");
for (const [id, cse] of Object.entries(URGENT_CASES)) {
  const opp = base();
  cse.mutate(opp);
  const e = evaluateDecision(opp);
  const x = paymentExposure(opp.paymentEvents);
  console.log(`${id} [${cse.label}] -> recommended=${e.recommended} availNow=${e.available.PURSUE_NOW} matContr=${e.materialContradictions.length} blockUnk=${e.blockingUnknowns.length}`);
}
console.log("\nDONE — design-only; no repo change.");
