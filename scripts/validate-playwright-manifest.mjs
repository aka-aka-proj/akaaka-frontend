import { readFileSync } from 'node:fs'

const manifestPath = process.argv[2] || 'playwright-report/runtime-manifest.json'
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const requiredProjectFields = [
  'browser',
  'locale',
  'timezone',
  'reducedMotion',
  'viewport',
  'deviceScaleFactor',
  'font',
]
const forbiddenKeys = /token|secret|cookie|password|anon.?key|private.?data/i

if (manifest.schemaVersion !== 1) throw new Error('Unsupported runtime manifest schema')
if (!Array.isArray(manifest.projects) || manifest.projects.length === 0) {
  throw new Error('Runtime manifest has no Playwright projects')
}

for (const project of manifest.projects) {
  for (const field of requiredProjectFields) {
    if (!(field in project)) throw new Error(`${project.project}: missing ${field}`)
  }
  if (project.browser.version === 'unavailable') {
    throw new Error(`${project.project}: browser version is unavailable`)
  }
  if (project.observed === 'unavailable') {
    throw new Error(`${project.project}: runtime observation is unavailable`)
  }
}

if (forbiddenKeys.test(JSON.stringify(manifest))) {
  throw new Error('Runtime manifest contains a forbidden secret/private-data key')
}

console.log(`Validated runtime manifest: ${manifest.projects.length} project(s)`)
