# React + TypeScript + Vite

## PWA notifications

通知設定頁的「啟用瀏覽器通知」會在使用者明確操作後建立目前瀏覽器／PWA 的 Web Push subscription。前端只需要公開的 `VITE_VAPID_PUBLIC_KEY`；VAPID private key 不得放入前端環境變數或 bundle。

目前 Service Worker 已處理通知顯示與安全的通知點擊導向，但 provider fan-out 尚未部署；`push_subscriptions` 本身不代表通知已送達。provider、retry 與失效 endpoint 清理須依 docs ADR-017／ADR-014 另行完成。

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Frontend CI/CD (after frontend/backend/IaC split)

This repository is responsible for **frontend-only** CI/CD.

### CI for Pull Requests

- Workflow: `.github/workflows/ci.yml`
- Trigger: `pull_request` to `main`
- Scope: frontend quality checks only
- Steps: `npm ci` -> `npm run lint` -> `npm run test` -> `npm run build`

### CD for Main Branch

- Workflow: `.github/workflows/frontend-cd.yml`
- Trigger: `push` to `main` and `workflow_dispatch`
- Scope: frontend build artifact and deploy to Vercel via CLI
- Note: **Supabase backend must be deployed first** before deploying frontend, and frontend runtime env vars must point to deployed backend endpoints.

### Required repository secrets

- Secret: `VERCEL_TOKEN`
- Secret: `VERCEL_PROJECT_ID`
- Secret: `VERCEL_ORG_ID`

`frontend-cd.yml` uses `npx vercel deploy dist --prod --yes --token "$VERCEL_TOKEN"` after the frontend build job finishes.
