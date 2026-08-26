# EXPERIMENT CHARTER — Decision Ledger（決策複利庫）

> **STATUS: PROPOSAL — awaiting owner confirmation. NOT approved for execution.**
> **No engine change, no deployment, no production data until this charter is confirmed.**
> **Repo identity**: apchen1978/commercial-decision-desk · branch `main`
> **Date**: 2026-08-25 · **Author**: DSH (proposal for owner/Codex review)

---

## 1. Capability（本次要建立的證據能力）

CDD Workbench 目前評估一次機會 → 產出 recommendation + human decision，但**不留決策歷史**。
Decision Ledger 補上「決策資產」層：

- 每次評估可**匯出決策快照**（JSON：商機、證據摘要、建議、人類決定、備註、時間）
- 一個**純靜態回顧頁**可讀取多個快照 → 顯示歷次決策的軌跡
- 使用者能回顧：哪些 UNKNOWN 反覆出現、自己的決定模式、與建議的一致/分歧

**無 API key、無 backend、無資料庫、無網路**——快照存本地檔案，回顧頁純讀取。這是
north star「one opportunity → 決策資產」的最小補完，也是 Tradecraft Workbench 系列第一塊。

## 2. Success criteria（實驗通過才算成功）

- [ ] CDD 可匯出結構化決策快照（確定性格式，含 human decision + note + 時間）
- [ ] 純靜態回顧頁可載入 ≥1 個快照並正確渲染（無需 server 邏輯）
- [ ] 快照格式可重跑驗證（同一評估 → 相同快照結構，除 timestamp）
- [ ] `verify.mjs` 維持 ≥50/50 無回歸；matrix 21 scenarios 無回歸
- [ ] 1440px + 390px 無 overflow、0 console errors
- [ ] 產出 evidence record + charter 回顧

## 3. Failure criteria（任一即停）

- [ ] 快照格式無法確定性重建（評估結果與快照不一致）
- [ ] 回顧頁需要 server / persistence / network（違反無 API key 原則）
- [ ] 任何現有 CDD 行為回歸（評估流程 / human decision / 既有測試）
- [ ] 出現需 production data 或真實客戶資訊的誘因

## 4. Scope（明確的內/外）

**IN**（本次授權後才做）：
- `workbench-ledger.js`（快照序列化/匯出邏輯，純 client-side）
- 回顧頁（`ledger.html` 或 CDD 內嵌區段，讀 JSON 檔案）
- `workbench-ledger.test.mjs`（快照格式確定性測試）
- 證據 record（`docs/interviews/EXPERIMENT_DECISION_LEDGER_001.md`）

**OUT**（本次不做）：
- ✗ decision-engine.js 修改（engine 完全 frozen）
- ✗ 任何 persistence / backend / network / API
- ✗ 自動「分析你的決定模式」（回顧頁只呈現，不做 AI 推論）
- ✗ CDD V2 / 新 gates / 新 decision states
- ✗ 部署（除非另案授權）

## 5. Rollback

- 全部為**新增檔案**（`workbench-ledger.js` / `ledger.html` / 測試 / record）——
  rollback = 單一 `git revert`（無既有檔案被改）。
- 紅線：verify 50/50 + matrix 21 scenarios。

## 6. Repo / files 預計修改

**Repo**: `commercial-decision-desk`（僅此一個；paul-os 僅 WORKLOG 記錄）

| 階段 | 檔案 | 動作 |
|---|---|---|
| 全部 | `workbench-ledger.js` | 新增（快照序列化/匯出） |
| 全部 | `ledger.html` + app.js 小改 | 新增/小幅（回顧頁 + 匯出按鈕掛接） |
| 全部 | `workbench-ledger.test.mjs` | 新增 |
| 全部 | `docs/interviews/EXPERIMENT_DECISION_LEDGER_001.md` | 新增 |
| 全程 | `paul-os/outputs/WORKLOG.md` | 記錄 |

**注意**：`index.html`/`app.js` 目前與 Codex 協調暫停修改——若此 charter 通過，需先確認
Codex 的 CDD 動畫工作是否已完成，避免同檔衝突（或匯出按鈕以獨立 `<button>` 掛接最小侵入）。

---

**待 owner 確認項目**：① 本 charter 全案；② 快照存放形式（單一 JSON 檔 vs 每評估一檔）；
③ 是否需先與 Codex 協調 index.html/app.js 的使用時序。
