import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'

// Playwright's HTML reporter may clear its output directory after globalSetup.
// Keep the source manifest outside that directory, then materialize the
// artifact copy after the test command has finished.
const manifestPath = path.resolve('.playwright-runtime-manifest.json')
const playwrightPackagePath = fileURLToPath(new URL('../node_modules/playwright/package.json', import.meta.url))

const browserTypes = { chromium, firefox, webkit }

function safeFontProbe() {
  try {
    const family = execFileSync('fc-match', ['-f', '%{family}', 'sans-serif'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return family || 'unavailable'
  } catch {
    return 'unavailable'
  }
}

function safeBaseUrl(rawBaseUrl) {
  if (!rawBaseUrl) return 'http://127.0.0.1:5173'

  try {
    const url = new URL(rawBaseUrl)
    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    const isPreview = process.env.VERCEL_ENV === 'preview' && url.hostname.endsWith('.vercel.app')
    return isLoopback || isPreview ? url.origin : 'redacted-non-preview-url'
  } catch {
    return 'unavailable'
  }
}

function browserNameForProject(projectName) {
  if (projectName.startsWith('firefox')) return 'firefox'
  if (projectName.startsWith('webkit')) return 'webkit'
  return 'chromium'
}

function getProjectValue(project, key, fallback) {
  return project.use?.[key] ?? fallback
}

async function collectProjectManifest(project, common) {
  const browserName = browserNameForProject(project.name)
  const browserType = browserTypes[browserName]
  const locale = getProjectValue(project, 'locale', 'en-US')
  const timezoneId = getProjectValue(project, 'timezoneId', 'UTC')
  const reducedMotion = getProjectValue(project, 'reducedMotion', 'reduce')
  const viewport = getProjectValue(project, 'viewport', null)
  const deviceScaleFactor = getProjectValue(project, 'deviceScaleFactor', 1)
  const entry = {
    project: project.name,
    browser: {
      name: browserName,
      version: 'unavailable',
      executablePath: 'unavailable',
    },
    locale,
    timezone: timezoneId,
    reducedMotion,
    serviceWorkers: getProjectValue(project, 'serviceWorkers', 'allow'),
    viewport,
    deviceScaleFactor,
    font: {
      familyProbe: common.fontFamily,
      package: 'unavailable',
    },
    observed: 'unavailable',
  }

  let browser
  let context
  try {
    browser = await browserType.launch({ headless: true })
    entry.browser.version = browser.version()
    entry.browser.executablePath = browserType.executablePath()
    context = await browser.newContext({
      deviceScaleFactor,
      hasTouch: getProjectValue(project, 'hasTouch', false),
      isMobile: getProjectValue(project, 'isMobile', false),
      locale,
      reducedMotion,
      timezoneId,
      userAgent: getProjectValue(project, 'userAgent', undefined),
      viewport,
    })
    const page = await context.newPage()
    entry.observed = await page.evaluate(() => ({
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      languages: navigator.languages,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth,
      },
    }))
  } catch (error) {
    entry.probeError = error instanceof Error ? error.name : 'unknown'
  } finally {
    await context?.close().catch(() => {})
    await browser?.close().catch(() => {})
  }

  return entry
}

export default async function globalSetup(config) {
  const packageJson = JSON.parse(readFileSync(playwrightPackagePath, 'utf8'))
  const common = {
    fontFamily: safeFontProbe(),
    nodeVersion: process.version,
    os: {
      architecture: process.arch,
      platform: process.platform,
      release: os.release(),
    },
    playwrightVersion: packageJson.version || 'unavailable',
  }
  const projects = []
  for (const project of config.projects) {
    projects.push(await collectProjectManifest(project, common))
  }

  mkdirSync(path.dirname(manifestPath), { recursive: true })
  writeFileSync(
    manifestPath,
    `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || 'local',
      ci: process.env.GITHUB_ACTIONS === 'true',
      baseUrl: safeBaseUrl(process.env.PLAYWRIGHT_BASE_URL),
      ...common,
      projects,
    }, null, 2)}\n`,
    'utf8',
  )
}
