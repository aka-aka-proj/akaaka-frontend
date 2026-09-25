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
  '/settings/blocklist',
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
    await expect(page.getByRole('button', { name: /恢復內容|restore content/i })).toBeVisible()
    // Leaving before choosing restore/discard must not consume the stored snapshot.
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
    await page.reload()
    await expect(page.getByRole('button', { name: /恢復內容|restore content/i })).toBeVisible()
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

  for (const locale of ['en', 'zh-TW']) {
    test(`explains blocking before and after profile actions (${locale})`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem('akaaka-locale', value), locale)
      const mutations: string[] = []
      await page.route('**/rest/v1/blocks*', async (route) => {
        const method = route.request().method()
        if (method !== 'GET') mutations.push(method)
        await route.fulfill({
          status: method === 'GET' ? 200 : 204,
          contentType: 'application/json',
          body: method === 'GET' ? 'null' : '',
        })
      })
      await gotoAuthenticatedRoute(page, '/profile/synthetic-profile')
      const summary = page.locator('summary').filter({ hasText: /How blocking works|封鎖功能說明/ })
      const help = page.locator('details').filter({ has: summary })
      await expect(summary).toBeVisible()
      const summaryBox = await summary.boundingBox()
      expect(summaryBox!.height).toBeGreaterThanOrEqual(44)
      await expect(help).not.toHaveAttribute('open', '')
      await summary.focus()
      await page.keyboard.press('Enter')
      await expect(help).toHaveAttribute('open', '')
      await expect(help.getByRole('listitem')).toHaveCount(5)
      await expect(help).toContainText(locale === 'en'
        ? 'Existing registrations and follows are not cancelled automatically.'
        : '既有報名與追蹤不會自動取消。')
      expect(mutations).toEqual([])
      // Check the changed content itself; the shared English header has a
      // separately tracked WebKit overflow independent of this disclosure.
      const helpBounds = await help.evaluate((element) => ({
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
        viewport: window.innerWidth,
      }))
      expect(helpBounds.left).toBeGreaterThanOrEqual(0)
      expect(helpBounds.right).toBeLessThanOrEqual(helpBounds.viewport)
      expect(helpBounds.contentWidth).toBeLessThanOrEqual(helpBounds.width)
      const results = await new AxeBuilder({ page }).include('details').analyze()
      expect(results.violations).toEqual([])
      await testInfo.attach(`block-help-${locale}`, {
        body: await page.screenshot({ path: testInfo.outputPath(`block-help-${locale}.png`), fullPage: true }), contentType: 'image/png',
      })

      const more = page.getByRole('button', { name: /More options|更多選項/ })
      await more.click()
      await page.getByRole('menuitem', { name: /^Block user$|^封鎖用戶$/ }).click()
      await expect(page.getByText(/User blocked\.|已封鎖用戶。/)).toBeVisible()
      await expect(summary).toBeVisible()
      await more.click()
      await page.getByRole('menuitem', { name: /^Unblock user$|^取消封鎖用戶$/ }).click()
      await expect(page.getByText(/User unblocked\.|已取消封鎖用戶。/)).toBeVisible()
      expect(mutations).toEqual(['POST', 'DELETE'])
      await summary.focus()
      await page.keyboard.press('Space')
      await expect(help).not.toHaveAttribute('open', '')
      await expect(summary).toBeFocused()
    })
  }


  for (const locale of ['en', 'zh-TW']) {
    test(`manages the personal blocklist (${locale})`, async ({ page }, testInfo) => {
      await page.addInitScript(value => localStorage.setItem('akaaka-locale', value), locale)
      let removed = false
      await page.route('**/rest/v1/blocks**', async route => {
        const request = route.request()
        expect(new URL(request.url()).searchParams.get('blocker_id')).toBe(`eq.${syntheticUserId}`)
        if (request.method() === 'DELETE') {
          expect(new URL(request.url()).searchParams.get('blocked_id')).toBe('eq.blocked-person')
          removed = true
          await route.fulfill({ status: 204 }); return
        }
        await route.fulfill({ json: removed ? [] : [{ blocked_id: 'blocked-person', created_at: '2026-09-01T00:00:00Z' }] })
      })
      await page.route('**/rest/v1/public_profiles**', route => route.fulfill({ json: [{ id: 'blocked-person', display_name: 'Blocked Person', avatar_path: null }] }))
      await gotoAuthenticatedRoute(page, '/settings/blocklist')
      const section = page.locator('.blocklist-page')
      await expect(section.getByRole('link', { name: 'Blocked Person' })).toBeVisible()
      await expect(section).not.toContainText('blocked-person')
      expect((await new AxeBuilder({ page }).include('.blocklist-page').analyze()).violations).toEqual([])
      expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`blocklist-${locale}.png`), fullPage: true })
      await section.getByRole('button', { name: /Unblock Blocked Person|解除封鎖 Blocked Person/ }).click()
      await expect(section.getByText(/Your blocklist is empty|您的黑名單目前沒有用戶/)).toBeVisible()
    })

    for (const flow of ['single', 'form', 'series', 'review'] as const) {
      test(`confirms blocklist ${flow} without writing on cancel (${locale})`, async ({ page }, testInfo) => {
        await page.addInitScript(value => localStorage.setItem('akaaka-locale', value), locale)
        const event = {
          id: 'conflict-event', creator_id: flow === 'review' ? syntheticUserId : 'host-profile',
          title: 'Blocklist event', description: 'Synthetic interaction verification',
          event_type: 'Movie', category: 'Social', visibility_settings: { type: 'public' },
          lifecycle_status: 'published', publication_status: 'published', start_time: '2099-01-08T12:00:00Z',
          registration_deadline: null, max_capacity: null, location_region: 'Online', location_detail: null,
          registration_form_config: flow === 'form' ? [{ id: 'answer', label: 'Registration answer', type: 'text', required: true }] : null,
          attendance_fee_type: 'free', attendance_fee_amount: null, external_registration_url: null,
          created_at: '2026-09-01T00:00:00Z',
        }
        await page.route('**/rest/v1/events?**', route => route.fulfill({ json: [event] }))
        if (flow === 'series') {
          await page.route('**/rest/v1/event_series_membership?**', route => route.fulfill({ json: [{ event_id: event.id, series_id: 'conflict-series', position: 1 }] }))
          await page.route('**/rest/v1/event_series?**', route => route.fulfill({ json: { id: 'conflict-series', creator_id: 'host-profile', title: 'Conflict series', is_whole_series_required: true, lifecycle_status: 'published' } }))
        }
        if (flow === 'review') {
          await page.route('**/rest/v1/event_registrations?**', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('profile_id') ? [] : [{ id: 'applicant-reg', event_id: event.id, profile_id: 'private-applicant-fixture', status: 'pending', created_at: '2026-09-01T00:00:00Z' }] }))
        }
        const name = flow === 'review' ? 'review-registration' : flow === 'series' ? 'register-for-event-series' : 'create-registration'
        const requests: Record<string, unknown>[] = []
        await page.route(`**/functions/v1/${name}`, async route => {
          const body = route.request().postDataJSON()
          requests.push(body)
          await route.fulfill(body.acknowledge_blocklist_conflict === true
            ? { status: 200, json: { success: true } }
            : { status: 409, json: { error: 'blocklist_confirmation_required', ...(flow === 'review' ? {} : { host_profile_id: 'host-profile', warning_event_id: event.id }) } })
        })
        await gotoAuthenticatedRoute(page, '/events/conflict-event')
        const submit = page.getByRole('button', { name: flow === 'review' ? /^Approve$|^核准報名$/ : flow === 'series' ? /^Confirm Registration$|^確認報名$/ : /^Register$|^報名參加$/ }).first()
        await expect(submit).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
        if (flow === 'form') {
          await submit.click()
          await page.getByLabel('Registration answer').fill('Keep my original answer')
        }
        await submit.click()
        const dialog = page.getByRole('alertdialog', { name: /Blocklist conflict|黑名單同場提醒/ })
        await expect(dialog).toBeVisible()
        const cancel = dialog.getByRole('button', { name: /^Cancel$|^取消$/ })
        await expect(cancel).toBeFocused()
        if (flow !== 'review') {
          await expect(dialog.getByRole('link', { name: /Message the host|開啟與主辦人的私訊/ })).toHaveAttribute('href', '/messages/new?user=host-profile')
          await expect(dialog.getByRole('link', { name: /View host profile|查看主辦人個人頁/ })).toHaveAttribute('href', '/profile/host-profile')
        } else {
          await expect(dialog).not.toContainText('private-applicant-fixture')
          await expect(dialog.getByRole('link')).toHaveCount(0)
        }
        expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([])
        expect(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth })).toBe(true)
        await page.screenshot({ path: testInfo.outputPath(`blocklist-${flow}-${locale}.png`), fullPage: true })
        const confirmButton = dialog.getByRole('button').last()
        expect(await confirmButton.evaluate(el => getComputedStyle(el).color !== getComputedStyle(el).backgroundColor)).toBe(true)
        expect((await confirmButton.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        await cancel.click()
        await expect(dialog).not.toBeVisible()
        await expect(submit).toBeFocused()
        expect(requests).toHaveLength(1)
        await submit.click()
        await expect(dialog).toBeVisible()
        await dialog.getByRole('button', { name: flow === 'review' ? /^Approve anyway$|^仍要核可$/ : /^Agree$|^同意$/ }).click()
        await expect(dialog).not.toBeVisible()
        expect(requests).toHaveLength(3)
        expect(requests[2]).toEqual({ ...requests[0], acknowledge_blocklist_conflict: true })
        if (flow === 'form') expect(requests[2].form_responses).toEqual({ answer: 'Keep my original answer' })
        if (flow === 'review') expect(requests[2]).toMatchObject({ event_id: 'conflict-event', registration_id: 'applicant-reg', action: 'approve' })
      })
    }
  }

  for (const route of authenticatedRoutes) {
    test(`keeps protected route authenticated: ${route}`, async ({ page }) => {
        await gotoAuthenticatedRoute(page, route)
      await expect(page.getByRole('heading', { name: /^登入$|^sign in$/i })).not.toBeVisible()
      await expect(page.locator('main')).toBeVisible()
    })
  }
})
