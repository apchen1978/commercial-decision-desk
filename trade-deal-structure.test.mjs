import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildTradeDealViewModel } from "./trade-deal-structure.js";

const results = [];
const check = (name, condition, detail = "") => { results.push(Boolean(condition)); console.log(`${condition ? "PASS" : "FAIL"} ${name}${condition ? "" : ` | ${detail}`}`); };

const sample = buildTradeDealViewModel(opportunity, evaluateDecision(opportunity));
check("payment structure reuses existing payment events", sample.structure.payment.totalCount === 2 && sample.structure.payment.completeCount === 2);
check("payment exposure uses engine semantics", sample.structure.payment.exposure === 3600000 && sample.structure.payment.exposureStatus === "COMPUTED_FROM_COMPLETE_EVENTS");
check("sample declares its Incoterm", sample.structure.delivery.declaredTerm === "CIF" && sample.structure.delivery.confirmed);
const undeclared = structuredClone(opportunity);
delete undeclared.trade;
const undeclaredView = buildTradeDealViewModel(undeclared, evaluateDecision(undeclared));
check("undeclared delivery remains UNKNOWN", undeclaredView.structure.delivery.declaredTerm === "UNKNOWN" && !undeclaredView.structure.delivery.confirmed);
check("unknown delivery creates a traced prep item", undeclaredView.negotiationPrep.some((item) => item.type === "DELIVERY" && item.evidenceTrace.some((trace) => trace.sourceId === "DELIVERY_TERM")));
check("payment contradiction creates a traced prep item", sample.negotiationPrep.some((item) => item.type === "PAYMENT" && item.evidenceTrace.some((trace) => trace.sourceType === "contradiction")));
check("prep is bounded to 1-3", sample.negotiationPrep.length >= 1 && sample.negotiationPrep.length <= 3);
check("every prep item has owner boundary and rerun", sample.negotiationPrep.every((item) => item.ownerInput && item.rerunWhen && item.evidenceTrace.length));

const declared = { ...opportunity, trade: { deliveryTerm: "CIF" } };
const declaredView = buildTradeDealViewModel(declared, evaluateDecision(declared));
check("declared Incoterm is presentation evidence only", declaredView.structure.delivery.declaredTerm === "CIF" && declaredView.structure.delivery.confirmed && evaluateDecision(declared).recommended === evaluateDecision(opportunity).recommended);
check("no universal trade action is generated", declaredView.negotiationPrep.every((item) => ["PAYMENT", "DELIVERY", "QUOTE", "AUTHORITY"].includes(item.type)));

console.log(`\nTRADE DEAL STRUCTURE RESULT: ${results.filter(Boolean).length}/${results.length} PASS`);
process.exitCode = results.every(Boolean) ? 0 : 1;
