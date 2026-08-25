import assert from "node:assert/strict";
import { buildPaymentEvidenceView, normalizePaymentEvidence } from "./payment-evidence.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";

const make = (items) => ({ commercialTerms: { paymentEvidence: items } });
const normalized = normalizePaymentEvidence([
  { label: "Mention", state: "MENTIONED", source: "email" },
  { label: "Proposal", state: "PROPOSED", source: "RFP" },
  { label: "Confirmed", state: "CONFIRMED", humanStatus: "CONFIRMED_BY_OWNER" },
  { label: "Binding", state: "BINDING", humanStatus: "PENDING_REVIEW" },
]);
assert.equal(normalized[0].state, "MENTIONED");
assert.notEqual(normalized[0].state, "CONFIRMED");
assert.notEqual(normalized[1].state, "BINDING");
assert.equal(normalized[2].state, "CONFIRMED");
assert.equal(normalized[3].humanStatus, "PENDING_REVIEW");
assert.equal(buildPaymentEvidenceView(make([])).status, "UNKNOWN");
assert.equal(buildPaymentEvidenceView(make([{ label: "weak", state: "MENTIONED" }])).status, "NOT_CONFIRMED");
assert.equal(buildPaymentEvidenceView(make([{ label: "confirmed", state: "CONFIRMED", humanStatus: "CONFIRMED_BY_OWNER" }])).status, "CONFIRMED_NOT_BINDING");
assert.equal(buildPaymentEvidenceView(make([{ label: "binding", state: "BINDING", humanStatus: "CONFIRMED_BY_OWNER" }])).status, "BINDING");
assert.equal(buildPaymentEvidenceView(make([{ label: "missing", state: "UNKNOWN" }])).unresolvedCount, 1);
const view = buildTradeDealViewModel({ commercialTerms: { status: "INCOMPLETE", paymentEvidence: [{ label: "RFP", state: "PROPOSED" }] }, paymentEvents: [] }, { exposure: { computed: false } });
assert.equal(view.structure.paymentEvidence.items[0].state, "PROPOSED");
assert.equal(view.structure.payment.exposureStatus, "UNKNOWN");
console.log("Payment Evidence v0.1: 11/11 PASS");
