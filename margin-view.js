// margin-view.js — form wiring for the Trade Margin Calculator page.
// Pure presentation: reads form -> calculateMargin (deterministic math) ->
// renders results read-only. Never decides, never invents a threshold.
import { calculateMargin } from "./margin-calculator.js";

const $ = (id) => document.getElementById(id);

const num = (id) => {
  const v = $(id).value.trim();
  return v === "" ? "" : Number(v);
};

function render(r) {
  const bps = r.marginBps;
  const chip = $("r-chip");
  $("r-bps").textContent = bps === null ? "UNKNOWN" : (bps / 100).toFixed(1) + "%";
  $("r-bps").className = "big " + (bps === null ? "unk" : r.thresholdStatus === "BELOW" ? "below" : "ok");
  if (r.thresholdStatus === "BELOW") {
    chip.textContent = "低於你的門檻";
    chip.className = "status-chip below";
  } else if (r.thresholdStatus === "MEETS") {
    chip.textContent = "達到你的門檻";
    chip.className = "status-chip meets";
  } else if (r.thresholdStatus === "NO_THRESHOLD") {
    chip.textContent = "未宣告門檻（只呈現數字）";
    chip.className = "status-chip no";
  } else {
    chip.textContent = "尚缺輸入";
    chip.className = "status-chip no";
  }

  const currency = $("in-currency").value;
  const money = (v) => (v === null || v === undefined ? "UNKNOWN" : `${v.toLocaleString()} ${currency}`);
  const kv = [
    ["有效淨貢獻", money(r.expectedNetContribution)],
    ["有效毛利", bps === null ? "UNKNOWN" : (bps / 100).toFixed(1) + "%"],
    ["成本轉嫁後毛利", r.marginAfterCostShiftBps === null ? "UNKNOWN" : (r.marginAfterCostShiftBps / 100).toFixed(1) + "%"],
    ["總已知成本", money(r.totalKnownCosts)],
    ["收入", money(r.revenue)],
    ["門檻對照", r.thresholdBps === null ? "未宣告" : (r.thresholdBps / 100).toFixed(1) + "%"],
    ["缺口（vs 最低淨貢獻）", r.gap === null ? "UNKNOWN" : money(r.gap)],
  ];
  $("r-kv").innerHTML = kv.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join("");

  const reading = {
    POSITIVE: "解讀：正貢獻——目前估算為正，但這不代表核准、接受訂單或可承諾。",
    BREAK_EVEN: "解讀：打平——目前估算無淨貢獻。",
    NEGATIVE: "解讀：負貢獻——目前估算為負，需由你判斷是否值得。",
    UNKNOWN: "解讀：UNKNOWN——缺關鍵數字，無法計算；不猜測。",
  }[r.reading] || "解讀：UNKNOWN。";
  $("r-reading").textContent = reading + " 門檻與決定皆由你宣告與做出；本工具只呈現確定性計算。";
}

$("btn-calc").addEventListener("click", () => {
  // Optional fields: contingency + minimum are OPTIONAL — blank means 0 / no
  // target (never invented as UNKNOWN for optional lines). Required fields
  // (revenue/direct/trade/deal) blank -> UNKNOWN, not calculated.
  const optional = (id) => {
    const v = $(id).value.trim();
    return v === "" ? 0 : Number(v);
  };
  const result = calculateMargin({
    revenue: num("in-revenue"),
    directCost: num("in-direct"),
    tradeCost: num("in-trade"),
    dealSpecificCost: num("in-deal"),
    contingency: optional("in-contingency"),
    minimumNetContribution: optional("in-min"),
    thresholdBps: num("in-threshold"),
    currency: $("in-currency").value,
  });
  render(result);
});

$("btn-reset").addEventListener("click", () => {
  ["in-revenue", "in-direct", "in-trade", "in-deal", "in-contingency", "in-min", "in-threshold"].forEach((id) => { $(id).value = ""; });
  $("in-currency").value = "USD";
  $("r-bps").textContent = "—";
  $("r-bps").className = "big";
  $("r-chip").textContent = "尚未計算";
  $("r-chip").className = "status-chip no";
  $("r-kv").innerHTML = "";
  $("r-reading").textContent = "";
});
