// margin-calculator.js — Trade Margin & Cost Calculator (workbench series block 2).
// Pure deterministic math over the SAME inputs as the CDD economics bridge.
// It does NOT make commercial decisions, does NOT set a universal threshold,
// and never enters evaluateDecision(). The threshold is a caller/owner input;
// the tool only reports whether the figure is below the declared threshold.
import { buildEconomicsBridge, economicsReading } from "./economics-bridge.js";

// Effective margin in basis points of revenue (bps = margin/revenue * 10000).
// Returns null when revenue is missing or zero (no fabrication).
export function marginBps(bridge) {
  if (bridge.calculationStatus !== "CALCULATED") return null;
  if (bridge.revenue === null || bridge.revenue <= 0) return null;
  const margin = bridge.expectedNetContribution / bridge.revenue;
  return Math.round(margin * 10000);
}

// Margin after cost-shift to the supplier (e.g. certification costs the buyer
// pushes onto us). Only meaningful when dealSpecificCost > 0; otherwise the
// same as marginBps. Presentation-only.
export function marginAfterCostShiftBps(bridge) {
  if (bridge.calculationStatus !== "CALCULATED") return null;
  if (bridge.revenue === null || bridge.revenue <= 0) return null;
  const shifted = bridge.expectedNetContribution - (bridge.dealSpecificCost ?? 0);
  return Math.round((shifted / bridge.revenue) * 10000);
}

// Declared-threshold comparison. thresholdBps is OWNER/CALLER input — the tool
// never invents one. Status: "BELOW" / "MEETS" / "NO_THRESHOLD".
export function thresholdStatus(bps, thresholdBps) {
  if (bps === null || bps === undefined) return "NO_FIGURE";
  if (thresholdBps === null || thresholdBps === undefined || thresholdBps === "") return "NO_THRESHOLD";
  return bps < Number(thresholdBps) ? "BELOW" : "MEETS";
}

// Convenience: full calculator view model from raw form input.
// Missing numeric inputs stay UNKNOWN (never fabricated).
export function calculateMargin(input = {}) {
  const bridge = buildEconomicsBridge(input);
  const bps = marginBps(bridge);
  const shiftedBps = marginAfterCostShiftBps(bridge);
  const threshold = input.thresholdBps === "" || input.thresholdBps === null || input.thresholdBps === undefined
    ? null
    : Number(input.thresholdBps);
  return {
    ...bridge,
    marginBps: bps,
    marginAfterCostShiftBps: shiftedBps,
    thresholdBps: threshold,
    thresholdStatus: thresholdStatus(bps, threshold),
    reading: economicsReading(bridge),
  };
}
