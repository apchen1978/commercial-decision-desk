# Domain Validation — Channel Price Discipline Gate（bounded phase）

> **STATUS: NOT EXECUTED / PENDING REAL HUMAN INPUT.** 訪談未執行——不等待、不尋找、
> 不虛構任何受訪者或訪談答案。Part D 記錄表維持空白。**不得以模擬資料宣稱 domain
> consensus。**
> **Owner authorization (2026-08-23)**: 選項② bounded domain-validation phase；
> 後續指令明確：標記「未執行／待真人輸入」，維持 Verdict B。
> **Limits**: 不修改 production engine · 不新增 channelPrice field · 不接 production
> data · 不宣稱 Level 3 · 只產出 interview/evidence record 與更新後 verdict。
> **Verdict rule**: 若仍無 domain consensus → 維持 B 或降為 C 並停止。
> **Repo**: apchen1978/commercial-decision-desk · 引用:
> `EXPERIMENT_CHANNEL_PRICE_001.md`（verdict B, 10/10）· `RECORD_DEF_2026-08-23.md`
> （案例 D）· `DOMAIN_REVIEW_PROTOCOL.md`（取證方法）。

---

## A. 待驗證 Claims（從實驗 + 案例 D 推導，逐項需 domain 輸入）

> **狀態：所有 claims 均 UNKNOWN — 未經真人 domain 證實。** 下列僅為待驗證項目，
> 非已確認事實。

| ID | Claim | 來源 | 需驗證的面向 |
|---|---|---|---|
| C1 | 亂價傾銷是一票否決（veto），而非可協商的風險訊號 | D：「就算現金全款買斷，我照樣拒絕」 | 不同 D 類角色是否同意「無例外 veto」？ |
| C2 | 觸發語意：買家不配合市場最低售價 / 價格傾銷 → `DO_NOT_PURSUE` | 實驗 CP-2 假設 | dumping risk 的**定義與偵測**（誰判斷、憑什麼資料）？ |
| C3 | 例外情境：哪些 case **不該**觸發 veto？（如：新市場無既有定價、一次性出清、下游客戶自用非轉售） | 實驗未覆蓋 | 例外清單是否共識？是否需 caller-declared 例外旗標？ |
| C4 | 優先序：channel-price 高於 KYC-incomplete、低於 sanctions/margin | 實驗 CP-3/4/5 | 實務上亂價 vs 合規 vs 毛利，業者心中的真實優先？ |
| C5 | 偵測責任在 caller/人（engine 只表示已偵測的風險） | 實驗 method note | 業者是否接受「engine 不自動偵測」？ |
| C6 | 其他渠道相關 gate 候選（售後能力、單量穩定性）是否更優先？ | RECORD_DEF D | 受訪者的實際前三優先順序 |

## B. 目標受訪者（至少 3 名不同角色，owner 安排）

| # | 角色類型 | 目的 |
|---|---|---|
| 1 | 品牌代理操盤（D 同型） | 驗證 C1/C2 核心 veto 語意 |
| 2 | 多品牌/多渠道經銷商操盤 | 檢驗 C3 例外情境與 C4 優先序 |
| 3 | 品牌總部/授權管理（渠道秩序負責） | 檢驗 C1 的「整盤價格體系」視角 + C6 候選優先 |

> 每名受訪者匿名記錄（不記姓名/公司）；記錄須受訪者同意保留。

## C. 訪談問題（每名受訪者）

### Q1（veto 必要性 — C1）
> 「假設一個經銷商/客戶在電商亂砍你的市場最低價。就算他一次下超大單、現金全款，
> 你會直接不做這單嗎？還是有任何例外可以談？」

追問：
- 「『亂價』的定義是什麼——低於建議售價多少算？誰來認定？」
- 「有沒有任何情境你會容忍亂價（清庫存、新品促銷、特殊市場）？」（→ C3）

### Q2（觸發語意 — C2）
> 「如果系統要在『這單別追』之前標出『亂價風險』，你希望系統看什麼資料來判斷？
> 還是說這只能靠人盯市場？」

### Q3（優先序 — C4）
> 「如果一個客戶同時有『亂價風險』和『付款條件沒談攏』，你先處理哪個？如果是
> 『亂價風險』和『KYC/合規不過』呢？」（→ 驗證實驗優先鏈假設）

### Q4（例外 — C3）
> 「哪些情況下，就算客戶有亂價紀錄，你還是會考慮合作？」（列清單）

### Q5（engine 角色 — C5）
> 「你接受『系統只在你已經知道有亂價時把它變成硬性卡點、而不是自己去盯市場』
> 這個分工嗎？」

## D. 記錄表（每名受訪者一行）

> **NOT EXECUTED — 待 owner 安排真實受訪者後填寫。禁止虛構。**

| ID | 角色 | C1 同意 veto？ | C2 偵測方式 | C3 例外 | C4 優先序 | C5 分工接受？ | 其他候選 | 原話摘錄 |
|---|---|---|---|---|---|---|---|---|
| (pending) | | | | | | | | |

## E. 判定規則（填滿後套用）

1. **Provisional consensus**：≥2/3 受訪者對 C1/C2/C3 一致，且無重大異議 →
   verdict 可從 B 升為「B+（domain-supported, provisional）」。
   **仍不宣稱 LEVEL 3**（樣本數 + pre-registration 限制）。
2. **無 consensus**（意見分歧、或任一核心 claim 被推翻）→ 維持 B，或依分歧
   嚴重性降為 C（INCONCLUSIVE）並 **STOP — 不進入 production 實作**。
3. **任何階段**：不修改 engine、不新增 field、不接 production data。

## F. 現況 Verdict（2026-08-23，訪談未執行）

**B — EVIDENCE_FOUND_FIX_RECOMMENDED**（實驗 10/10 支持可表示性與優先序；
但僅單一來源 D，production authorization = NO）。
**Domain validation: NOT EXECUTED — PENDING REAL HUMAN INPUT.**
**下一步：owner 安排 ≥3 名受訪者 → 填 Part D → 套用 Part E 判定 → 更新 verdict。
在此之前：不得以模擬資料宣稱 domain consensus。**
