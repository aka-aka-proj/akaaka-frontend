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


async function installFixture(page: Page, locale = 'zh-TW', existingProfile = false) {
  await page.addInitScript(({ session, keys, locale }) => {
    for (const key of keys) localStorage.setItem(key, JSON.stringify(session))
    localStorage.setItem('akaaka-locale', locale)
  }, { session: syntheticSession, keys: syntheticStorageKeys, locale })
  await page.route('**/rest/v1/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: route.request().url().includes('get_profile_for_viewer')
      ? JSON.stringify(existingProfile ? syntheticProfile : null) : '[]',
  }))
  await page.route('**/auth/v1/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(syntheticSession.user),
  }))
  await page.route('**/functions/v1/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
}

async function expectActionsVisible(page: Page) {
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button')).toHaveCount(2)
  for (const button of await dialog.getByRole('button').all()) {
    await expect(button).toBeInViewport({ ratio: 1 })
    expect(await button.evaluate(el => {
      const r = el.getBoundingClientRect()
      const clip = el.closest('dialog')!.getBoundingClientRect()
      return r.top >= clip.top && r.bottom <= clip.bottom && r.left >= clip.left && r.right <= clip.right && r.height >= 44 && r.width >= 44
    })).toBe(true)
  }
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
}

for (const locale of ['zh-TW', 'en']) {
  test(`compact actions remain reachable through resize and large text: ${locale}`, async ({ page }) => {
    await installFixture(page, locale)
    await page.goto('/onboarding')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expectActionsVisible(page)
    await page.screenshot({ path: test.info().outputPath(`compact-default-${locale}.png`) })
    const readingArea = dialog.locator('[tabindex="0"]')
    await expect(readingArea).toBeFocused()
    expect(await readingArea.evaluate(el => el.scrollTop)).toBe(0)
    // Native dialogs may hand focus to browser chrome (reported as body), never background controls.
    for (let index = 0; index < 4; index++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body)).toBe(true)
    }
    for (const viewport of [{ width: 390, height: 480 }, { width: 360, height: 560 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport)
      await expectActionsVisible(page)
    }
    await page.setViewportSize({ width: 390, height: 640 })
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    await expectActionsVisible(page)
    await page.screenshot({ path: test.info().outputPath(`compact-${locale}.png`) })
    const body = dialog.locator('[tabindex="0"]')
    await body.evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect(dialog.getByText(/When you delete|刪除帳號時/i)).toBeInViewport()
    await expectActionsVisible(page)
  })
}

test('agree shows profile form and moves focus without submitting', async ({ page }) => {
  await installFixture(page)
  const writes: string[] = []
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/rest/v1/profiles')) writes.push(request.url())
  })
  await page.goto('/onboarding')
  await expect(page.getByLabel('顯示名稱', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /我同意|同意並繼續/ }).click()
  await expect(page.getByLabel('顯示名稱', { exact: true })).toBeVisible()
  await expect(page.locator('.onboarding-header h1')).toBeFocused()
  expect(writes).toEqual([])
})

for (const cancel of ['button', 'Escape']) {
  test(`cancel using ${cancel} signs out without creating a profile`, async ({ page }) => {
    await installFixture(page)
    let signedOut = false
    await page.route('**/auth/v1/logout**', route => {
      signedOut = true
      return route.fulfill({ status: 204 })
    })
    let profileWrites = 0
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().includes('/rest/v1/profiles')) profileWrites++
    })
    await page.goto('/onboarding')
    await expect(page.getByRole('dialog')).toBeVisible()
    if (cancel === 'Escape') await page.keyboard.press('Escape')
    else await page.getByRole('button', { name: '不同意，離開' }).click()
    await expect(page).toHaveURL(/\/auth(?:\?.*)?$/)
    expect(signedOut).toBe(true)
    expect(profileWrites).toBe(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

test('existing profile skips safety compact', async ({ page }) => {
  await installFixture(page, 'zh-TW', true)
  await page.goto('/onboarding')
  await expect(page).toHaveURL(/\/events$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

// This checks the application's OAuth redirect contract, not a live Google sign-in.
test('Google sign-in starts the onboarding callback', async ({ page }) => {
  let authorizeUrl: URL | undefined
  await page.route('**/auth/v1/authorize**', route => {
    authorizeUrl = new URL(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google redirect boundary</title>' })
  })
  await page.goto('/auth')
  const origin = new URL(page.url()).origin
  await page.getByRole('button', { name: /使用 Google 登入|continue with google/i }).click()
  await expect.poll(() => authorizeUrl?.searchParams.get('provider')).toBe('google')
  expect(authorizeUrl?.searchParams.get('redirect_to')).toBe(`${origin}/onboarding`)
})

test('OAuth onboarding completion returns to the requested filtered list', async ({ page }) => {
  await installFixture(page)
  await page.addInitScript(() => {
    if ('Notification' in window) Object.defineProperty(Notification, 'permission', { get: () => 'denied' })
  })
  let saved = false
  await page.route('**/rest/v1/rpc/get_profile_for_viewer', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(saved ? syntheticProfile : null),
  }))
  await page.route('**/rest/v1/profiles', route => {
    expect(route.request().method()).toBe('POST')
    saved = true
    return route.fulfill({ status: 201, contentType: 'application/json', body: 'null' })
  })
  const destination = '/events/mine?type=series&status=published'
  await page.goto(`/onboarding?from=${encodeURIComponent(destination)}`)
  await page.getByRole('button', { name: '同意並繼續' }).click()
  await page.getByRole('button', { name: '完成導覽' }).click()
  await expect(page).toHaveURL(new RegExp('/events/mine\\?type=series&status=published$'))
  await expect(page.getByRole('button', { name: '活動系列', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '已發布', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
