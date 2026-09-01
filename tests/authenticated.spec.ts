import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const syntheticUserId = '00000000-0000-4000-8000-000000000001'
const syntheticSupabaseRef = (() => {
  const url = process.env.VITE_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).hostname.split('.')[0] ?? null
  } catch {
    return null
  }
})()
const syntheticStorageKeys = [
  'sb-localhost-auth-token',
  syntheticSupabaseRef ? `sb-${syntheticSupabaseRef}-auth-token` : null,
].filter((key): key is string => Boolean(key))
const syntheticAccessToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    sub: syntheticUserId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'synthetic@example.test',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url'),
  'synthetic-signature',
].join('.')

const syntheticSession = {
  access_token: syntheticAccessToken,
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

const authenticatedStateTimeout = 30_000
const authenticatedFixtureTimeout = 45_000

async function installAuthenticatedFixture(page: Page) {
  await page.addInitScript(({ session, storageKeys }) => {
    for (const storageKey of storageKeys) {
      localStorage.setItem(storageKey, JSON.stringify(session))
    }
  }, { session: syntheticSession, storageKeys: syntheticStorageKeys })

  await page.route('**/rest/v1/**', async (route) => {
    const isProfilesRequest = route.request().url().includes('/rest/v1/profiles')
    const isProfileResolverRequest = route.request().url().includes('/rest/v1/rpc/get_profile_for_viewer')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': isProfilesRequest || isProfileResolverRequest ? '0-0/1' : '0-0/*' },
      body: isProfileResolverRequest
        ? JSON.stringify(syntheticProfile)
        : isProfilesRequest
          ? JSON.stringify([syntheticProfile])
          : '[]',
    })
  })

  await page.route('**/functions/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(syntheticSession.user) })
  })
}

async function gotoAuthenticatedRoute(page: Page, route: string) {
  const profileResponse = page.waitForResponse(
    (response) => response.url().includes('/rest/v1/rpc/get_profile_for_viewer') && response.status() === 200,
    { timeout: authenticatedFixtureTimeout },
  )
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: authenticatedFixtureTimeout })
  await profileResponse
}

test.describe('authenticated synthetic route boundary', () => {
  test.setTimeout(60_000)
  test.beforeEach(async ({ page }) => {
    await installAuthenticatedFixture(page)
  })

  test('renders the empty events state without automated axe violations', async ({ page }) => {
    await gotoAuthenticatedRoute(page, '/events')
    await expect(page.locator('.events-toolbar h1')).toBeVisible({ timeout: authenticatedStateTimeout })
    await expect(page.getByText(/沒有描述|no description|找不到符合條件的活動|no events match your filters/i)).toBeVisible({ timeout: authenticatedStateTimeout })
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('exposes the privacy center to an authenticated user', async ({ page }) => {
    await gotoAuthenticatedRoute(page, '/settings/security-privacy')
    await expect(page.locator('section[aria-labelledby="privacy-data-flows-title"]')).toBeVisible({ timeout: authenticatedStateTimeout })
    await expect(page.getByText(/這不是端對端加密|not end-to-end encrypted/i)).toBeVisible({ timeout: authenticatedStateTimeout })
  })
  for (const route of authenticatedRoutes) {
    test(`keeps protected route authenticated: ${route}`, async ({ page }) => {
        await gotoAuthenticatedRoute(page, route)
      await expect(page.getByRole('heading', { name: /^登入$|^sign in$/i })).not.toBeVisible()
      await expect(page.locator('main')).toBeVisible()
    })
  }
})
