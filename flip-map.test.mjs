// flip-map.test.mjs — checks the flip map against the real engine.
// Expected states are derived from the documented gate order (README "Decision
// rules"), not copied from the module's own output.
import assert from "node:assert/strict";
import { opportunity } from "./fixtures.js";
import { evaluateDecision } from "./decision-engine.js";
import { buildFlipMap } from "./flip-map.js";

let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks += 1; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const state = (o) => evaluateDecision(o).recommended;

const before = JSON.stringify(opportunity);
const map = buildFlipMap(opportunity);
check(JSON.stringify(opportunity) === before, "building the map never mutates the opportunity");
check(JSON.stringify(buildFlipMap(opportunity)) === JSON.stringify(map), "the map is deterministic");
check(map.current === "ESCALATE" && state(opportunity) === "ESCALATE", "the sample starts at ESCALATE (unresolved material contradiction)");

// Upside route follows the gate chain: contradiction, terms, blocking unknowns (volume, payment security), then strong evidence.
const route = map.route;
check(route.steps.map((s) => s.id).join(",") === "CTR-1,terms,UNK-1,UNK-SEC,evidence-strong", "steps follow the engine's priority order");
check(route.steps.map((s) => s.after).join(",") === "HOLD_FOR_EVIDENCE,HOLD_FOR_EVIDENCE,HOLD_FOR_EVIDENCE,PURSUE_CONDITIONALLY,PURSUE_NOW", "state after each step");
check(route.steps.map((s) => s.flips).join(",") === "true,false,false,true,true", "terms and the volume alone change nothing while payment security is open");
check(route.reachedPursueNow && route.stoppedBecause === null, "the route reaches PURSUE_NOW");
check(JSON.stringify(route.steps[0].clears) === JSON.stringify(["CTR-1", "UNK-2"]), "the contradiction step also clears the unknown its resolveWith names");
check(route.steps[0].resolveWith.includes("binding payment terms"), "the step carries the document the case says would resolve it");

// Independent recomputation: build the same patches by hand and ask the engine.
const manual = clone(opportunity);
manual.contradictions = manual.contradictions.map((c) => ({ ...c, status: "RESOLVED" }));
manual.unknowns = manual.unknowns.filter((u) => u.id !== "UNK-2");
check(state(manual) === "HOLD_FOR_EVIDENCE", "hand patch 1 agrees with the engine");
manual.commercialTerms.status = "COMPLETE";
check(state(manual) === "HOLD_FOR_EVIDENCE", "hand patch 2 agrees: UNK-1 still blocks");
manual.unknowns = manual.unknowns.filter((u) => u.id !== "UNK-1");
check(state(manual) === "HOLD_FOR_EVIDENCE", "hand patch 3 agrees: the open receivable still blocks");
manual.unknowns = manual.unknowns.filter((u) => u.id !== "UNK-SEC");
check(state(manual) === "PURSUE_CONDITIONALLY", "hand patch 4 agrees: evidence is only medium");
manual.dimensions.evidenceQuality.value = "HIGH";
check(state(manual) === "PURSUE_NOW", "hand patch 5 agrees");

// The contradiction masks every other single confirmation.
const flipping = map.singles.filter((s) => s.flips).map((s) => s.id);
check(flipping.join(",") === "CTR-1", "only resolving the contradiction changes the state on its own");
check(map.singles.filter((s) => !s.flips).every((s) => s.state === "ESCALATE"), "every other single confirmation leaves ESCALATE in place");

// Adverse findings: each state is the real engine's answer.
const adverse = Object.fromEntries(map.adverse.map((a) => [a.id, a]));
check(adverse["kyc-adverse"].state === "DO_NOT_PURSUE", "an adverse KYC finding vetoes");
check(adverse["kyc-incomplete"].state === "HOLD_FOR_EVIDENCE", "unverified beneficial owner holds");
check(adverse["category-weak"].state === "DO_NOT_PURSUE", "weak category fit stops pursuit");
check(adverse["evidence-low"].changes === false && adverse["evidence-low"].state === "ESCALATE", "low evidence is masked by the open contradiction");
check(adverse["margin-below-threshold"].state === "DO_NOT_PURSUE", "a declared margin threshold that is missed vetoes");

// Economics is presentation-only headroom, never a gate.
const e = map.economics;
check(e.net === 36000 && e.minimum === 28800 && e.gap === 7200, "headroom equals net minus the owner reference minimum");
check(e.gapPctOfRevenue === 5 && e.gapPctOfNet === 20, "headroom percentages are relative to revenue and to net");
check(e.gateActive === false, "without a declared threshold the economics does not gate");
const declared = clone(opportunity);
declared.margin = { bps: 2500, thresholdBps: 2000 };
check(buildFlipMap(declared).economics.gateActive === true, "a declared threshold turns the gate on");
const noEconomics = clone(opportunity);
delete noEconomics.economics;
const noEcon = buildFlipMap(noEconomics);
check(noEcon.economics === null && !noEcon.adverse.some((a) => a.id === "margin-below-threshold"), "no economics means no headroom and no margin scenario");

// Vetoes and reassessments cannot be cleared by evidence inside the tool.
const vetoed = clone(opportunity);
vetoed.kyc = { ...vetoed.kyc, sanctionsHit: true };
const v = buildFlipMap(vetoed);
check(v.current === "DO_NOT_PURSUE" && v.terminal.map((t) => t.id).join() === "kyc-veto", "a sanctions hit is a terminal gate");
check(v.route.steps.length === 0 && v.route.stoppedBecause === "terminal" && v.singles.length === 0, "no route is offered past a veto");
check(!v.adverse.some((a) => a.id === "kyc-adverse"), "an adverse scenario is not repeated when it already holds");
const weakFit = clone(opportunity);
weakFit.dimensions.categoryFit.value = "WEAK";
check(buildFlipMap(weakFit).terminal.map((t) => t.id).join() === "category-weak", "weak category fit needs reassessment, not more documents");

// An already-firm case has nothing to clear but can still be hit by adverse findings.
const firm = clone(opportunity);
firm.contradictions = firm.contradictions.map((c) => ({ ...c, status: "RESOLVED" }));
firm.unknowns = [];
firm.commercialTerms.status = "COMPLETE";
firm.dimensions.evidenceQuality.value = "HIGH";
const f = buildFlipMap(firm);
check(f.current === "PURSUE_NOW" && f.route.steps.length === 0 && f.route.reachedPursueNow, "PURSUE_NOW needs no further confirmation");
check(f.adverse.find((a) => a.id === "kyc-adverse").state === "DO_NOT_PURSUE", "a firm case still falls to a later adverse finding");

// Missing payment events are real data, not something to simulate.
const noPayments = clone(firm);
noPayments.paymentEvents = [];
const np = buildFlipMap(noPayments);
check(np.route.stoppedBecause === "payment-events" && np.route.steps.at(-1).simulable === false, "the route stops where real payment events are needed");
check(!np.route.reachedPursueNow, "it does not claim PURSUE_NOW without payment evidence");

// Weak evidence is lifted to medium first, then to strong.
const weak = clone(firm);
weak.dimensions.evidenceQuality.value = "LOW";
const w = buildFlipMap(weak);
check(w.route.steps.map((s) => s.id).join(",") === "evidence-floor,evidence-strong", "low evidence needs two confirmations");
check(w.route.steps.map((s) => s.after).join(",") === "PURSUE_CONDITIONALLY,PURSUE_NOW", "low evidence first allows a conditional pursue, then the full one");

console.log(`Flip map tests: ${checks}/${checks} PASS`);
