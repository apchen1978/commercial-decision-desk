// lead-scan-source.mjs — scan three inbound-lead emails through the CDD contract.
// Evidence-first: no opinion before the engine speaks. In-memory fixtures only;
// nothing is written to the repo. SYNTHETIC ANALYSIS — emails treated as
// anonymized test material, no real identifiers, no real commercial data.
//
// RUNNABLE archived source (canonical copy of cdd-lead-scan.mjs, commit fbe8548):
//   node lead-scan-source.mjs   (run FROM scenario-test/ — import resolves to ../decision-engine.js)
import { evaluateDecision, paymentExposure } from "../decision-engine.js";

// ---------------------------------------------------------------------------
// Pre-declared reading (before running) — what the contract SHOULD say per the
// 8 hard rules + evidence-first priority chain.
// ---------------------------------------------------------------------------
const EXPECTED = {
  L1: {
    recommended: "HOLD_FOR_EVIDENCE",
    why: "Evidence Quality LOW (all claims self-asserted, nothing verified) + blocking UNKNOWN: $2M annual volume unverified; buyer-switch reason unknown; OA-90 is a payment-term risk signal, not verified credit.",
  },
  L2: {
    recommended: "HOLD_FOR_EVIDENCE",
    why: "Blocking UNKNOWN: A-302 drawings/BOM not yet provided (spec unknown); urgency + referral give MEDIUM evidence but the object being quoted is UNKNOWN until drawings arrive. Category fit of 'A-302 零組件' itself unconfirmed.",
  },
  L3: {
    recommended: "HOLD_FOR_EVIDENCE",
    why: "Evidence Quality LOW (spec unconfirmed with end user, budget vague, authority sits with client HQ committee — this is a price-discovery inquiry) + no decision authority at the contact point. NOTE: 5% margin + certification-cost shift is a REAL-WORLD go/no-go signal the contract has no dimension for — expected to be missed by the engine.",
  },
};

// ---------------------------------------------------------------------------
// Fixtures — anonymized transcription of the three emails.
// ---------------------------------------------------------------------------
const L1 = {
  id: "LEAD-EU-DIST",
  synthetic: true,
  name: "EU distributor — full-line quote request (anonymized test)",
  dimensions: {
    buyerFit: { value: "MEDIUM", evidence: [{ tier: "SUPPORTING", note: "Self-identified EU distributor, switching suppliers (anonymized)." }] },
    categoryFit: { value: "HIGH", evidence: [{ tier: "PRIMARY", note: "Requests full product line, standard spec — core category." }] },
    evidenceQuality: { value: "LOW", evidence: [{ tier: "SUPPORTING", note: "All claims self-asserted; volume $2M, OA-90 terms, switching reason all unverified." }] },
    importOpenness: { value: "HIGH", evidence: [{ tier: "PRIMARY", note: "Cross-border purchase request, EU destination." }] },
    commercialFeasibility: { value: "CONDITIONAL", evidence: [{ tier: "SUPPORTING", note: "OA 90 days standard terms — payment risk unverified." }] },
  },
  contradictions: [],
  unknowns: [
    { id: "UNK-1", label: "Annual purchase volume ($2M)", detail: "Self-asserted; unverified.", blocksPursue: true, resolveWith: "Verified volume / PO history" },
    { id: "UNK-2", label: "Reason for switching supplier", detail: "Unknown — price-driven switch is a risk signal.", blocksPursue: false, resolveWith: "Buyer's switch motivation" },
    { id: "UNK-3", label: "Creditworthiness under OA-90", detail: "No credit history; OA-90 = 90-day payment exposure.", blocksPursue: true, resolveWith: "Credit check / payment terms negotiation" },
  ],
  whyNot: ["OA-90 payment exposure with unverified buyer credit", "$2M volume unverified", "Switch reason unknown (possible price-shopping)"],
  why: ["Core category, full-line standard product", "Clear import intent"],
  commercialTerms: { status: "INCOMPLETE", detail: "OA 90 days stated as standard; volume and pricing basis not yet negotiated." },
  quotes: [],
  quoteBasesComparable: true,
  paymentEvents: [],
  buyers: [{ id: "B1", label: "EU distributor (anonymized)" }],
  paymentDisclosure: "Payment exposure is calculated from committed payment events only.",
};

const L2 = {
  id: "LEAD-REF-A302",
  synthetic: true,
  name: "Industry-referred urgent A-302 component need (anonymized test)",
  dimensions: {
    buyerFit: { value: "HIGH", evidence: [{ tier: "SUPPORTING", note: "Industry referral; production line at risk; named component." }, { tier: "SUPPORTING", note: "Urgent deadline (CE testing before Q4 sales window)." }] },
    categoryFit: { value: "MEDIUM", evidence: [{ tier: "SUPPORTING", note: "A-302 component — category relevance unconfirmed until drawings arrive." }] },
    evidenceQuality: { value: "MEDIUM", evidence: [{ tier: "SUPPORTING", note: "Referral + urgent production need." }, { tier: "VERIFICATION_REQUIRED", note: "Drawings/BOM promised as attachment — not yet received; 500-sample quantity and feasibility unverified." }] },
    importOpenness: { value: "HIGH", evidence: [{ tier: "PRIMARY", note: "Explicit cross-border request with deadline." }] },
    commercialFeasibility: { value: "CONDITIONAL", evidence: [{ tier: "SUPPORTING", note: "30% T/T + balance before shipment is acceptable; delivery deadline is a hard condition." }] },
  },
  contradictions: [],
  unknowns: [
    { id: "UNK-1", label: "A-302 drawings / BOM", detail: "Promised as attachment, not received — the object being quoted is UNKNOWN.", blocksPursue: true, resolveWith: "Receive drawings + BOM" },
    { id: "UNK-2", label: "500-sample feasibility by Sep 15", detail: "Whether 500 samples fit capacity + certification timeline is UNKNOWN.", blocksPursue: true, resolveWith: "Capacity + timeline check" },
    { id: "UNK-3", label: "CE certification requirements", detail: "Which standard, who bears cost — UNKNOWN.", blocksPursue: false, resolveWith: "Certification spec" },
  ],
  whyNot: ["Drawings/BOM not yet provided — spec unknown", "Hard deadline may be infeasible"],
  why: ["Industry referral (warmer than cold)", "Production line at risk = genuine need", "Acceptable payment terms (30% T/T + balance)"],
  commercialTerms: { status: "INCOMPLETE", detail: "Payment acceptable; delivery deadline is a hard, time-bound condition." },
  quotes: [],
  quoteBasesComparable: true,
  paymentEvents: [],
  buyers: [{ id: "B1", label: "Industry-referred manufacturer (anonymized)" }],
  paymentDisclosure: "Payment exposure is calculated from committed payment events only.",
};

const L3 = {
  id: "LEAD-CUST-EQ",
  synthetic: true,
  name: "End-customer custom-equipment inquiry via intermediary (anonymized test)",
  dimensions: {
    buyerFit: { value: "LOW", evidence: [{ tier: "SUPPORTING", note: "Contact is an intermediary collecting supplier data; decision authority sits with client HQ committee." }] },
    categoryFit: { value: "MEDIUM", evidence: [{ tier: "SUPPORTING", note: "Custom equipment — category fit unconfirmed, spec still with end user." }] },
    evidenceQuality: { value: "LOW", evidence: [{ tier: "SUPPORTING", note: "Spec unconfirmed, budget vague, margin/cost claims self-asserted." }] },
    importOpenness: { value: "MEDIUM", evidence: [{ tier: "SUPPORTING", note: "Cross-border, but no specifics." }] },
    commercialFeasibility: { value: "LOW", evidence: [{ tier: "SUPPORTING", note: "5% margin + certification costs on supplier = economically thin; budget 'tight'." }] },
  },
  contradictions: [
    { id: "CTR-1", label: "Authority vs commitment", detail: "Contact says decision rests with client HQ committee while requesting a quote — no authority at the contact point.", material: true, status: "UNRESOLVED", resolveWith: "Confirm decision authority / commitment level" },
  ],
  unknowns: [
    { id: "UNK-1", label: "Specification", detail: "Still being confirmed with end user — the object is UNKNOWN.", blocksPursue: true, resolveWith: "Final spec from end user" },
    { id: "UNK-2", label: "Budget / commitment", detail: "'Budget tight', committee decides — price-discovery risk.", blocksPursue: true, resolveWith: "Budget band + decision authority" },
  ],
  whyNot: ["No decision authority at contact point (committee elsewhere)", "5% margin + certification costs on supplier = thin economics", "Spec unconfirmed — quote would be a guess"],
  why: ["Potential custom-equipment volume if spec lands"],
  commercialTerms: { status: "INCOMPLETE", detail: "5% margin, certification costs on supplier, budget tight — economically marginal." },
  quotes: [],
  quoteBasesComparable: false,
  paymentEvents: [],
  buyers: [{ id: "B1", label: "Intermediary / client HQ committee (anonymized)" }],
  paymentDisclosure: "Payment exposure is calculated from committed payment events only.",
};

// ---------------------------------------------------------------------------
// Run the contract.
// ---------------------------------------------------------------------------
for (const [id, opp, exp] of [
  ["L1", L1, EXPECTED.L1],
  ["L2", L2, EXPECTED.L2],
  ["L3", L3, EXPECTED.L3],
]) {
  const e = evaluateDecision(opp);
  const x = paymentExposure(opp.paymentEvents);
  console.log(`\n===== ${id} =====`);
  console.log(`EXPECTED : ${exp.recommended} (${exp.why})`);
  console.log(`ACTUAL   : ${e.recommended}`);
  console.log(`available: NOW ${e.available.PURSUE_NOW} | COND ${e.available.PURSUE_CONDITIONALLY} | HOLD ${e.available.HOLD_FOR_EVIDENCE} | ESC ${e.available.ESCALATE} | DNP ${e.available.DO_NOT_PURSUE}`);
  console.log(`exposure : computed=${x.computed}${x.computed ? ` total=${x.totalCommittedCny}` : ` reason=${x.reason}`}`);
  console.log(`invalidDims: ${JSON.stringify(e.invalidDimensions)}`);
  console.log(`reasons:`);
  e.reasons.forEach((r) => console.log(`   - ${r}`));
}
console.log("\nDONE — SYNTHETIC analysis only. No repo changes, no real identifiers.");
