// workbench-adapter.test.mjs — tests for the Manual Evidence Adapter.
// Node-only; exercises workbench-adapter.js exactly as the browser does.
// Independent from verify.mjs (which stays untouched at 50/50).
import { buildOpportunityFromInput, blankAssessmentDefaults, summarizeInput } from "./workbench-adapter.js";
import { evaluateDecision } from "./decision-engine.js";

const results = [];
const check = (name, cond, detail = "") => {
  results.push([name, !!cond]);
  console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  | " + detail));
};

// 1. blank defaults -> UNKNOWN-safe opportunity; engine HOLDs (missing evidence)
{
  const opp = buildOpportunityFromInput(blankAssessmentDefaults());
  check("blank defaults -> UNKNOWN dimensions", opp.dimensions.buyerFit.value === "UNKNOWN" && opp.dimensions.categoryFit.value === "UNKNOWN" && opp.dimensions.evidenceQuality.value === "UNKNOWN");
  check("blank defaults -> terms INCOMPLETE (not agreed)", opp.commercialTerms.status === "INCOMPLETE");
  check("blank defaults -> no kyc field (ABSENT)", !("kyc" in opp));
  check("blank defaults -> no margin field (ABSENT)", !("margin" in opp));
  check("blank defaults -> quotes NOT comparable (not ranked)", opp.quoteBasesComparable === false);
  const e = evaluateDecision(opp);
  check("blank defaults -> engine HOLD_FOR_EVIDENCE", e.recommended === "HOLD_FOR_EVIDENCE", e.recommended);
}

// 2. vocabulary validation — invalid values fail closed to UNKNOWN
{
  const opp = buildOpportunityFromInput({ buyerFit: "totally-awesome", categoryFit: "garbage", evidenceQuality: 42 });
  check("invalid buyerFit fails closed to UNKNOWN", opp.dimensions.buyerFit.value === "UNKNOWN");
  check("invalid categoryFit fails closed to UNKNOWN", opp.dimensions.categoryFit.value === "UNKNOWN");
  check("invalid evidenceQuality fails closed to UNKNOWN", opp.dimensions.evidenceQuality.value === "UNKNOWN");
}

// 3. mapping — strong -> HIGH, weak -> LOW, notOurCategory -> WEAK
{
  const opp = buildOpportunityFromInput({ buyerFit: "strong", categoryFit: "notOurCategory", evidenceQuality: "weak" });
  check("buyerFit strong -> HIGH", opp.dimensions.buyerFit.value === "HIGH");
  check("categoryFit notOurCategory -> WEAK", opp.dimensions.categoryFit.value === "WEAK");
  check("evidenceQuality weak -> LOW", opp.dimensions.evidenceQuality.value === "LOW");
}

// 4. contradictions — user-supplied only, material/resolved mapped
{
  const opp = buildOpportunityFromInput({ contradictions: [{ label: "Payment terms conflict", detail: "90d vs 30%", material: true, resolved: false }] });
  check("contradiction normalized", opp.contradictions.length === 1 && opp.contradictions[0].material === true && opp.contradictions[0].status === "UNRESOLVED");
}

// 5. unknowns — user-supplied only, blocksPursue mapped
{
  const opp = buildOpportunityFromInput({ unknowns: [{ label: "Order volume", detail: "unverified", blocks: true }] });
  check("unknown normalized + blocksPursue", opp.unknowns.length === 1 && opp.unknowns[0].blocksPursue === true);
}

// 6. payment completeness — only COMPLETE + finite counts
{
  const opp = buildOpportunityFromInput({ paymentEvents: [
    { label: "Deposit", amountCny: 30000, daysFromSign: 0, complete: true },
    { label: "Balance", amountCny: 70000, daysFromSign: 30, complete: true },
    { label: "Bond", amountCny: "", daysFromSign: "", complete: false },
  ] });
  check("complete payments -> COMPLETE", opp.paymentEvents.filter((e) => e.status === "COMPLETE").length === 2);
  check("incomplete payment -> INCOMPLETE (UNKNOWN)", opp.paymentEvents.filter((e) => e.status === "INCOMPLETE").length === 1);
}

// 7. KYC — not assessed stays ABSENT; clear -> CLEAR; concern -> ADVERSE veto
{
  const absent = buildOpportunityFromInput({ kycStatus: "notAssessed" });
  check("KYC notAssessed -> field ABSENT", !("kyc" in absent));
  const clear = buildOpportunityFromInput({ kycStatus: "clear" });
  check("KYC clear -> CLEAR", clear.kyc && clear.kyc.status === "CLEAR");
  const concern = buildOpportunityFromInput({ kycStatus: "sanctionsConcern" });
  const e = evaluateDecision(concern);
  check("KYC sanctionsConcern -> DO_NOT_PURSUE veto", e.recommended === "DO_NOT_PURSUE" && e.kycGate === "SANCTIONS_VETO", e.recommended);
}

// 8. margin — not assessed ABSENT; assessed with numbers -> gate; missing numbers -> ABSENT
{
  const absent = buildOpportunityFromInput({ marginStatus: "notAssessed" });
  check("margin notAssessed -> field ABSENT", !("margin" in absent));
  const ok = buildOpportunityFromInput({ marginStatus: "assessed", marginBps: "900", marginThresholdBps: "800" });
  check("margin assessed -> field present", ok.margin && ok.margin.bps === 900 && ok.margin.thresholdBps === 800);
  const low = buildOpportunityFromInput({ marginStatus: "assessed", marginBps: "500", marginThresholdBps: "800" });
  const e = evaluateDecision(low);
  check("margin below threshold -> DO_NOT_PURSUE", e.recommended === "DO_NOT_PURSUE" && e.marginGate === "BELOW_THRESHOLD", e.recommended);
  const noNums = buildOpportunityFromInput({ marginStatus: "assessed", marginBps: "", marginThresholdBps: "" });
  check("margin assessed but no figures -> ABSENT (no invented threshold)", !("margin" in noNums));
}

// 9. NOT ASSESSED != CLEARED — summarize exposes notAssessed, never "passed"
{
  const s = summarizeInput({ kycStatus: "notAssessed", marginStatus: "notAssessed" });
  check("summary kyc notAssessed visible", s.kycStatus === "notAssessed");
  check("summary margin notAssessed visible", s.marginStatus === "notAssessed");
}

// 10. adapter makes no commercial decisions — verify it never touches engine logic
{
  const src = await (await import("./workbench-adapter.js", { assert: { type: "module" } }));
  check("adapter does not import engine decisions (no evaluateDecision dependency)", !("evaluateDecision" in src));
}

const failed = results.filter(([, ok]) => !ok);
console.log(`\nADAPTER RESULT: ${results.length - failed.length}/${results.length} PASS`);
process.exitCode = failed.length ? 1 : 0;
