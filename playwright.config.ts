import { defineConfig, devices } from '@playwright/test'

const allProjects = [
  { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },
  { name: 'chromium-narrow', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 } } },
  { name: 'chromium-390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  { name: 'chromium-1024', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 800 } } },
  { name: 'chromium-tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
  { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
  { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
  { name: 'webkit-mobile', use: { ...devices['iPhone 12'] } },
]

const browserFilter = process.env.BROWSER_FILTER

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [
        ['line'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ]
    : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    // Service-worker behavior has a separate web-push verification scope; blocking it here
    // keeps synthetic Supabase route interception deterministic across browser projects.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
      },
  projects: browserFilter
    ? allProjects.filter((p) => p.name.startsWith(browserFilter))
    : allProjects,
})
