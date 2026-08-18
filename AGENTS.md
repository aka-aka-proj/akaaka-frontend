# AkaAka Frontend Instructions

- 以繁體中文回覆；所有終端指令均以 `rtk` 為前綴。
- 這是獨立 Git repository；commit 與 push 僅在此目錄執行。
- Git 版本流程：所有變更先 checkout／同步 `preview`，只提交並 push 到 `preview`；驗證通過後建立 `preview` → `main` Pull Request，禁止直接 push `main`。Preview deployment 必須來自 `preview`，Production deployment 只能來自合併後的 `main`。
- 進行 AkaAka 功能、修正或架構變更時，先載入 `../.opencode/skills/akaaka-docs/SKILL.md` 並閱讀 `../akaaka-docs/AGENTS.md`，再在 `../akaaka-docs/` 的規格與 ADR 中確認需求；文件必須先於或同步於程式碼更新。
## Supabase 環境與 Anon Key

本專案有兩個 Supabase project，其 anon key 存放在工作區根目錄的獨立檔案中（不要將 key 硬編碼在程式碼或 AGENTS.md 中）：

| 環境 | Supabase URL | Anon Key 檔案 |
|---|---|---|
| **Production** | `https://fkqvjchizknuifjxiawe.supabase.co` | `/home/zacko/Projects/AkaAka/supabase.prod.anon` |
| **Staging** | `https://xdknuxdhyvjgwlcliyqx.supabase.co` | `/home/zacko/Projects/AkaAka/supabase.stage.anon` |

- 開發時使用 staging anon key 連線 Supabase，production 用於正式環境。
- 修改前端程式後，依影響範圍執行 `rtk npm run lint`、`rtk npm test` 或 `rtk npm run build`。
- 不得儲存原始照片；多媒體僅能使用 FB、IG、X.com 的外部社群連結。
- 聲譽系統僅能累積點數，不得扣點；場地方角色升級僅能由管理員手動處理。
