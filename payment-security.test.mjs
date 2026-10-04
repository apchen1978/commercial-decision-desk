// payment-security.test.mjs — expected values are hand-calculated from the inputs.
import assert from "node:assert/strict";
import { opportunity } from "./fixtures.js";
import { assessPaymentSecurity, paymentSecurityUnknown, SECURITY_UNKNOWN_ID } from "./payment-security.js";
import { withDerivedUnknowns } from "./derived-unknowns.js";
import { evaluateDecision } from "./decision-engine.js";

let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks += 1; };
const near = (a, b, message) => check(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`);
const clone = (v) => JSON.parse(JSON.stringify(v));
const withSecurity = (patch) => { const o = clone(opportunity); o.unknowns = o.unknowns.filter((u) => u.id !== SECURITY_UNKNOWN_ID); o.paymentSecurity = { ...o.paymentSecurity, ...patch }; return o; };

// Sample: the RFP's 90 days after delivery leaves up to the whole revenue uncovered.
const sample = assessPaymentSecurity(opportunity);
check(sample.state === "UNKNOWN" && sample.needsAttention, "nothing arranged yet is UNKNOWN and needs attention");
check(sample.exposure === 144000 && sample.exposureKnown === false, "with no confirmed advance, exposure is the whole revenue as an upper bound");
check(sample.securedShare === 0 && sample.residual === 144000, "nothing secures it yet");
const unk = paymentSecurityUnknown(opportunity);
check(unk.id === "UNK-SEC" && unk.blocksPursue === true && unk.resolveWith.includes("L/C"), "an uncovered receivable registers a blocking UNKNOWN naming the ways to clear it");
check(opportunity.unknowns.some((u) => u.id === "UNK-SEC" && u.blocksPursue), "the sample fixture registers it, so the engine reads it");
check(evaluateDecision(opportunity).blockingUnknowns.some((u) => u.id === "UNK-SEC"), "the unchanged engine sees the blocking UNKNOWN");

// A confirmed L/C over the full receivable clears it.
const covered = assessPaymentSecurity(withSecurity({ lc: { status: "IN_PLACE", confirmed: "YES", coveragePct: 100, feePct: 0.5 } }));
check(covered.state === "COVERED" && covered.residual === 0 && covered.securedShare === 100, "a confirmed 100% L/C covers the receivable");
check(paymentSecurityUnknown(withSecurity({ lc: { status: "IN_PLACE", confirmed: "YES", coveragePct: 100 } })) === null, "no UNKNOWN once covered");
near(covered.costs[0].amount, 720, "L/C fee 0.5% of 144,000 revenue");

// An unconfirmed L/C is not cover: the issuing bank's risk is still the seller's.
const unconfirmed = assessPaymentSecurity(withSecurity({ lc: { status: "IN_PLACE", confirmed: "NO", coveragePct: 100 } }));
check(unconfirmed.state === "INCOMPLETE" && unconfirmed.securedShare === 0 && unconfirmed.lc.unconfirmed, "an unconfirmed L/C counts as no cover and stays incomplete");
check(assessPaymentSecurity(withSecurity({ lc: { status: "IN_PLACE", confirmed: "YES", coveragePct: null } })).state === "INCOMPLETE", "an L/C with unknown coverage is incomplete");
check(assessPaymentSecurity(withSecurity({ lc: { status: "IN_PLACE", confirmed: "YES", coveragePct: 150 } })).state === "INCOMPLETE", "an out-of-range coverage is treated as unknown");

// Insurance with a partial advance: 30% advance leaves 70% open; 90% insured leaves 10% of that.
const partial = assessPaymentSecurity(withSecurity({ advancePct: 30, insurance: { status: "IN_PLACE", coveragePct: 90, premiumPct: 0.3 } }));
near(partial.exposure, 100800, "70% of 144,000 stays open after a 30% advance");
near(partial.secured, 90720, "90% of the open receivable is insured");
near(partial.residual, 10080, "10% of the open receivable is left uncovered");
check(partial.state === "PARTIAL" && partial.exposureKnown === true, "partial cover on a known exposure");
near(partial.costs[0].amount, 432, "premium 0.3% of 144,000 revenue");
check(paymentSecurityUnknown(withSecurity({ advancePct: 30, insurance: { status: "IN_PLACE", coveragePct: 90 } })) !== null, "partial cover still needs an answer or the owner's acceptance");

// L/C and insurance over the same receivable are not added together.
const both = assessPaymentSecurity(withSecurity({ lc: { status: "IN_PLACE", confirmed: "YES", coveragePct: 60 }, insurance: { status: "IN_PLACE", coveragePct: 90 } }));
check(both.securedShare === 90, "the larger coverage is used, not the sum");

// No open risk, owner acceptance, and explicit non-use.
check(assessPaymentSecurity(withSecurity({ advancePct: 100 })).state === "NO_OPEN_RISK", "a 100% advance leaves no open receivable");
check(paymentSecurityUnknown(withSecurity({ advancePct: 100 })) === null, "no UNKNOWN when there is no open receivable");
const accepted = assessPaymentSecurity(withSecurity({ ownerAcceptsUnsecured: true }));
check(accepted.state === "OWNER_ACCEPTED" && accepted.residual === 144000, "owner acceptance is recorded, and the residual is still reported");
check(paymentSecurityUnknown(withSecurity({ ownerAcceptsUnsecured: true })) === null, "owner acceptance clears the UNKNOWN");
const notUsed = assessPaymentSecurity(withSecurity({ lc: { status: "NOT_USED" }, insurance: { status: "NOT_USED" } }));
check(notUsed.state === "UNSECURED" && notUsed.needsAttention, "both instruments explicitly not used is UNSECURED, distinct from UNKNOWN");

// Not assessed and purity.
const bare = clone(opportunity); delete bare.paymentSecurity;
check(paymentSecurityUnknown(bare) === null, "an opportunity without the field is not assessed and registers nothing");
const before = JSON.stringify(opportunity);
assessPaymentSecurity(opportunity); paymentSecurityUnknown(opportunity);
check(JSON.stringify(opportunity) === before, "assessing never mutates the opportunity");

// The derived-unknown helper is idempotent and non-mutating.
const stripped = clone(opportunity); stripped.unknowns = stripped.unknowns.filter((u) => !["UNK-SEC", "UNK-FX"].includes(u.id));
const derived = withDerivedUnknowns(stripped);
check(derived.unknowns.some((u) => u.id === "UNK-SEC") && derived.unknowns.some((u) => u.id === "UNK-FX"), "the helper registers both derived unknowns");
check(stripped.unknowns.length === derived.unknowns.length - 2, "the input object was not changed");
check(withDerivedUnknowns(derived) === derived, "applying it twice adds nothing");

console.log(`Payment security tests: ${checks}/${checks} PASS`);
