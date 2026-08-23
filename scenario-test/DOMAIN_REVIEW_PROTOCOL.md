# DOMAIN REVIEW PROTOCOL — Level 3 evidence instrument

> **定位**：CDD evidence maturity 目前為 **LEVEL 2 SCENARIO TESTED**。本 protocol 是通往
> **LEVEL 3 DOMAIN REVIEWED** 的取證工具——讓真正做生意的人指出：哪些變數缺了就做不了
> 這個決策、哪些只是 nice-to-have、哪些根本不該交給系統。
>
> **這不是功能開發清單，不是 bug report 蒐集器。** 受訪者指名一個變數 = 一個 Level 3
> 資料點，不是「加 feature」的指令。

---

## 0. 使用守則（先讀，再動）

1. 訪談前完成 **Part A Pre-registration**（先寫預測，再聽答案）。
2. 訪談中**只記錄，不改引擎、不改 contract**。
3. 訪談後產出 **review record**，交付 owner/Codex review。
4. **絕不**因受訪者指名某變數就加該變數（毛利/匯率/庫存/信用…）。
5. 單一受訪者意見 ≠ domain consensus；樣本數由 owner 決定。
6. 宣稱 LEVEL 3 DOMAIN REVIEWED 的權力在 owner，不在訪談本身。

---

## A. Pre-registration（訪談前填寫）

| 欄位 | 內容 |
|---|---|
| 訪談日期 | |
| 對象 profile（產業/角色/年資/規模，**不記姓名**） | |
| 對象與 CDD 的關係（朋友/客戶/同事/業界） | |
| 對象是否同意此記錄被保留（匿名/合成標記） | |
| **H1**：預測他第一個指名的變數 + 理由 | |
| **H2**：預測前三名變數（含順序）+ 理由 | |
| **H3**：預測會被歸為 C 桶（人類專屬）的變數 | |
| 我們目前的 contract 涵蓋（baseline） | Buyer/Category Fit · Evidence Quality · Commercial Terms · Quote Comparability · Payment Commitment Exposure · Contradictions · UNKNOWNs · Human Decision |

> 命中的預測 → 假設獲得支持；未命中的預測 → 我們的 mental model 需要修正。
> **未命中比命中更有價值。**

---

## B. 訪談腳本

### 開場框定（先講清楚 CDD 是什麼、不是什麼）

> 「我們在做一個 decision-support 原型，回答單一問題：**面對一個海外商機，在目前已知
> 證據下，現在值不值得繼續投入商業資源？** 它不是 ERP，不是完整的貿易作業系統，而且
> 我們刻意不把所有東西塞進去——先證明少數重要變數的判斷邏輯是可靠的，再看真實使用時
> 到底缺哪一層。我想請你用實際做生意的眼光，幫我們檢驗這個問題框架。」

### Q1（主問題——鎖進決策框，不是通用版）

> 「在『要不要繼續追這張海外單』的那一刻，**你一定會看的前三到五個東西**是什麼？」

追問（逐個變數）：

- 「這幾個裡面，**哪一個壞了你就直接不做了**？」→ 候選 **A 桶（gate 變數）**
- 「哪一個只是影響你**怎麼談、怎麼報價**，不會讓你放棄？」→ 候選 **B 桶（deal-structuring）**
- 「哪一個你**就算看到數字也不敢信**、只能憑感覺？」→ 候選 **C 桶（人類專屬）**

### Q2（反問句——抓 C 桶）

> 「有沒有哪個變數，你寧願永遠自己判斷，也不信任何系統給的數字？」

### Q3（負向句——抓 A 桶的漏網之魚）

> 「假設系統給你一個『可以追』的建議，但你心裡知道它**沒看某個東西**——你心裡那個
> 『某個東西』是什麼？」

### Q4（邊界檢驗——檢驗我們的分層假設）

> 「我們的引擎刻意不碰定價、毛利、承諾。你覺得在『要不要追』的那一刻，這是一個合理的
> 分層，還是說毛利根本就是 go/no-go 的一部分？」

---

## C. 記錄表（每個被指名變數一行）

| 變數 | 受訪者原話（逐字） | 本人重要性排序 | 桶 A/B/C | 壞了會怎樣（他的話） | 現有 contract 是否涵蓋 | 訪談者註記 |
|---|---|---|---|---|---|---|
| | | | | | | |

---

## D. 訪談後分類與比對

- **A 桶候選 gate 變數清單**（受訪者指認「壞了就不做」的）
- **B 桶**（明確 out-of-scope for this contract——屬 deal-structuring 層）
- **C 桶**（人類專屬——永不入引擎）
- **與 Pre-registration 比對**：H1/H2/H3 命中哪些、未命中哪些 → 逐項記錄
- **UNKNOWN**：訪談新增哪些 UNKNOWN、保留哪些

---

## E. 產出與 gate（訪談後的決策鏈）

1. **review record**（Part A + C + D 組成一頁記錄）交付 **owner/Codex review**。
2. 決策：某變數是否**值得升為 gate**？——這是**獨立的設計決策**，與訪談本身分開。
3. 若決定升 gate → 依 **FEATURE DEPTH ≠ EVIDENCE DEPTH** 原則定義六欄：
   - claim under test / evidence type / smallest experiment / acceptance criterion /
     limitation to preserve / stop condition
4. 若決定不升 → 記錄為 **documented boundary**（就像 S08/S12 的處理方式）。

---

## F. 禁止清單

- ✗ 訪談後立刻加 Margin / FX / Inventory / Credit 維度
- ✗ 用訪談結果改 portfolio / One-Pager / Capability Brief（Document Parity 規則另評估）
- ✗ 在樣本數達 owner 認可前宣稱 LEVEL 3 DOMAIN REVIEWED
- ✗ 把單一受訪者意見當成 domain consensus
- ✗ 把「他講了 X」變成「加 X」——它只是一個 Level 3 資料點

---

## G. 收尾

**訪談產出 = 證據，不是 TODO。** 受訪者的 challenge 被留下、被分類、被 review——
這本身就是 CDD 走向 LEVEL 3 的第一個自然訊號，而不是引擎改版理由。
