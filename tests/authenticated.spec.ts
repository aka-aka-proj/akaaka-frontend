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
  '/events/mine',
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

  test('enables start-time editing only for one recurring occurrence', async ({ page }) => {
    const occurrence = {
      id: 'synthetic-recurring-instance',
      creator_id: syntheticUserId,
      title: 'Synthetic recurring occurrence',
      description: null,
      category: 'Social',
      lifecycle_status: 'published',
      publication_status: 'published',
      publish_at: null,
      unpublish_at: null,
      attendance_fee_type: 'free',
      attendance_fee_amount: null,
      event_type: ['Movie'],
      is_venue_hosted: false,
      visibility_settings: { type: 'public' },
      registration_form_config: null,
      recurrence_rule: { frequency: 'weekly', count: 3 },
      series_id: 'synthetic-recurring-parent',
      start_time: '2099-01-08T12:00:00.000Z',
      location_region: 'Online',
      location_detail: null,
      max_capacity: null,
      registration_deadline: '2099-01-07T12:00:00.000Z',
      external_registration_url: null,
      source_url: null,
      created_at: '2098-12-01T00:00:00.000Z',
    }
    await page.route('**/rest/v1/events**', async (route) => {
      const url = route.request().url()
      const body = url.includes('series_id=eq.synthetic-recurring-parent')
        ? [occurrence, { ...occurrence, id: 'synthetic-recurring-sibling', start_time: '2099-01-15T12:00:00.000Z' }]
        : url.includes('id=eq.synthetic-recurring-parent')
          ? [{ ...occurrence, id: 'synthetic-recurring-parent', series_id: null, start_time: '2099-01-01T12:00:00.000Z' }]
          : [occurrence]
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(body) })
    })

    await gotoAuthenticatedRoute(page, '/events/synthetic-recurring-instance/edit')
    const startTime = page.getByLabel(/開始時間|start time/i)
    await expect(startTime).toBeEnabled({ timeout: authenticatedStateTimeout })
    await expect(page.getByText(/只會影響此場|affects only this occurrence/i)).toBeVisible()
    await page.getByRole('radio', { name: /此場與後續場次|this and following occurrences/i }).check()
    await expect(startTime).toBeDisabled()
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
  })

  test('recovers a new series form and clears local drafts on sign out', async ({ page }) => {
    await page.route('**/auth/v1/logout**', route => route.fulfill({ status: 204 }))
    await gotoAuthenticatedRoute(page, '/events/series/new')
    const name = page.getByLabel(/系列名稱|series name/i)
    await name.fill('尚未建立的系列')
    await expect(page.getByText(/已在此裝置暫存|saved on this device/i)).toBeVisible()
    page.on('dialog', dialog => void dialog.accept())
    await page.reload()
    await page.getByRole('button', { name: /恢復內容|restore content/i }).click()
    await expect(name).toHaveValue('尚未建立的系列')
    await page.getByRole('button', { name: /^更多$|^more$/i }).click()
    await page.getByRole('button', { name: /登出|sign out/i })
      .or(page.getByRole('menuitem', { name: /登出|sign out/i })).click()
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('akaaka:series-draft:')).length)).toBe(0)
  })

  test('resumes an empty series and recovers interrupted edits', async ({ page }, testInfo) => {
    await page.addInitScript(locale => localStorage.setItem('akaaka-locale', locale), testInfo.project.name === 'chromium-desktop' ? 'en' : 'zh-TW')
    let series = { id: 'resume-series', creator_id: syntheticUserId, title: '未完成的活動系列', description: '', is_whole_series_required: false, lifecycle_status: 'draft', updated_at: '2026-09-01T00:00:00Z', event_series_membership: [{ count: 0 }] }
    let failSave = true
    await page.route('**/rest/v1/event_series?**', async route => {
      const request = route.request()
      if (request.method() === 'PATCH') {
        if (failSave) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'temporary failure' }) }); return }
        series = { ...series, ...request.postDataJSON() }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: series.id }) }); return
      }
      const single = request.headers()['accept']?.includes('vnd.pgrst.object') || new URL(request.url()).searchParams.has('id')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? series : [series]) })
    })
    await gotoAuthenticatedRoute(page, '/events')
    await page.getByRole('link', { name: /我的活動|my activities/i, exact: true }).click()
    await page.getByRole('button', { name: /活動系列|activity series/i, exact: true }).click()
    await expect(page.getByText('未完成的活動系列', { exact: true })).toBeVisible()
    await expect(page.getByText(/0 場|0 sessions/)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('draft-list.png'), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('link', { name: /繼續編輯|continue editing/i }).click()
    const name = page.getByLabel(/系列名稱|series name/i)
    await expect(name).toHaveValue('未完成的活動系列')
    await name.fill('關閉後仍可恢復的修改')
    await expect(page.getByText(/已在此裝置暫存|saved on this device/i)).toBeVisible()
    // A new document simulates closing and reopening the editor on this device.
    page.on('dialog', dialog => void dialog.accept())
    await page.reload()
    await expect(page.getByRole('button', { name: /恢復內容|restore content/i })).toBeVisible()
    await expect(name).toBeDisabled()
    await page.getByRole('button', { name: /恢復內容|restore content/i }).click()
    await expect(name).toHaveValue('關閉後仍可恢復的修改')
    await page.getByRole('button', { name: /^儲存變更$|^save changes$/i }).click()
    await expect(page.getByText(/儲存失敗，內容已保留|saving failed. your input is retained/i)).toBeVisible()
    await expect(name).toHaveValue('關閉後仍可恢復的修改')
    failSave = false
    await page.getByRole('button', { name: /^儲存變更$|^save changes$/i }).click()
    await expect(page.getByText(/目前沒有未儲存的修改|no unsaved changes/i)).toBeVisible()
    await page.reload()
    await expect(name).toHaveValue('關閉後仍可恢復的修改')
    await expect(page.getByRole('button', { name: /恢復內容|restore content/i })).not.toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('draft-resumed.png'), fullPage: true })
  })

  for (const route of authenticatedRoutes) {
    test(`keeps protected route authenticated: ${route}`, async ({ page }) => {
        await gotoAuthenticatedRoute(page, route)
      await expect(page.getByRole('heading', { name: /^登入$|^sign in$/i })).not.toBeVisible()
      await expect(page.locator('main')).toBeVisible()
    })
  }
})
