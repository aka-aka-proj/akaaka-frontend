import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const syntheticUserId = '00000000-0000-4000-8000-000000000001'
const syntheticStorageKeys = [
  'sb-fkqvjchizknuifjxiawe-auth-token',
  'sb-127-auth-token',
]
const syntheticSession = {
  access_token: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJleHAiOjQxMDI0NDQ4MDAsImlhdCI6MTcwMDAwMDAwMCwiYXVkIjoiYXV0aGVudGljYXRlZCIsImFwcF9tZXRhZGF0YSI6eyJyb2xlIjoiZ2VuZXJhbCJ9fQ.synthetic-signature',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'synthetic-browser-fixture-refresh-token',
  user: {
    id: syntheticUserId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'synthetic@example.test',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
  },
}

const syntheticProfile = {
  id: syntheticUserId,
  role_status: 'general',
  display_name: 'Synthetic Browser User',
  bio: null,
  external_social_links: [{ platform: 'x', url: 'https://x.com/synthetic', is_connected: false }],
  metadata: {},
  reputation_score: 0,
}

const authenticatedRoutes = [
  '/onboarding',
  '/events',
  '/events/new',
  '/events/bookmarks',
  '/events/synthetic-event/edit',
  '/events/synthetic-event',
  '/profile/me',
  '/profile/me/edit',
  '/profile/me/feedback',
  '/profile/me/reports',
  '/profile/synthetic-profile',
  '/profile/synthetic-profile/feedback',
  '/profile/synthetic-profile/reports',
  '/reports/me',
  '/registrations/me',
  '/notifications',
  '/messages',
  '/messages/new',
  '/messages/synthetic-conversation',
  '/following',
  '/settings/notifications',
  '/issues',
  '/issues/new',
  '/issues/synthetic-issue',
  '/virtual-lovers',
  '/virtual-lovers/new',
  '/virtual-lovers/synthetic-lover/chat',
  '/settings/security-privacy',
  '/settings/analytics',
]

async function installAuthenticatedFixture(page: Page) {
  await page.addInitScript(({ session, storageKeys }) => {
    for (const storageKey of storageKeys) {
      localStorage.setItem(storageKey, JSON.stringify(session))
    }
  }, { session: syntheticSession, storageKeys: syntheticStorageKeys })

  await page.route('**/rest/v1/**', async (route) => {
    const response = route.request().url().includes('/rest/v1/profiles')
      ? { headers: { 'content-range': '0-0/1' }, body: JSON.stringify(syntheticProfile) }
      : { headers: { 'content-range': '0-0/*' }, body: '[]' }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      ...response,
    })
  })

  await page.route('**/functions/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

test.describe('authenticated synthetic route boundary', () => {
  test.beforeEach(async ({ page }) => {
    await installAuthenticatedFixture(page)
  })

  test('keeps every protected route in the authenticated shell', async ({ page }) => {
    test.setTimeout(90000)
    for (const route of authenticatedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: /登入|sign in/i })).not.toBeVisible()
      await expect(page.locator('main')).toBeVisible()
    }
  })

  test('renders the empty events state without automated axe violations', async ({ page }) => {
    await page.goto('/events')
    await expect(page.locator('.events-toolbar h1')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/沒有描述|no description|找不到符合條件的活動|no events match your filters/i)).toBeVisible({ timeout: 15000 })
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('exposes the privacy center to an authenticated user', async ({ page }) => {
    await page.goto('/settings/security-privacy')
    await expect(page.locator('section[aria-labelledby="privacy-data-flows-title"]')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/這不是端對端加密|not end-to-end encrypted/i)).toBeVisible({ timeout: 15000 })
  })
})
