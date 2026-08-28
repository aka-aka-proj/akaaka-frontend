---
category: implementation
status: active
owner: design_engineering
---

# AkaAka Design System

本文件是 `akaaka-frontend` 的 normative UI contract，供人類工程師與 LLM coding agent 使用。它定義跨頁面的設計語意、實作限制、元件重用決策與 visual verification；不重新定義產品功能、API、AuthZ、RLS、database 或 business logic。

## 文件邊界與權威順序

### Authority by concern

不同文件負責不同問題。若規則在同一責任範圍內衝突，必須停止猜測並修正 authoritative source 或建立 decision record：

1. Security、AuthZ、RLS 與 privacy contract
2. Applicable feature specification 與 product acceptance criteria
3. Accessibility specification
4. 本文件的 global design rules
5. Design-token 與 shared-component implementation specification
6. Existing implementation

`Existing implementation is not an authoritative specification.` 程式碼目前的樣子不能覆蓋明確的 security、feature、accessibility 或 design-system contract。若 token 數值與本文件的語意描述有衝突，`docs/spec/platform/008-design-tokens-spec.md` 對實際 token 數值具有唯一權威；本文件只描述如何使用該 token。

### Repository boundaries

- 本文件：frontend page pattern、layout、interaction、responsive、mobile/PWA、accessibility 與驗證 workflow。
- [`akaaka-docs/docs/spec/platform/008-design-tokens-spec.md`](https://github.com/aka-aka-proj/akaaka-docs/blob/main/docs/spec/platform/008-design-tokens-spec.md)：CSS token inventory、實際 token 數值、shared-component state contract 與工程驗證要求。
- akaaka-docs 的 feature／API／security／database／platform specs：產品行為、資料契約、權限、資料保存與平台邊界。

UI change 若涉及功能行為，MUST 先或同步更新 akaaka-docs 的相關 canonical spec。UI 隱藏不是 security control；frontend 不得以視覺需求改變 permission behavior。

## Global design principles

- **Mobile first**：先完成窄版手機的可讀性與可操作性，再擴展至較寬 viewport。
- **Trust first**：狀態、權限、容量、錯誤與安全資訊 MUST 清楚呈現，不得以裝飾掩蓋不確定性。
- **Semantic over decorative**：MUST 優先使用 semantic token、背景對比、border 與 spacing；不得用 arbitrary value 繞過 design-system gap。
- **Accessibility is baseline quality**：keyboard、screen reader、touch、reduced motion 與可見 focus 都是完成條件。
- **One primary task**：有主要任務時，視覺層級 MUST 讓該任務容易辨識；沒有主要任務的 read-only 或 navigation view 不得被迫加入 CTA。

## Layout and responsive semantics

### Breakpoints

Breakpoints 表示 available layout space，不表示 device identity。Layout MUST 主要由 viewport、container width、CSS media/container query 與 feature capability 決定。

| Viewport | Baseline behavior |
|---|---|
| Mobile `< 640px` | 單欄、mobile bottom navigation、操作控制保持觸控可及 |
| Tablet `640–1024px` | 以單欄為預設；僅在空間足夠時加入次要欄位 |
| Desktop `> 1024px` | MAY 使用雙欄或 responsive grid；主要任務不可被次要欄位削弱 |

Implementation MUST NOT 使用 iPhone detection、Android detection、tablet user-agent detection 來決定主要 layout。Browser/platform capability detection 僅可用於必要的 compatibility behavior，不可取代 responsive CSS。

Page container 與 shared layout MUST 使用 canonical layout／spacing token。活動詳情頁目前的 page container 為 `960px`，但其他頁面不得因此被強迫採用活動詳情頁的雙欄結構。

### Spacing

頁面與元件 MUST 使用 `008-design-tokens-spec.md` 登錄的 canonical spacing token。MUST NOT 在 page-local CSS 新增 arbitrary spacing；若需求無法用現有 token 表達：

1. 先確認是否真的是 design-system gap。
2. 記錄新的 semantic requirement。
3. 更新 authoritative token／component spec。
4. 再實作 page implementation。

## Typography architecture

Typography MUST 遵循：

```text
primitive typography token
        ↓
semantic typography token
        ↓
shared component / page
```

頁面與元件 MUST 優先使用 canonical semantic typography token，不得散落 raw `font-size`、`line-height`、`font-weight` 組合來建立相同語意。Inter 與 system UI fallback 是現有 frontend baseline；實際 type token 名稱與數值以 008 或其後續 authoritative spec 為準。

長標題、地點、錯誤文案與 `zh-TW`／`en` 文案 MUST 可換行；不得以截斷造成關鍵資訊遺失。

## Scoped styling architecture

新增 page-local 或 component-local style MUST 優先使用 CSS Modules（`*.module.css`）或 repo 已採用且具等效 scope 的方案。class name MUST 由 module 或明確 page/component root scope 產生；不得新增無 scope 的 element selector 或跨頁面 selector。

`src/App.css` 目前仍承載 legacy/shared styles。既有樣式不要求在本次變更一次性遷移；每次觸碰 component 時 SHOULD 將該 component 的 page-local styles 移至 CSS Module，並移除原本的 App.css 區塊。Global reset、`:root` token、body baseline、focus baseline 與真正跨頁 shared shell styles MAY 留在 global stylesheet。

第一批採用 CSS Module 的 component/page 是 `PageBackButton` 與 `VirtualLoverCreatePage`，其 style 分別位於 `src/components/PageBackButton.module.css` 與 `src/pages/VirtualLoverCreatePage.module.css`，並以 canonical typography、spacing、radius、color 與 touch tokens 組合。後續遷移 MUST 保持 DOM semantics、navigation behavior、i18n 與 accessibility contract 不變。

## Color, radius, elevation and surfaces

- Color、radius、shadow 與 interaction token MUST 來自 008 的 canonical inventory。
- MUST NOT 新增 arbitrary color、radius、shadow 或 breakpoint。
- MUST NOT 以 inline style、SVG attribute 或 JSX style object 繞過 semantic token。
- Surface SHOULD 優先使用背景對比、`1px` border 與 spacing；card、popover、modal 只能使用對應的 elevation token。
- Danger action MUST 使用 danger semantic token，並以文字或語意標記說明風險；不可因為重要就自動變成 Primary。
- disabled、loading、error、empty、success 與 permission denied MUST 有文字或 accessibility semantics，不得只靠顏色。
- Interactive text 與 active-state foreground/background pair MUST 通過 WCAG 2.2 AA 對比要求。

## Interaction and action hierarchy

### Primary action

當 view 存在主要 task-completion action 或主要 mutation 時，同一視覺範圍內 SHOULD NOT 出現超過一個 visually dominant Primary CTA。

- Read-only view 不需要強迫建立 CTA。
- Navigation-heavy view 不一定存在 Primary CTA。
- Secondary action MUST NOT 與 primary action 競爭同等視覺權重。
- Destructive action MUST NOT 因為重要而自動成為 primary action。
- CTA label MUST 描述動作或目前狀態；loading、disabled、closed、permission denied 不得只留下 spinner 或空白。

### Touch and keyboard

- 所有 button、link、form control 與其他 interactive element MUST 達到至少 `44 × 44px` touch target；視覺內容較小時仍須保留操作盒。
- Icon-only control MUST 有可理解的 accessible name；不普遍理解的圖示 SHOULD 同時有 visible label。
- Focus MUST 使用 `:focus-visible`，不得移除唯一 focus indicator。
- Mutation MUST 在 pending 期間防止 duplicate submission，並呈現成功／失敗 status。
- Dialog、drawer、dropdown MUST 有名稱、Escape 關閉、合理 focus movement 與關閉後的 focus return。
- `prefers-reduced-motion: reduce` 時，動畫與 transition MUST 停用或縮短；狀態理解不可依賴動畫。

## Implementation Constraints

除非 task 或 authoritative spec 明確要求，UI implementation MUST NOT：

- 新增未登錄的 design token、arbitrary color、spacing、radius、shadow 或 breakpoint。
- 新增未限定 scope 的 page-specific global CSS。現有 `src/App.css` 是目前 application 的 styling 入口；若必須在其中新增頁面樣式，MUST 使用明確的 page／component class scope，不得新增未限定的 element selector 或跨頁面副作用。
- 修改 API contract、business logic、database schema、AuthZ 或 RLS。
- 以視覺需求作為理由改變 permission behavior。
- 隱藏 error、loading 或 permission state。
- 使用 absolute positioning 解決一般 document layout。
- 使用任意高 z-index 修補未知 stacking issue；必須先找出 stacking context 原因。
- 因 mobile／desktop 差異複製整份 DOM tree，除非 interaction semantics 確實不同。
- 在已有 shared component 可完成需求時建立重複 component。
- 直接 hardcode implementation value 取代 canonical semantic token。

遇到無法表達的需求時，MUST 走「確認 gap → 記錄 semantic requirement → 更新 authoritative spec → 實作」順序，不得用 arbitrary value 繞過設計系統。

## Component Reuse Policy

Component decision hierarchy：

1. Reuse existing shared component。
2. 使用 existing component variant。
3. 組合 existing primitives。
4. 擴充 shared component API。
5. 建立新的 shared component。
6. 最後才建立 page-local component。

補充規則：

- 不得因單一頁面的小型 visual difference 複製 shared component。
- Page-local component 若逐漸形成跨頁共用 semantic responsibility，SHOULD 升級為 shared component。
- Shared component MUST NOT 吸收 feature-specific business logic。
- Component abstraction SHOULD 依 semantic responsibility，而不是單純因 JSX 重複。
- 新 component 或 variant MUST 說明其 semantic responsibility、states、accessibility contract 與 reuse boundary。

## Mobile and PWA shell

- MUST 處理 `env(safe-area-inset-top/right/bottom/left)`，避免內容進入 Dynamic Island、status bar、display cutout 或 gesture area。
- MUST 使用 dynamic viewport；不得直接以 `100vh` 假設可視高度。
- Soft keyboard 開啟時，form、error message 與 focused control MUST 仍可見且可捲動。
- Mobile bottom navigation 固定時，fixed bottom action bar MUST 位於其上方；內容尾端 MUST 預留足夠 bottom padding。
- iOS standalone PWA 的 deep page MUST 提供至少 `44 × 44px` 且可辨識的 back control。
- 不得把 browser mode 的 screenshot 結果描述成 standalone PWA 或 real-device Safari 證據。

## Page and pattern references

Global rules 不得被 Event Detail layout 綁定。活動詳情頁只是第一個導入目標；其 feature behavior、capacity wording、registration CTA、visibility 與 safety rules 仍以 [`akaaka-docs/docs/spec/features/events/`](https://github.com/aka-aka-proj/akaaka-docs/tree/main/docs/spec/features/events) 為準。

Event Detail pattern 可採用以下資訊層級，但其他 page MUST 依自身主要任務決定 layout：

1. Title／context／back control。
2. Quick facts 或其他能支援主要任務的 summary surface。
3. 主要 task action。
4. Secondary tools 與 supporting content。
5. loading、empty、error、disabled、success、permission denied 等明確狀態。

活動詳情頁的 quick facts、capacity、unified action bar、participant／organizer view 與 registration CTA 是 page-specific reference，不是全站 mandatory DOM structure。

## UI Agent Workflow

### Inspect

修改 UI code 前，agent MUST 閱讀：

- applicable feature spec、Design System、008 design-token spec、accessibility spec、mobile/PWA spec。
- current page implementation。
- relevant shared components、Storybook stories、unit tests 與 browser verification workflow。

### Preserve

修改前 MUST 記錄並保留現有：business behavior、API behavior、permission behavior、loading、error、empty、mutation、navigation 與 i18n behavior。視覺重構不得無意改變這些 contract。

### Define

修改前 MUST 定義：primary user task、information hierarchy、primary／secondary actions、component hierarchy、responsive behavior 與重要 states。若 read-only 或 navigation view 沒有主要 mutation，明確記錄「no Primary CTA」。

### Implement

依序 MUST：

1. reuse existing shared components。
2. reuse canonical semantic tokens。
3. avoid arbitrary values。
4. preserve accessibility semantics。
5. preserve feature behavior。

若需新增 component、variant 或 token，PR／handoff MUST 說明 gap 與 authoritative spec 變更。

### Render

UI work MUST 實際 render application 或 Storybook；static code inspection、build 通過或 unit test 通過都不能單獨代表 visual completion。

### Verify

Agent MUST 驗證 responsive layout、horizontal overflow、long text wrapping、safe-area、fixed／sticky overlap、bottom-nav overlap、keyboard focus、dialog focus、visual hierarchy 與 applicable states。

### Report

完成後 MUST 列出：

- modified files
- reused components
- new components
- new tokens（若有）
- actual rendered viewports
- tested actor／permission states
- unresolved limitations

## Visual Verification Contract

影響 layout、typography、responsive behavior、fixed／sticky UI、form interaction、dialog、navigation 或 information hierarchy 的 UI change，完成前 MUST 實際 render 驗證。

### Required viewport evidence

優先使用 repo 現有 browser baseline：desktop Chromium `1280×800`、Pixel 5 mobile，以及 CI 的 `360`、`390`、`768`、`1280` viewport projects。iPhone 12 WebKit device profile 是 automated WebKit emulation，不得稱為 real Mobile Safari；real-device Safari evidence 必須另行標示。若 feature 需要其他 viewport，必須在 report 中說明原因。

至少驗證適用的：

- horizontal overflow、clipped content、long text wrapping。
- `zh-TW`／`en` 長度差異。
- fixed／sticky UI 與 bottom nav overlap。
- safe-area、dynamic viewport、soft keyboard。
- keyboard focus 與 dialog／drawer focus behavior。
- loading、empty、error、disabled、success、permission denied。
- visual hierarchy 與 Primary／Secondary／Danger action distinction。

Mobile/PWA relevant page 另外 MUST 區分並標記 browser mode、standalone PWA、real-device 與 automated evidence 的邊界；未實際驗證的環境 MUST 列為 unresolved limitation。

### Evidence commands

依變更範圍使用 frontend 現有命令：

```bash
rtk npm run test              # unit tests
rtk npm run test:browser      # Storybook browser tests
rtk npm run test:e2e          # Playwright browser matrix
rtk npm run build             # typecheck + production build
rtk npm run build-storybook   # Storybook production build
```

Visual evidence MUST 記錄 route、viewport、actor／permission state、browser／project、結果與 limitation。`build`、unit test 或 Storybook a11y panel 可作為補充證據，但不得取代實際 rendered evidence。

## i18n and privacy

- 新增 UI 文案時，`zh-TW` 與 `en` MUST 同批更新，並檢查長度與換行。
- 不得以 user ID、database enum 或 raw technical error 作為使用者可見文案；使用 localized label 與可理解 fallback。
- 私人活動與受限內容只能依既有 visibility、AuthZ 與 RLS contract 呈現；UI hiding 不是 security control。
- 不得儲存原始照片；多媒體只能使用允許的外部社群連結。

## Adoption checklist

- [ ] 已讀取 applicable feature、Design System、008 token、accessibility、mobile/PWA 與 browser workflow specs。
- [ ] 已確認主要任務；若無主要 mutation，已明確記錄 no Primary CTA。
- [ ] 已使用 canonical semantic token 與 shared component decision hierarchy。
- [ ] 沒有新增未登錄 token、arbitrary value、page-specific global CSS、layout absolute positioning 或任意 z-index。
- [ ] 保留 API、business、permission、loading、error、empty、mutation、navigation 與 i18n behavior。
- [ ] 已驗證所有適用 states 與 accessibility semantics。
- [ ] 已實際 render canonical viewport，並記錄 route、actor state、browser/project 與 limitation。
- [ ] 若涉及 mobile/PWA，已區分 browser、standalone 與 real-device evidence。
- [ ] 若發現 design-system gap，已先更新 authoritative token/component spec，而非繞過規則。

## Governance

本文件的 `category: implementation` 與既有 repository metadata convention 一致；不新增未被 repository 支援的 metadata 欄位。任何規則若與 security、feature、accessibility 或 008 token spec 發生衝突，MUST 依本文件的 Authority by concern 處理，不得默默選擇 implementation 現況。
