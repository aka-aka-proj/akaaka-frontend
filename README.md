# React + TypeScript + Vite

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
- Scope: frontend build artifact + deploy integration skeleton (placeholder only)
- Note: backend must be deployed first, and frontend runtime/env vars should point to deployed backend endpoints.

### Required repository configuration for enabling real deploy

- Secret: `FRONTEND_DEPLOY_TOKEN`
- Variable: `FRONTEND_DEPLOY_PROJECT_ID`
- Variable: `FRONTEND_DEPLOY_ORG_ID`

The deploy step is intentionally a placeholder. Replace it with your hosting provider command when secrets/vars are ready.
