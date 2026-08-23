# Domain Review Interview 001 — Margin & Cost Gate

> **狀態**：DRAFT — 尚未進行訪談（Part A 待填）。
> **核心案例**：L3（終端定製設備 / 5% 毛利 / 認證費轉嫁 / 委員會決策）— 引擎壓力測試暴露的
> contract 維度盲區。
> **目標**：收集 **Part E 證據**（Margin 是否應升為 A gate），**不預設 TODO、不修改 contract**。
> **引用**：`DOMAIN_REVIEW_PROTOCOL.md`（Level 3 evidence instrument）· 引擎輸出見
> `cdd-lead-scan.mjs`（S15 基線：`ESCALATE`）。

---

## A. Pre-registration（訪談前填寫）

| 欄位 | 內容 |
|---|---|
| 訪談日期 | |
| 對象 profile（產業/角色/年資/規模，不記姓名） | 資深決策者（Owner / 貿易負責人） |
| 對象與 CDD 的關係 | Owner |
| 對象是否同意記錄保留 | |
| **H1**：預測受訪者對「5% 毛利 + 認證費轉嫁」的第一反應 | 直接判 No-Go（毛利低於自設閾值） |
| **H2**：預測會指名哪幾個 Margin 相關變數 | Gross Margin Threshold · Compliance Cost Payer · 是否含 freight/customs |
| **H3**：預測會被歸為 C 桶（人類專屬）的變數 | 客戶戰略價值／關係維護（即使毛利低仍追） |
| contract 涵蓋（baseline） | Buyer/Category Fit · Evidence Quality · Commercial Terms · Quote Comparability · Payment Exposure · Contradictions · UNKNOWNs · Human Decision。**不含 Margin** |

> 命中的預測 → 假設獲得支持；未命中 → mental model 需修正。未命中更有價值。

---

## B. 訪談腳本

### 開場框定

> 「我們在測試一個海外商機決策支援原型。上一輪壓力測試跑了一個案例：終端客戶要定製
> 設備，但毛利約 5%、檢驗認證費用要廠商承擔、而且採購決策在客戶總部委員會——聯繫人
> 只是收集報價。系統目前判 `ESCALATE`，因為它偵測到『要求報價卻無決策權』的矛盾。
> 但我們懷疑真正的死因是毛利。想請你用實際做生意的眼光驗證這個判斷。」

### Q1 — No-Go 環節（核心）

> 「面對 L3 這種 **5% 毛利且要求轉嫁認證費用**的案子，您會在哪一個環節直接判定 No-Go？
> ——是看到毛利數字的那一刻？是知道認證費要自己扛的那一刻？還是要到更後面？」

追問：
- 「如果毛利是 8% 但認證費自己扛，你的答案會變嗎？」
- 「如果毛利 5% 但客戶戰略價值高（長期、量穩），你的答案會變嗎？」→ C 桶偵測

### Q2 — 是否升級為 A gate

> 「這個 No-Go 判斷，是否應該升級為系統的 **A gate（硬性卡點）**？——也就是說，任何
> 低於某門檻的毛利，引擎直接不給 pursuit 建議，連條件式都不行？」

追問：
- 「如果沒有決策權、但毛利有 20%，你希望系統怎麼處理？」（測試 gate 的邊界）
- 「你希望這個 gate 是『硬擋』還是『警示 + 需要人工 override』？」→ 釐清 human-in-the-loop 界線

### Q3 — Gate 所需資料變數

> 「若是要把它變成系統的 gate，我們需要定義哪幾個具體的資料變數來支撐？
> 例如 **Gross Margin Threshold**（毛利門檻值）、**Compliance Cost Payer**（認證/檢驗
> 費用由誰承擔）——您認為還缺什麼？這些數字在真實詢價中是否拿得到？」

追問：
- 「毛利在報價前是否已經可算？還是要等報價後才知道？」→ 可行性證據
- 「若對方不肯揭露成本結構，這個 gate 會退化成 UNKNOWN 嗎？你接受嗎？」

### Q4（邊界檢驗）

> 「我們目前的 contract 刻意不碰定價/毛利。你現在覺得這還是合理分層嗎，還是毛利根本
> 就是 go/no-go 的一部分？」

---

## C. 記錄表（每個被指名變數一行）

| 變數 | 受訪者原話（逐字） | 本人重要性排序 | 桶 A/B/C | 壞了會怎樣（他的話） | 現有 contract 是否涵蓋 | 訪談者註記 |
|---|---|---|---|---|---|---|
| Gross Margin Threshold | | | A？ | | 否 | |
| Compliance Cost Payer | | | A？ | | 否 | |
| （受訪者指名其他） | | | | | | |

---

## D. 訪談後分類與比對

- **A 桶候選**：受訪者確認的 Margin gate 變數
- **B 桶**：受訪者認為屬 deal-structuring（報價後才影響）的
- **C 桶**：受訪者表示「永遠自己判斷」的（如戰略價值）
- **與 Pre-registration 比對**：H1/H2/H3 命中/未命中
- **UNKNOWN**：新增（如「對方不揭露成本結構」）與保留

---

## E. 產出與 gate（訪談後決策鏈）

1. **review record**（Part A + C + D）交付 owner/Codex review。
2. 決策：**Margin 是否升為 A gate**——獨立的設計決策，與訪談分開。
3. 若升 gate → 依 FEATURE DEPTH ≠ EVIDENCE DEPTH 定義六欄：
   - **claim under test**：L3 類案例（5% 毛利 + 成本轉嫁）應得 DO_NOT_PURSUE，而非 ESCALATE
   - **evidence type**：domain review（LEVEL 3）→ 達成後 engine scenario（LEVEL 2 回歸）
   - **smallest experiment**：新增 margin 維度 + 單一 gate 規則 + 更新 S15 基線
   - **acceptance criterion**：S15 預期狀態由 ESCALATE 轉為 DO_NOT_PURSUE，既有 14 案例不變
   - **limitation to preserve**：毛利為輸入估算，非系統保證；gate 僅在輸入明確時觸發
   - **stop condition**：訪談樣本不足、或受訪者判定 No-Go 屬 C 桶（人工專屬）
4. 若不升 gate → 記錄為 **documented boundary**（S08/S12 同款處理）。

---

## F. 禁止清單

- ✗ 訪談前修改 contract / 加 Margin 維度
- ✗ 用訪談結果改 portfolio / One-Pager / Capability Brief
- ✗ 單一訪談即宣稱 LEVEL 3 DOMAIN REVIEWED
- ✗ 把「受訪者說毛利重要」變成「立即加 Margin gate」——先完成 review record
- ✗ 預設「No-Go 必須進引擎」——受訪者可能判定屬 C 桶

---

## G. 收尾

**訪談產出 = 證據，不是 TODO。** 本文件只負責收集證據；「Margin gate 是否落地」是
訪談後由 owner/Codex 決定的獨立設計決策。若落地，S15 從 `ESCALATE` → `DO_NOT_PURSUE`
將成為衡量 AI 決策進化的鐵證。
