# AkaAka Frontend Instructions

- 以繁體中文回覆；所有終端指令均以 `rtk` 為前綴。
- 這是獨立 Git repository；commit 與 push 僅在此目錄執行。
- **Worktree 強制規則：** 每個 coding agent session 必須使用自己的 git worktree 與唯一 task branch，不得在共用 checkout 或直接綁定 `preview` worktree 上修改。開始前執行 `rtk git fetch origin`，再從 `origin/preview` 建立 worktree，例如：`rtk git worktree add -b feat/<task> ../akaaka-frontend-feat-<task> origin/preview`。
- Git 版本流程：task branch 只提交並 push 到自己的遠端分支，先建立 task branch → `preview` Pull Request 並合併；不得直接 push `preview`。在 `preview` 驗證通過後，再建立 `preview` → `main` Pull Request，禁止直接 push `main`。Preview deployment 必須來自 `preview`，Production deployment 只能來自合併後的 `main`。
- 任務完成且不再需要 worktree 後，先確認無未提交變更，再執行 `rtk git worktree remove <worktree-path>`；不得移除仍被其他 session 使用的 worktree。
- 進行 AkaAka 功能、修正或架構變更時，先載入 `../.opencode/skills/akaaka-docs/SKILL.md` 並閱讀 `../akaaka-docs/AGENTS.md`，再在 `../akaaka-docs/` 的規格與 ADR 中確認需求；文件必須先於或同步於程式碼更新。
- **Design system 文件 ownership：** UI／UX 工作開始前先讀取本 repo 的 `DESIGN_SYSTEM.md`，再透過 `akaaka-docs` skill 讀取 `akaaka-docs/docs/spec/platform/008-design-tokens-spec.md` 與相關 canonical specs。`DESIGN_SYSTEM.md` 負責 frontend 頁面 pattern、layout、互動、responsive、mobile/PWA 與 accessibility 語意；008 負責實際 CSS token 數值、元件狀態與工程驗證。不得在兩份文件重複維護同一 token；需要新 token 時先更新 008，再更新 Design System 使用說明。
## Supabase 環境與 Anon Key

本專案有兩個 Supabase project，其 anon key 存放在工作區根目錄的獨立檔案中（不要將 key 硬編碼在程式碼或 AGENTS.md 中）：

| 環境 | Supabase URL | Anon Key 檔案 |
|---|---|---|
| **Production** | `https://fkqvjchizknuifjxiawe.supabase.co` | `/home/zacko/Projects/AkaAka/supabase.prod.anon` |
| **Staging** | `https://xdknuxdhyvjgwlcliyqx.supabase.co` | `/home/zacko/Projects/AkaAka/supabase.stage.anon` |

## Supabase DB Password

執行 `supabase db push` 部署 migration 到遠端資料庫時需要 DB password（僅供 IaC 操作參考）：

| 環境 | DB Password 檔案 |
|---|---|
| **Production** | `/home/zacko/Projects/AkaAka/supabase.db.pwd.prod` |
| **Staging** | `/home/zacko/Projects/AkaAka/supabase.db.pwd.stage` |

- 開發時使用 staging anon key 連線 Supabase，production 用於正式環境。
- 修改前端程式後，依影響範圍執行 `rtk npm run lint`、`rtk npm test` 或 `rtk npm run build`。
- 不得儲存原始照片；多媒體僅能使用 FB、IG、X.com 的外部社群連結。
- 聲譽系統僅能累積點數，不得扣點；場地方角色升級僅能由管理員手動處理。
