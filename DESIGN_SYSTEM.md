---
category: implementation
status: draft
owner: design_engineering
---

# AkaAka Design System

## 目的與適用範圍

本文件是 AkaAka frontend 各頁面共同遵循的視覺、版面、互動與可及性指南，先以活動詳情頁作為 reference implementation，再逐步套用到 Events、Profile、Create/Edit Event、Messaging 與其他頁面。

本文件描述頁面與元件如何組合，不取代產品、API、database、security 或 feature 規格。實際 CSS token、元件狀態與工程驗證以 [`akaaka-docs/docs/spec/platform/008-design-tokens-spec.md`](https://github.com/aka-aka-proj/akaaka-docs/blob/main/docs/spec/platform/008-design-tokens-spec.md) 為準；功能行為以 akaaka-docs skill 指向的 canonical specs 為準。

## 設計原則

- Mobile first：先確保窄版手機可讀、可操作，再擴展至 tablet 與 desktop。
- Trust first：狀態、權限、容量、錯誤與安全資訊必須清楚，不以顏色或裝飾掩蓋不確定性。
- 一頁一個主要任務：每個 view 應有一個清楚的 Primary CTA，次要操作不應競爭同等視覺權重。
- Semantic over decorative：優先使用語意 token、邊框、留白與背景對比，避免任意 spacing、顏色與陰影。
- 可及性是基本品質：鍵盤、螢幕閱讀器、觸控與 reduced motion 都必須有可用路徑。

## Layout

| Viewport | 行為 |
|---|---|
| Mobile `< 640px` | 單欄、手機底部導覽列、主要操作保持觸控可及 |
| Tablet `640–1024px` | 以單欄為預設，空間足夠時才增加次要欄位 |
| Desktop `> 1024px` | 可使用雙欄，但主要任務與 Primary CTA 必須明確 |

頁面容器預設最大寬度為 `960px`，左右 padding 必須處理 safe-area。活動詳情頁使用主內容欄加側欄的雙欄結構；手機轉為單欄，標題區後緊接活動速覽卡。

優先使用 canonical spacing token：`4 / 8 / 12 / 16 / 20px`（`--space-1` 至 `--space-5`）。避免為單一畫面新增任意 margin、padding、breakpoint 或絕對定位。

## Typography

字體使用 Inter，fallback 至 system UI。長標題、地點、錯誤文案與雙語文案必須能換行，不得以截斷造成關鍵資訊遺失。

| 語意 | Size / line-height / weight |
|---|---|
| Page title | `24 / 32 / 600` |
| Section title | `18 / 24 / 600` |
| Body | `15 / 22 / 400` |
| Metadata | `13 / 18 / 400` |
| Button / label | `15 / 20 / 600` |

## Color、radius 與 surfaces

- 顏色只能使用 `008-design-tokens-spec.md` 登錄的 semantic token；不得在頁面或元件新增未登錄的硬編碼顏色。
- Primary 只用於主要任務；分享、收藏、行事曆等使用 Secondary；刪除、撤銷與重新產生連結使用 Danger 並附文字說明。
- Small radius 為 `8px`，Medium 為 `12px`；Large `20px` 僅在對應 token 登錄後使用。
- 優先使用背景對比、`1px` border 與 spacing；Card 使用 `--shadow-card`，popover／modal 使用對應 elevation token，避免過度陰影。
- disabled、loading、error、empty 與 permission denied 必須有文字或語意標記，不得只靠顏色。

## Interaction and accessibility

- 每個 view 只有一個視覺上最突出的 Primary CTA；文字必須描述動作或目前狀態。
- icon-only control 必須有可理解的 accessible name；不熟悉的圖示應搭配 visible label。
- 所有 button、link、form control 與其他互動元素至少 `44 × 44px`。
- mutation 在 pending 期間停用，避免重複提交；成功與失敗都提供可辨識的 status。
- dialog、drawer、dropdown 必須有名稱、Escape 關閉、合理 focus movement，且關閉後能回到觸發控制。
- 使用 `:focus-visible`，支援 `prefers-reduced-motion: reduce`，並遵守 WCAG 2.2 AA 對比要求。

## Event Detail reference pattern

活動詳情頁的功能狀態與資料邊界以 event feature specs 為準；本節只定義呈現層級：

1. 標題區先顯示活動標題、類型／安全標籤與可辨識返回控制；長標題可換行。
2. 活動速覽卡集中顯示地點、開始時間、費用、名額與報名截止。容量文案必須區分訪客的「剩餘名額」與主辦人的「已報名」，不得顯示無法證實的數字。
3. Desktop 在速覽卡頂部提供 Primary CTA；Mobile 將報名／登入後報名／外部報名與收藏固定在全域 bottom nav 之上，並保留足夠 bottom padding。
4. 收藏、ICS／Google Calendar、分享與其他工具收合於單一 Action Bar，不與 Primary CTA 使用相同視覺權重。
5. Practice 安全協議在描述前保持可辨識；管理控制與一般參加者動線分開。
6. draft、closed、registration closed、full、success、error、loading 與 permission denied 必須各自有正確文案與可操作／不可操作狀態；permission denied 不得偽裝成 empty state。

## Mobile and PWA

- 正確處理 `env(safe-area-inset-top/right/bottom/left)`，避免內容進入 Dynamic Island、cutout 或手勢區域。
- 使用 dynamic viewport，避免直接以 `100vh` 假設可視高度；鍵盤開啟時表單與錯誤訊息仍須可見、可捲動。
- 固定 bottom action bar 必須位於全域 bottom nav 之上，且內容尾端預留等高空間。
- iOS standalone PWA 的深層頁必須提供至少 `44 × 44px` 的返回控制。
- 驗證至少涵蓋 360px、390px、tablet、desktop，以及 iPhone browser／standalone PWA 與 Android Chrome／PWA。

## Content、i18n 與 privacy

- 新增 UI 文案時，`zh-TW` 與 `en` 必須同批更新，並檢查長度與換行。
- 不以 user ID、database enum 或技術錯誤直接作為使用者文案；使用在地化 label 與可理解 fallback。
- 私人活動與受限內容只依既有 visibility、AuthZ 與 RLS 規則呈現；UI 隱藏不是安全控制。
- 不儲存原始照片；多媒體僅使用允許的外部社群連結。

## Page adoption checklist

- [ ] Mobile-first 單欄流程與 desktop layout 都有明確主要任務。
- [ ] 使用 canonical color、spacing、radius、shadow 與 touch tokens。
- [ ] loading、empty、error、disabled、success 與 permission denied 狀態有文字語意。
- [ ] 所有互動控制達到 `44 × 44px`，且 keyboard／screen reader 可操作。
- [ ] safe-area、dynamic viewport、鍵盤與 bottom nav 不會遮蓋內容。
- [ ] `zh-TW`／`en` 文案同步，長文字與換行已檢查。
- [ ] 已提供對應 Storybook、unit test 或 browser evidence，並標明 viewport、actor state 與未涵蓋範圍。
- [ ] 若改變功能行為，已同步更新 akaaka-docs 的 canonical feature／API／security spec。

## Governance

本文件是 frontend 的設計入口；`008-design-tokens-spec.md` 是 token 數值與工程契約的唯一權威來源。需要新增 token 時先更新 docs repo 的 008，再更新本文件的使用語意，最後在 affected pages 的 component／Storybook／test 中採用。
