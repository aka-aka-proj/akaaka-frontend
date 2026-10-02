import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function validateDeployment(deployment, { sha, projectId, repository, target }) {
  const production = target === 'production'
  const branch = production ? 'main' : 'preview'
  const meta = deployment.meta || {}
  if (!['production', 'preview'].includes(target) || deployment.readyState !== 'READY' || (deployment.projectId || deployment.project?.id) !== projectId ||
      meta.githubCommitSha !== sha || meta.githubCommitRef !== branch ||
      `${meta.githubOrg || meta.githubCommitOrg}/${meta.githubRepo || meta.githubCommitRepo}` !== repository ||
      (production ? deployment.target !== 'production' : deployment.target != null) ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(deployment.url || '') ||
      typeof deployment.id !== 'string' || !deployment.id.startsWith('dpl_')) {
    throw new Error('Deployment identity, commit, branch, target or readiness mismatch')
  }
  return { deploymentId: deployment.id, sha, branch, target, origin: `https://${deployment.url}` }
}

async function main() {
  const { PLAYWRIGHT_BASE_URL: origin, EVIDENCE_COMMIT_SHA: sha,
    VERCEL_TOKEN: token, VERCEL_ORG_ID: team, VERCEL_PROJECT_ID: projectId,
    GITHUB_REPOSITORY: repository, EVIDENCE_TARGET: target } = process.env
  if (![origin, sha, token, team, projectId, repository, target].every(Boolean)) {
    throw new Error('Missing deployment verification configuration')
  }
  const get = async (resource) => {
    const url = new URL(resource, 'https://api.vercel.com')
    url.searchParams.set('teamId', team)
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` },
      redirect: 'error', signal: AbortSignal.timeout(30000) })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Deployment metadata request failed: HTTP ${response.status}`)
    return response.json()
  }
  const host = new URL(origin).hostname
  let deployment = await get(`/v13/deployments/${encodeURIComponent(host)}`)
  if (!deployment) {
    const alias = await get(`/v4/aliases/${encodeURIComponent(host)}`)
    const id = alias?.deploymentId || alias?.deployment?.id
    if (!id) throw new Error('Deployment or alias not found')
    deployment = await get(`/v13/deployments/${encodeURIComponent(id)}`)
  }
  if (!deployment) throw new Error('Deployment not found')
  const evidence = validateDeployment(deployment, { sha, origin: new URL(origin).origin, projectId, repository, target })
  execFileSync('git', ['merge-base', '--is-ancestor', sha, `origin/${evidence.branch}`], { stdio: 'ignore' })
  const file = '.verified-evidence-target.json'
  if (process.argv.includes('--recheck')) {
    if (JSON.stringify(JSON.parse(readFileSync(file, 'utf8'))) !== JSON.stringify(evidence)) {
      throw new Error('Deployment changed during browser evidence run')
    }
  } else {
    appendFileSync(process.env.GITHUB_ENV, `PLAYWRIGHT_BASE_URL=${evidence.origin}\nVERIFIED_EVIDENCE_ORIGIN=${evidence.origin}\n`)
    writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  console.log(`Verified ${evidence.target} deployment at requested commit`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Deployment verification failed; evidence withheld'); process.exitCode = 1 })
}
