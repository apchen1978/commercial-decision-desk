# Channel-Price Gate — Production Implementation Plan（REHEARSAL, design-only）

> **STATUS: PLAN ONLY — awaiting production authorization. No canonical engine
> change applied.**
> **Basis**: `EXPERIMENT_CHANNEL_PRICE_001.md` (verdict B, 10/10) +
> `channel-price-rehearsal.mjs` (12/12 SYNTHETIC / DESIGN-ONLY rehearsal,
> this plan's logic was run as an isolated test-only overlay).
> **Domain validation: NOT EXECUTED** (single source D; production must NOT be
> authorized on synthetic evidence alone).
> **Limits honored in rehearsal**: NO canonical engine change · NO formal
> channelPrice field in decision-engine.js · NO production data · NO Level 3 claim.

---

## 1. Production implementation plan（授權後的最小變更）

### 1.1 `decision-engine.js` — 新增 channel-price gate

**位置**：`evaluateDecision()` 內、margin gate 區塊之後、KYC-incomplete 判斷之前
（優先序：sanctions > margin > channel-price > KYC-incomplete > rules）。

**新增的輸入讀取**（置於 margin gate 附近）：

```js
// Channel-price gate (provisional; caller-declared semantics — engine invents
// no dumping detection, no exception list). Priority: after margin, before KYC.
const cpr = opp.channelPrice || {};
const cpDumping = cpr.status === "DUMPING_RISK" || cpr.dumpingRisk === true;
const cpExceptions = Array.isArray(cpr.exceptions) ? cpr.exceptions : [];
const cpExceptionApplied = cpDumping && cpExceptions.length > 0;
const channelPriceGate = !Object.keys(cpr).length ? "ABSENT" : cpDumping && !cpExceptionApplied ? "DUMPING_RISK_VETO" : cpDumping && cpExceptionApplied ? "EXCEPTION_APPLIES" : "CLEAR";
```

**reasons 區塊**（margin gate 之後）：

```js
if (cpDumping && !cpExceptionApplied) {
  reasons.push(`CHANNEL-PRICE GATE: price-dumping risk under policy "${cpr.policy || "PRICE_FLOOR"}" — one-vote veto; DO_NOT_PURSUE.`);
} else if (cpDumping && cpExceptionApplied) {
  reasons.push(`CHANNEL-PRICE GATE: dumping risk present but caller-declared exception(s) [${cpExceptions.join(", ")}] — veto suppressed; risk surfaced.`);
}
```

**recommendation 鏈**（margin 之後、kycIncomplete 之前插入）：

```js
} else if (cpDumping && !cpExceptionApplied) {
  recommended = "DO_NOT_PURSUE"; // channel-price gate: one-vote veto (3rd priority)
```

**available 表**：`PURSUE_NOW` / `PURSUE_CONDITIONALLY` 條件加
`!(cpDumping && !cpExceptionApplied)`。

**回傳**：加 `channelPriceGate`（與 `kycGate`/`marginGate` 並列）。

### 1.2 `verify.mjs` — 加 regression（~6 條）

- dumping → DO_NOT_PURSUE + gate=DUMPING_RISK_VETO
- clear / absent → pass-through（gate=ABSENT/CLEAR）
- exception（NEW_MARKET）→ veto suppressed（gate=EXCEPTION_APPLIES）
- dumping + sanctions → DNP（source 仍 SANCTIONS）
- dumping + margin-below → DNP（source 仍 MARGIN）
- dumping + KYC-incomplete → DNP（channel-price outranks KYC）

### 1.3 `run-scenarios.mjs` — 加 S20–S22（matrix regression）

- S20 dumping veto · S21 exception（new market）· S22 dumping + KYC conflict
  （tags `SYNTHETIC` + `CHANNEL-PRICE-GATE`）

### 1.4 README — Documented boundaries 加 channel-price gate 段

### 1.5 `channel-price-rehearsal.mjs` — 保留為 pre-implementation 證據（不刪除）

---

## 2. 最小 diff 預覽（decision-engine.js 授權後變更量）

- **新增**：1 個輸入讀取區塊（~6 行）+ 1 個 reasons 區塊（~5 行）+
  recommendation 鏈 1 分支（~2 行）+ available 條件（2 處各加 1 條件）+
  回傳 1 欄位 —— **合計約 15–18 行新增、0 行刪除**。
- 其他檔案（verify.mjs / run-scenarios.mjs / README）：新增內容、無既有行刪除。
- **clean-input 行為**：channelPrice 缺席 → `ABSENT` gate → 完全無影響
  （rehearsal R-02/R-06..R-10 的 base 行為 = production 現況，已驗證）。

## 3. Rollback plan

| 時點 | 動作 |
|---|---|
| 授權前 | 無需 rollback——本 rehearsal 未改任何 canonical 檔案 |
| 授權後、實作 commit 前 | 拒絕執行（未授權） |
| 實作 commit 後 | 單一 `git revert <impl-commit>` 即可完整回滾（比照 KYC/Margin 前例） |
| 回歸紅線 | `verify.mjs` 50/50 + matrix 21 scenarios 不可由 PASS 變 FAIL |

---

## 4. Evidence status（誠實標記）

- **SYNTHETIC RESULT**：rehearsal 12/12 PASS（trigger / exceptions / conflicts /
  reasons 輸出）——證明「若實作此邏輯，行為如預期」。
- **UNKNOWN（未由 domain 證實）**：dumping-risk 的**偵測方式**（誰判斷、憑什麼
  資料）；例外清單是否完整/正確（NEW_MARKET/CLEARANCE/END_USER_SELF_USE 為
  推測，非 domain 共識）；C1–C6 全部 claims。
- **尚需真人決策**：① production 授權（owner）；② domain validation（≥3 受訪者）；
  ③ 例外清單與偵測責任的分工確認。
- **不得**：以 synthetic rehearsal 宣稱 domain consensus；宣稱 Level 3。

## 5. STOP

本 plan 為 rehearse 產物；**production implementation 未授權、未執行**。
等待 owner：① 授權 production 實作；或 ② 先完成 domain validation（真人輸入）。
