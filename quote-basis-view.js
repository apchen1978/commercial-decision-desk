// quote-basis-view.js — form wiring for the Quote Basis Ledger page.
// Pure presentation: reads rows -> quoteLedger (deterministic classification) ->
// renders a comparison table. Never ranks incomparable bases, never decides.
import { quoteLedger, INCOTERM_RESPONSIBILITY } from "./quote-basis-ledger.js";

const $ = (id) => document.getElementById(id);

const INCOTERMS = ["", "EXW", "FOB", "CFR", "CIF", "DAP", "DDP"];
const CURRENCIES = ["", "USD", "CNY", "EUR"];

function rowTemplate(idx) {
  const incotermOpts = INCOTERMS.map((t) => `<option value="${t}">${t || "未指定"}</option>`).join("");
  const currencyOpts = CURRENCIES.map((c) => `<option value="${c}">${c || "未指定"}</option>`).join("");
  return `
    <div class="quote-row" data-idx="${idx}">
      <div><label class="field">供應商／報價單號</label><input type="text" class="q-label" placeholder="如：A 供應商 RFQ-01" /></div>
      <div><label class="field">交貨條件</label><select class="q-incoterm">${incotermOpts}</select></div>
      <div><label class="field">幣別</label><select class="q-currency">${currencyOpts}</select></div>
      <div><label class="field">金額</label><input type="number" class="q-amount" placeholder="如 480000" /></div>
      <div><label class="field">有效期限</label><input type="date" class="q-valid" /></div>
      <div><label class="field">備註</label><input type="text" class="q-note" placeholder="如：含檢驗費" /><button type="button" class="del" title="移除這張報價">✕</button></div>
    </div>`;
}

function addRow() {
  const rows = $("quote-rows");
  const idx = rows.children.length;
  rows.insertAdjacentHTML("beforeend", rowTemplate(idx));
  rows.lastElementChild.querySelector(".del").addEventListener("click", () => rows.lastElementChild.remove());
}

function collectQuotes() {
  return [...document.querySelectorAll(".quote-row")].map((row) => ({
    label: row.querySelector(".q-label").value,
    incoterm: row.querySelector(".q-incoterm").value,
    currency: row.querySelector(".q-currency").value,
    amount: row.querySelector(".q-amount").value === "" ? "" : Number(row.querySelector(".q-amount").value),
    validUntil: row.querySelector(".q-valid").value,
    note: row.querySelector(".q-note").value,
  }));
}

function reasonText(reason) {
  return {
    NO_QUOTES: "沒有任何報價可對照。",
    MIXED_BASES: "交貨條件（Incoterm）混用——FOB 與 DDP 的價錢不是同一件事，不能直接比。",
    MIXED_CURRENCIES: "幣別混用——工具不會偷偷換匯率，先統一幣別再比。",
    INCOMPLETE_ENTRIES: "有報價缺關鍵欄位（條件／幣別／金額）——留空的欄位保持 UNKNOWN，不猜測。",
  }[reason] || reason;
}

function money(v, currency) {
  if (v === null || v === undefined) return "UNKNOWN";
  return `${v.toLocaleString()} ${currency}`;
}

function render(r) {
  $("result-card").classList.remove("hidden");
  const chip = $("r-chip");

  // Warn / note block
  const warn = $("r-warn");
  warn.innerHTML = "";
  if (!r.comparable) {
    chip.textContent = "不可直接比價 — 不排名";
    chip.className = "status-chip mixed";
    warn.innerHTML = `<div class="warn"><b>這些報價的基礎不同，不排名。</b><br/>${r.reasons.map(reasonText).join("<br/>")}<br/>做法建議：先與供應商統一交貨條件與幣別（例如都改成 FOB 或都改成 DDP），再回來比。</div>`;
  } else {
    chip.textContent = "條件一致 — 可對照";
    chip.className = "status-chip comparable";
    warn.innerHTML = `<div class="ok-note">交貨條件與幣別一致，價錢可以直接對照。下方的排序<b>僅供參考</b>——最低價 ≠ 最好決定；交期、品質與信任都在你手上。</div>`;
  }

  // Table
  const tableWrap = $("r-table-wrap");
  const rows = r.quotes.map((q) => {
    const resp = q.responsibility
      ? `運費 ${q.responsibility.freight === "SELLER" ? "賣方" : "買方"} · 保險 ${q.responsibility.insurance === "SELLER" ? "賣方" : "買方"} · 關稅 ${q.responsibility.duties === "SELLER" ? "賣方" : "買方"}`
      : "";
    const note = q.note && q.note !== "UNKNOWN" ? `<span class="resp">${q.note}</span>` : "";
    return `<tr>
      <td>${q.label}</td>
      <td>${q.incoterm}${resp ? `<span class="resp">${resp}</span>` : ""}</td>
      <td class="money">${money(q.amount, q.currency)}</td>
      <td>${q.validUntil === "UNKNOWN" ? "UNKNOWN" : q.validUntil}</td>
      <td>${note || "—"}</td>
    </tr>`;
  }).join("");
  tableWrap.innerHTML = `<table>
    <thead><tr><th>報價</th><th>條件／責任範圍</th><th class="money">金額</th><th>有效期限</th><th>備註</th></tr></thead>
    <tbody>${rows}</tbody></table>`;

  const reading = r.comparable
    ? "解讀：條件一致，價錢可比。排序（最低價在前）僅供參考，選哪家由你決定。"
    : "解讀：條件不一致，無法公平比較；本工具不排名、不猜測、不偷偷換匯率。先統一基礎，再重新對照。";
  $("r-reading").textContent = reading + " 本頁只呈現確定性對照；決定與談判在你。";
}

// seed two rows
addRow();
addRow();

$("btn-add").addEventListener("click", addRow);
$("btn-calc").addEventListener("click", () => render(quoteLedger({ quotes: collectQuotes() })));
$("btn-reset").addEventListener("click", () => {
  $("quote-rows").innerHTML = "";
  addRow();
  addRow();
  $("result-card").classList.add("hidden");
});
