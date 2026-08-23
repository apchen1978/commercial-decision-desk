# EXPERIMENT CHARTER — Channel Price Discipline Gate（Level 3 candidate）

> **STATUS: PROPOSAL — awaiting owner confirmation. NOT approved for execution.**
> **No engine change, no deployment, no production data until this charter is confirmed.**
> **Repo identity**: apchen1978/commercial-decision-desk · branch `main`
> **Date**: 2026-08-23 · **Author**: DSH (proposal for owner/Codex review)

---

## 1. Capability（本次要建立的證據能力）

Engine 能否把「**渠道守價（channel price discipline）**」表示為一票否決 gate：
若買家被識別為亂價傾銷風險（不配合市場最低售價），→ `DO_NOT_PURSUE`，
與既有 KYC/Margin gate 同構、同優先鏈。**不發明守價規則**——觸發語意由
caller 宣告（比照 Margin gate 的 threshold-discipline）。

Domain 來源：RECORD_DEF 案例 D（品牌代理操盤）——「就算現金全款買斷，
我照樣拒絕；賺一單短期利潤毀一整盤長期市場」。單一來源，PROVISIONAL —
NOT DOMAIN CONSENSUS。

## 2. Success criteria（實驗通過才算成功）

- [ ] Synthetic boundary experiment（~10 cases）10/10 PASS，pre-registered H1–H6
- [ ] 觸發語意可用**現有 primitive 表示**（結構化 field + veto check；無新 state/
      無新依賴/無新 gate 語意），或證明需要的最小新增
- [ ] 與既有 gate 鏈一致：sanctions > margin > **channel-price** > KYC-incomplete
      > 既有 rules（或實驗證明應有的優先序）
- [ ] `verify.mjs` 維持 ≥50/50 無回歸；matrix 維持 21 scenarios 無回歸
- [ ] 產出 evidence record（verdict A/B/C）+ charter 回顧

## 3. Failure criteria（任一即停）

- [ ] 守價語意無法以現有 contract 表達（需新 decision state / 新依賴）
- [ ] 單一來源（D）不足以定義觸發語意，且無法用 caller-declared 規則表達
- [ ] 與既有 gate 鏈衝突或產生不可消解的優先序歧義
- [ ] clean-input 行為回歸（任何現有 scenario/verify 由 PASS 變 FAIL）
- [ ] 任何需要 production data 或真實客戶資訊的誘因出現

## 4. Scope（明確的內/外）

**IN**（本次授權後才做）：
- `scenario-test/channel-price-experiment.mjs`（in-memory harness，additive variant）
- `scenario-test/outputs/channel-price-*.json/txt`（raw evidence）
- `docs/interviews/EXPERIMENT_CHANNEL_PRICE_001.md`（evidence record + verdict）
- 若 verdict B 且 **owner 另案授權**：最小 production gate 實作

**OUT**（本次不做）：
- ✗ production engine 修改（除非 verdict B 後另案授權）
- ✗ 部署 / production data / 真實客戶
- ✗ CDD V2 / UI / 新 dependencies / 新 decision states
- ✗ Level 3 宣稱（實驗維持 LEVEL 2；DOMAIN REVIEWED 需樣本達標，非本次）
- ✗ 其他 A 桶候選（中信保可保性 / 溝通成本）——不在本 charter

## 5. Rollback

- **Experiment 階段**（無 engine 變更）：rollback = 刪除 harness + outputs +
  record（全部為新增文件，無既有檔案被改）。
- **實作階段**（若另案授權）：比照 KYC gate 前例——單一 commit 可 revert
  （`git revert`），回到 `62042cb` 後、`e1a8924` 前的 engine 狀態。
- **任何時刻**：verify.mjs 50/50 + matrix 21 scenarios 為回歸紅線。

## 6. Repo / files 預計修改

**Repo**: `commercial-decision-desk`（僅此一個；paul-os 僅 WORKLOG 記錄）

| 階段 | 檔案 | 動作 |
|---|---|---|
| Experiment | `scenario-test/channel-price-experiment.mjs` | 新增 |
| Experiment | `scenario-test/outputs/channel-price-results.raw.json` + `run-log.txt` | 新增 |
| Experiment | `docs/interviews/EXPERIMENT_CHANNEL_PRICE_001.md` | 新增 |
| Implementation* | `decision-engine.js`（+channel-price gate check） | 修改（另案授權） |
| Implementation* | `verify.mjs`（+regression）· `run-scenarios.mjs`（S20+）· README | 修改（另案授權） |
| 全程 | `paul-os/outputs/WORKLOG.md` | 記錄 |

\* 實作階段僅在 verdict B + owner 另案授權後執行。

---

**待 owner 確認項目**：① 本 charter 全案；② gate 對象（主提案 channel-price；
或替換為中信保可保性 gate——結構不變）；③ 優先序假設（sanctions > margin >
channel-price > KYC-incomplete）是否先行採納為實驗假設。
