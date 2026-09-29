// fx-exposure.test.mjs — expected values are hand-calculated from the inputs.
import assert from "node:assert/strict";
import { opportunity } from "./fixtures.js";
import { assessFx, fxUnknown } from "./fx-exposure.js";

let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks += 1; };
const near = (a, b, tolerance, message) => check(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);
const clone = (v) => JSON.parse(JSON.stringify(v));
const withFx = (patch) => { const o = clone(opportunity); o.fx = { ...o.fx, ...patch }; return o; };
const TODAY = "2026-09-29";

// Sample: USD 264,000 of goods cost is paid in CNY with no hedge. Headroom is 120,000 - 96,000 = 24,000.
const a = assessFx(opportunity, { today: TODAY });
check(a.state === "OPEN" && a.needsAttention && a.hedgeUnknown, "an unhedged cost-currency exposure is open, with the hedge unknown");
check(a.exposed === 264000 && a.unhedged === 264000, "exposure is the goods cost in the cost currency");
check(a.headroom === 24000, "headroom is net contribution minus the owner's reference minimum");
near(a.breakEvenMovePct, (24000 / 264000) * 100, 1e-9, "the move that uses up the headroom");
near(a.moves.find((m) => m.pct === 3).impact, 7920, 1e-6, "a 3% move on 264,000");
near(a.moves.find((m) => m.pct === 5).headroomUsedPct, (13200 / 24000) * 100, 1e-9, "a 5% move uses 55% of the headroom");
check(a.moves.find((m) => m.pct === 10).headroomUsedPct > 100, "a 10% move exceeds the headroom");

// It registers a non-blocking UNKNOWN; currency risk is visible, never a veto.
const unk = fxUnknown(opportunity, { today: TODAY });
check(unk.id === "UNK-FX" && unk.blocksPursue === false && unk.detail.includes("9.1%"), "a non-blocking UNKNOWN that states the break-even move");
check(opportunity.unknowns.some((u) => u.id === "UNK-FX" && u.blocksPursue === false), "the sample fixture registers it");

// Hedging.
const fullHedge = assessFx(withFx({ hedge: "FORWARD", hedgedPct: 100 }), { today: TODAY });
check(fullHedge.state === "HEDGED" && fullHedge.unhedged === 0 && fullHedge.breakEvenMovePct === null, "a full forward hedge leaves nothing open");
check(fxUnknown(withFx({ hedge: "FORWARD", hedgedPct: 100 })) === null, "no UNKNOWN once fully hedged");
const half = assessFx(withFx({ hedge: "FORWARD", hedgedPct: 50 }), { today: TODAY });
check(half.state === "PARTLY_HEDGED" && half.unhedged === 132000, "a 50% hedge leaves half open");
near(half.breakEvenMovePct, (24000 / 132000) * 100, 1e-9, "half the exposure doubles the tolerable move");
const none = assessFx(withFx({ hedge: "NONE", hedgedPct: null }), { today: TODAY });
check(none.state === "OPEN" && none.hedgeUnknown === false && none.hedgedPct === 0, "explicitly no hedge is known, not unknown");
const unknownHedge = assessFx(withFx({ hedge: "UNKNOWN", hedgedPct: 100 }), { today: TODAY });
check(unknownHedge.hedgeUnknown && unknownHedge.unhedged === 264000, "a stated percentage without a stated hedge is not trusted");

// No exposure or too little information.
check(assessFx(withFx({ costCurrency: "USD" })).state === "NO_EXPOSURE", "cost in the quote currency has no exposure");
check(assessFx(withFx({ costSharePct: 0 })).state === "NO_EXPOSURE", "a zero cost share has no exposure");
check(assessFx(withFx({ costSharePct: null })).state === "UNKNOWN", "an unknown cost share is UNKNOWN, not zero");
const bare = clone(opportunity); delete bare.fx;
check(assessFx(bare).state === "NOT_ASSESSED" && fxUnknown(bare) === null, "an opportunity without the field is not assessed");

// Rate age is judged against the caller's date.
check(assessFx(withFx({ asOf: "2026-09-22" }), { today: TODAY }).rateInfo.ageDays === 7, "seven days old");
check(assessFx(withFx({ asOf: "2026-09-22" }), { today: TODAY }).rateInfo.stale === false, "seven days is within the default window");
check(assessFx(withFx({ asOf: "2026-09-21" }), { today: TODAY }).rateInfo.stale === true, "eight days is stale");
check(assessFx(withFx({ asOf: "2026-09-21" }), { today: TODAY, maxRateAgeDays: 14 }).rateInfo.stale === false, "the window is caller-declared");
check(a.rateInfo.dateKnown === false && a.rateInfo.stale === false, "an unknown date is reported as unknown, not as stale");
check(assessFx(withFx({ asOf: "not-a-date" }), { today: TODAY }).rateInfo.dateKnown === false, "an invalid date is unknown");

// Declared rate versus a live reference: cost fixed in CNY at 7.50 is worth more USD at 6.7105.
const ref = assessFx(opportunity, { today: TODAY, reference: { rate: 6.7105, asOf: "2026-09-28", source: "reference" } }).referenceShift;
near(ref.changePct, (7.5 / 6.7105 - 1) * 100, 1e-9, "the declared rate is above the reference by 11.77%");
near(ref.impact, 264000 * (7.5 / 6.7105 - 1), 1e-6, "the extra cost in the quote currency");
check(ref.exceedsHeadroom === true && ref.headroomUsedPct > 100, "the gap alone exceeds the USD 24,000 headroom");
check(assessFx(opportunity, { reference: { rate: 7.5 } }).referenceShift.impact === 0, "an equal reference rate changes nothing");
const cheaper = assessFx(opportunity, { reference: { rate: 8 } }).referenceShift;
check(cheaper.impact < 0 && cheaper.exceedsHeadroom === false, "a higher reference rate makes the cost cheaper, never flagged");
check(assessFx(opportunity, { reference: { rate: 0 } }).referenceShift === null, "an implausible reference is ignored");
check(assessFx(opportunity, { today: TODAY }).referenceShift === null, "no reference, no comparison");

// Without economics there is no headroom to compare with.
const noEcon = clone(opportunity); delete noEcon.economics;
check(assessFx(noEcon).state === "UNKNOWN", "without economics the exposure cannot be sized");

// Purity.
const before = JSON.stringify(opportunity);
assessFx(opportunity, { today: TODAY, reference: { rate: 6.7 } }); fxUnknown(opportunity);
check(JSON.stringify(opportunity) === before, "assessing never mutates the opportunity");

console.log(`FX exposure tests: ${checks}/${checks} PASS`);
