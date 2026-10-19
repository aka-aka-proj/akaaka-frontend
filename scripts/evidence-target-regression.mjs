import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateDeployment } from './evidence-target.mjs'

const sha = 'a'.repeat(40)
const config = { sha, origin: 'https://example.vercel.app', projectId: 'prj_test', repository: 'owner/repo', target: 'preview' }
const deployment = { id: 'dpl_test', url: 'example-deploy.vercel.app', readyState: 'READY', projectId: 'prj_test', target: null,
  meta: { githubCommitSha: sha, githubCommitRef: 'preview', githubCommitOrg: 'owner', githubCommitRepo: 'repo' } }
test('accepts matching preview deployment', () => {
  assert.equal(validateDeployment(deployment, config).branch, 'preview')
})
test('accepts production only from main and production target', () => {
  const production = { ...deployment, target: 'production', meta: { ...deployment.meta, githubCommitRef: 'main' } }
  assert.equal(validateDeployment(production, { ...config, origin: 'https://akaaka-frontend.vercel.app', target: 'production' }).branch, 'main')
  assert.throws(() => validateDeployment(production, config))
  assert.throws(() => validateDeployment(deployment, { ...config, origin: 'https://akaaka-frontend.vercel.app', target: 'production' }))
})
for (const [name, patch] of Object.entries({
  stale: { readyState: 'BUILDING' }, project: { projectId: 'other' }, missingId: { id: undefined },
  sha: { meta: { ...deployment.meta, githubCommitSha: 'b'.repeat(40) } },
  branch: { meta: { ...deployment.meta, githubCommitRef: 'feat/task' } },
  repository: { meta: { ...deployment.meta, githubCommitRepo: 'other' } },
  missingMetadata: { meta: undefined }, target: { target: 'production' },
})) {
  test(`rejects ${name} mismatch`, () => assert.throws(() => validateDeployment({ ...deployment, ...patch }, config)))
}

test('supports Vercel project and repository metadata from live deployments', () => {
  const live = { ...deployment, projectId: undefined, project: { id: config.projectId },
    meta: { githubCommitSha: sha, githubCommitRef: 'preview', githubOrg: 'owner', githubRepo: 'repo' } }
  const result = validateDeployment(live, config)
  assert.equal(result.origin, 'https://example-deploy.vercel.app')
  assert.equal(result.deploymentId, 'dpl_test')
})
