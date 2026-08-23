# Domain Review Interview 002 — Sanctions / KYC Gate

> **狀態**：DRAFT — 尚未排程（owner 決定後執行；來源：RECORD_DEF_2026-08-23 案例 E）。
> **核心問題**：制裁/KYC/AML 合規是否應升為 A gate（一票否決）？現有 contract 完全無此維度。
> **目標**：收集 Part E 證據，不預設 TODO、不修改 contract。

---

## A. Pre-registration（訪談前填寫）

| 欄位 | 內容 |
|---|---|
| 訪談日期 | |
| 對象 profile | 集團財務＆風控總管（案例 E 同型）或合規/風控領域業者 |
| **H1**：預測制裁/KYC 被判定為 A gate | 是——「公司能不能活」層級，一票否決 |
| **H2**：預測會指名哪些支撐變數 | 制裁名單比對 · 最終受益人 KYC · AML · 交易銀行接納度 |
| **H3**：預測被歸為 C 桶的 | 關係銀行 discretion（灰色地帶客戶的處理） |
| contract 涵蓋 | 8 維度（不含合規） |

---

## B. 訪談腳本

### 開場框定

> 「我們在測試海外商機決策支援原型。一位集團風控總管說：制裁/資金背景審核是『公司能不能
> 活的問題，利潤再高都沒用』。我們想驗證這個判斷該不該變成系統的硬性卡點。」

### Q1 — No-Go 環節

> 「在決定要不要追一筆海外單時，KYC/制裁審核在哪一個環節介入？是接單前、報價前、
> 還是簽約前？」

追問：
- 「若對方無法提供最終受益人資料，你是直接不談，還是先談著等資料？」
- 「中信保願意承保，是否可作為 KYC 的替代驗證？」（E 案例：可保性與 KYC 的關係）

### Q2 — 是否升級為 A gate

> 「這個審核應該成為系統的 **A gate（硬性卡點）** 嗎？——制裁命中直接 DO_NOT_PURSUE，
> 連條件式都不給？」

追問：
- 「若系統資料不足（KYC 未完成），你希望是 HOLD（等資料）還是 DO_NOT_PURSUE？」
- 「gate 的『資料來源』該由誰維護——人工查核、外部服務、還是兩者？」

### Q3 — Gate 所需資料變數

> 「要支撐這個 gate，需要哪幾個具體變數？例如 **Sanctions List Match**、**Beneficial
> Owner Verified**、**AML Clearance**——您認為還缺什麼？這些在詢價階段拿得到嗎？」

### Q4（邊界檢驗）

> 「合規 gate 與毛利 gate 若同時存在，優先序該如何？——毛利低但有合規 vs 合規不過但
> 毛利超高，系統該先看哪一個？」

---

## C. 記錄表 / D. 分類比對 / E. 產出 gate

（沿用 DOMAIN_REVIEW_PROTOCOL Part C/D/E 格式——訪談後填寫。）

---

## F. 禁止清單

- ✗ 訪談前新增合規維度或任何 contract 變更
- ✗ 把單一受訪者意見當 consensus
- ✗ 訪談後未經 owner/Codex review 即宣稱 Level 3

---

## G. 收尾

**訪談產出 = 證據，不是 TODO。** 本文件只收集證據；Sanctions/KYC gate 是否落地、
優先序如何，由 owner/Codex 在訪談後裁定。
