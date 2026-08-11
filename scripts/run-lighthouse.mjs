import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { chromium } from 'playwright'
import lighthouse from 'lighthouse'
import { launch } from 'chrome-launcher'

const host = '127.0.0.1'
const port = 4173
const baseUrl = `http://${host}:${port}`
const reportDir = 'lighthouse-report'
const categories = ['performance', 'accessibility', 'best-practices', 'seo']
const thresholds = {
  performance: 0.5,
  accessibility: 0.9,
  'best-practices': 0.9,
  seo: 0.5,
}
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const waitForPreview = async () => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/auth`)
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Preview did not become ready at ${baseUrl}`)
}

const runCommand = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'inherit', env: process.env })
  child.on('error', reject)
  child.on('exit', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
  })
})

const killChrome = (chrome, label) => {
  if (!chrome) return
  try {
    const result = chrome.kill()
    if (result && typeof result.catch === 'function') {
      void result.catch(() => console.warn(`${label} cleanup returned an error`))
    }
  } catch {
    console.warn(`${label} cleanup returned an error`)
  }
}

const killProcess = (processHandle) => {
  if (!processHandle) return
  try {
    processHandle.kill('SIGTERM')
  } catch {
    // The preview may already have exited.
  }
}

await mkdir(reportDir, { recursive: true })
await runCommand(npmCommand, ['run', 'build'])
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', host, '--port', String(port)], {
  stdio: 'inherit',
  env: process.env,
})

try {
  await waitForPreview()
  const chromePath = chromium.executablePath()
  const results = []

  for (const profile of [
    {
      name: 'desktop',
      formFactor: 'desktop',
      screenEmulation: { mobile: false, width: 1280, height: 800, deviceScaleFactor: 1 },
    },
    {
      name: 'mobile',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1 },
    },
  ]) {
    const chrome = await launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox'] })
    try {
      const audit = await lighthouse(`${baseUrl}/auth`, {
        port: chrome.port,
        output: ['json', 'html'],
        logLevel: 'error',
        onlyCategories: categories,
        formFactor: profile.formFactor,
        screenEmulation: profile.screenEmulation,
        throttlingMethod: 'simulate',
      })
      const reports = Array.isArray(audit.report) ? audit.report : [audit.report]
      const jsonReport = JSON.parse(reports[0])
      const htmlReport = reports[1] ?? ''
      const scores = Object.fromEntries(categories.map((category) => [category, jsonReport.categories[category].score]))
      const requiredAuditFailures = ['meta-description', 'robots-txt']
        .filter((auditId) => jsonReport.audits[auditId]?.score !== 1)
      await writeFile(`${reportDir}/auth-${profile.name}.json`, JSON.stringify(jsonReport, null, 2))
      await writeFile(`${reportDir}/auth-${profile.name}.html`, htmlReport)
      results.push({ profile: profile.name, scores, requiredAuditFailures })
    } finally {
      killChrome(chrome, `Chrome ${profile.name}`)
    }
  }

  await writeFile(`${reportDir}/summary.json`, JSON.stringify({ url: `${baseUrl}/auth`, thresholds, results }, null, 2))
  const failures = results.flatMap(({ profile, scores }) => categories
    .filter((category) => scores[category] < thresholds[category])
    .map((category) => `${profile}/${category}=${scores[category]} < ${thresholds[category]}`))
  const requiredAuditFailures = results.flatMap(({ profile, requiredAuditFailures: failuresForProfile }) =>
    failuresForProfile.map((auditId) => `${profile}/${auditId}`))
  if (failures.length > 0 || requiredAuditFailures.length > 0) {
    process.exitCode = 1
    console.error(`Lighthouse thresholds failed: ${[...failures, ...requiredAuditFailures].join(', ')}`)
  }
  console.log(JSON.stringify({ url: `${baseUrl}/auth`, thresholds, results }, null, 2))
  killProcess(preview)
  process.exit(process.exitCode ?? 0)
} finally {
  killProcess(preview)
}
