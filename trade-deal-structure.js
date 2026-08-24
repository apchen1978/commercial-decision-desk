// Trade Deal Structure + Negotiation Prep Lite.
// Presentation-only. This module does not evaluate, score, infer, or add gates.

export const INCOTERM_OPTIONS = Object.freeze(["notAssessed", "EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]);

const INCOTERM_BOUNDARIES = Object.freeze({
  EXW: { boundary: "Seller makes the goods available at the named place; buyer-side collection and export responsibilities require confirmation.", evidence: "Confirm named place, loading, export clearance, and onward transport responsibility." },
  FCA: { boundary: "Seller delivers to the agreed carrier or place; handover point and onward responsibility require confirmation.", evidence: "Confirm named place, carrier handover, export clearance, and transport scope." },
  FOB: { boundary: "Seller delivers the goods on board at the named port; sea or inland-waterway scope and onward responsibility require confirmation.", evidence: "Confirm named port, loading point, freight scope, and whether the quoted goods are ready for vessel loading." },
  CFR: { boundary: "Seller arranges carriage to the named destination port; the responsibility handover point and included scope require confirmation.", evidence: "Confirm named destination port, freight inclusion, and responsibility after the handover point." },
  CIF: { boundary: "Seller arranges carriage and stated insurance to the named destination port; coverage and handover details require confirmation.", evidence: "Confirm named destination port, insurance scope, coverage evidence, and responsibility after the handover point." },
  CPT: { boundary: "Seller arranges carriage to the named destination; handover point and onward responsibility require confirmation.", evidence: "Confirm named destination, carrier handover, carriage scope, and downstream responsibilities." },
  CIP: { boundary: "Seller arranges carriage and stated insurance to the named destination; coverage and handover details require confirmation.", evidence: "Confirm named destination, insurance scope, coverage evidence, and downstream responsibilities." },
  DAP: { boundary: "Seller delivers ready for unloading at the named destination; unloading and import responsibilities require confirmation.", evidence: "Confirm named destination, unloading responsibility, import clearance, and duty or tax assumptions." },
  DPU: { boundary: "Seller delivers unloaded at the named destination; import responsibilities and site readiness require confirmation.", evidence: "Confirm named destination, unloading capability, import clearance, and site readiness." },
  DDP: { boundary: "Seller delivers to the named destination with stated import scope; customs, duty, tax, and local delivery evidence require confirmation.", evidence: "Confirm named destination, importer arrangement, customs evidence, duty or tax assumptions, and local delivery scope." },
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const trace = (sourceType, sourceId, label) => ({ sourceType, sourceId, label });

function paymentEvidence(opportunity, engine) {
  const events = opportunity.paymentEvents || [];
  const complete = events.filter((event) => event.status === "COMPLETE");
  return {
    events: events.map((event) => ({ label: event.label, status: event.status, amountCny: event.amountCny, daysFromSign: event.daysFromSign })),
    completeCount: complete.length,
    totalCount: events.length,
    exposure: engine.exposure?.computed ? engine.exposure.totalCommittedCny : null,
    exposureStatus: engine.exposure?.computed ? "COMPUTED_FROM_COMPLETE_EVENTS" : "UNKNOWN",
    termsStatus: opportunity.commercialTerms?.status || "INCOMPLETE",
    termsDetail: opportunity.commercialTerms?.detail || "",
  };
}

export function buildTradeDealStructure(opportunity, engine) {
  const deliveryTerm = opportunity.trade?.deliveryTerm || "UNKNOWN";
  const delivery = INCOTERM_BOUNDARIES[deliveryTerm];
  return {
    payment: paymentEvidence(opportunity, engine),
    delivery: {
      declaredTerm: deliveryTerm,
      confirmed: Boolean(delivery),
      responsibilityBoundary: delivery?.boundary || "No delivery term has been explicitly declared; responsibility allocation remains UNKNOWN.",
      evidenceRequired: delivery?.evidence || "Confirm the declared delivery term, named place, handover point, and responsibility for transport, import, and site delivery.",
      trace: delivery ? [trace("evidence", "DELIVERY_TERM", deliveryTerm)] : [trace("unknown", "DELIVERY_TERM", "No declared delivery term")],
    },
  };
}

export function buildNegotiationPrep(opportunity, engine, tradeStructure) {
  const prep = [];
  const payment = tradeStructure.payment;
  if (engine.materialContradictions?.length || engine.termsIncomplete || payment.exposureStatus === "UNKNOWN") {
    prep.push({
      type: "PAYMENT",
      priority: 1,
      question: "Confirm the binding payment schedule, timing, and any pre- or post-shipment exposure.",
      request: "Request buyer-issued written payment and delivery terms.",
      avoidCommitment: "Do not commit to a payment schedule or credit exposure that is not confirmed in writing.",
      ownerInput: "Owner decides whether the unresolved payment position is worth further pursuit.",
      rerunWhen: "Rerun after binding payment terms and complete payment-event evidence are recorded.",
      evidenceTrace: (engine.materialContradictions || []).length
        ? engine.materialContradictions.map((item) => trace("contradiction", item.id, item.label))
        : [trace("existing_rule", "PAYMENT", "Payment terms or payment exposure remain incomplete")],
    });
  }
  if (!tradeStructure.delivery.confirmed) {
    prep.push({
      type: "DELIVERY",
      priority: 1,
      question: "Which delivery term and named place should govern this quote, and where does responsibility hand over?",
      request: "Request the buyer's declared Incoterm, named place, and responsibility split for transport, import, and site delivery.",
      avoidCommitment: "Do not absorb freight, insurance, duty, tax, customs, unloading, or local-delivery responsibility by assumption.",
      ownerInput: "Owner decides whether to quote, clarify, or pause while the responsibility boundary is UNKNOWN.",
      rerunWhen: "Rerun after the declared delivery term and named place are confirmed.",
      evidenceTrace: tradeStructure.delivery.trace,
    });
  } else {
    prep.push({
      type: "DELIVERY",
      priority: 2,
      question: `Confirm the ${tradeStructure.delivery.declaredTerm} named place, handover point, and responsibilities reflected in the quote.`,
      request: `Request written confirmation of the ${tradeStructure.delivery.declaredTerm} scope and any cost or import assumptions.`,
      avoidCommitment: "Do not treat the declared term as proof that every freight, insurance, duty, tax, or site obligation is priced or accepted.",
      ownerInput: "Owner decides whether the declared responsibility boundary is commercially acceptable.",
      rerunWhen: "Rerun after the named place, scope, and responsibility evidence are confirmed.",
      evidenceTrace: tradeStructure.delivery.trace,
    });
  }
  if (opportunity.quoteComparabilityAssessed === false || engine.quoteBasesComparable === false) {
    prep.push({
      type: "QUOTE",
      priority: 2,
      question: "Are the submitted quotes using the same delivery responsibility and comparable scope?",
      request: "Request quote versions that state currency, validity, freight, samples, tooling, and delivery responsibility explicitly.",
      avoidCommitment: "Do not rank or concede on price while quote scopes remain different or UNKNOWN.",
      ownerInput: "Owner decides which scope is commercially relevant before comparing offers.",
      rerunWhen: "Rerun after the quote comparison basis is confirmed.",
      evidenceTrace: [trace("evidence", "QUOTE_COMPARABILITY", "Quote comparison basis is not confirmed")],
    });
  }
  return prep.sort((a, b) => a.priority - b.priority).slice(0, 3).map((item, index) => ({ ...item, priority: index + 1, evidenceTrace: clone(item.evidenceTrace) }));
}

export function buildTradeDealViewModel(opportunity, engine) {
  const structure = buildTradeDealStructure(opportunity, engine);
  return { structure, negotiationPrep: buildNegotiationPrep(opportunity, engine, structure) };
}
