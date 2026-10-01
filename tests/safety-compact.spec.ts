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

// HTTPS origin is a local reverse-proxy fixture, never a hosted OAuth or Android Intent test.
for (const locale of ['zh-TW', 'en']) {
  test(`Android PWA return guidance is accessible and continues onboarding: ${locale}`, async ({ page, baseURL }) => {
    await installFixture(page, locale, true)
    await page.addInitScript(({ apiUrl }) => {
      Object.defineProperty(navigator, 'userAgent', { get: () => 'Android Chrome synthetic callback' })
      // WebKit rejects HTTP API calls from this HTTPS fixture before route interception.
      // Upgrade only the configured mock API; installFixture still supplies every response.
      const apiOrigin = new URL(apiUrl).origin
      const originalFetch = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input.toString())
        if (url.origin === apiOrigin && url.protocol === 'http:') {
          url.protocol = 'https:'
          return originalFetch(input instanceof Request ? new Request(url, input) : url, init)
        }
        return originalFetch(input, init)
      }
    }, { apiUrl: process.env.VITE_SUPABASE_URL || 'http://localhost:54321' })
    await page.route('https://pwa-return.example.test/**', async route => {
      const url = new URL(route.request().url())
      const upstream = new URL(`${url.pathname}${url.search}`, baseURL)
      await route.fulfill({ response: await route.fetch({ url: upstream.href, headers: { ...route.request().headers(), host: upstream.host } }) })
    })
    await page.goto('https://pwa-return.example.test/onboarding?pwa_return=1&from=%2Fevents%2Fmine&code=discard-me')
    const panel = page.getByRole('region', { name: locale === 'en' ? 'Signed in successfully' : '登入成功' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('heading')).toBeFocused()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const open = panel.getByRole('link')
    const href = await open.getAttribute('href')
    expect(href).toContain('intent://pwa-return.example.test/onboarding?from=%2Fevents%2Fmine#Intent;')
    expect(href).not.toMatch(/discard-me|pwa_return|package=/)
    await page.keyboard.press('Tab')
    await expect(open).toBeFocused()
    for (const action of await panel.locator('a, button').all()) {
      await expect(action).toBeInViewport({ ratio: 1 })
      const box = await action.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    await page.unrouteAll({ behavior: 'wait' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`pwa-return-${locale}.png`), fullPage: true })
    await panel.getByRole('button').click()
    await expect(page).toHaveURL('https://pwa-return.example.test/events/mine')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

test('Android standalone X callback carries return marker and source', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { get: () => 'Android Chrome synthetic standalone' })
    const original = window.matchMedia.bind(window)
    window.matchMedia = query => {
      const result = original(query)
      if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true })
      return result
    }
  })
  let authorizeUrl: URL | undefined
  await page.route('**/auth/v1/authorize**', route => {
    authorizeUrl = new URL(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>X callback boundary</title>' })
  })
  await page.goto('/auth?from=%2Fevents%2Fmine')
  const origin = new URL(page.url()).origin
  await page.getByRole('button', { name: /使用 X 登入|continue with x/i }).click()
  await expect.poll(() => authorizeUrl?.searchParams.get('provider')).toBe('x')
  expect(authorizeUrl?.searchParams.get('redirect_to')).toBe(`${origin}/onboarding?from=%2Fevents%2Fmine&pwa_return=1`)
})

// Native project UA is retained: Chromium/Firefox desktop and iPhone WebKit use the same flow.
test('X browser login carries the return marker without standalone emulation', async ({ page }) => {
  let callback: URL | undefined
  await page.route('**/auth/v1/authorize**', route => {
    callback = new URL(new URL(route.request().url()).searchParams.get('redirect_to')!)
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>X callback captured</title>' })
  })
  await page.goto('/auth?from=%2Fevents%2Fmine')
  expect(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches)).toBe(false)
  await page.getByRole('button', { name: /使用 X 登入|continue with x/i }).click()
  await expect.poll(() => callback?.searchParams.get('pwa_return')).toBe('1')
  expect(callback?.pathname).toBe('/onboarding')
  expect(callback?.searchParams.get('from')).toBe('/events/mine')
  await page.unrouteAll({ behavior: 'wait' })
})

for (const locale of ['zh-TW', 'en']) {
  test(`browser X callback offers a return choice with native user agent: ${locale}`, async ({ page }) => {
    await installFixture(page, locale, true)
    await page.goto('/onboarding?pwa_return=1&from=%2Fevents%2Fmine')
    const panel = page.getByRole('region', { name: locale === 'en' ? 'Signed in successfully' : '登入成功' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('heading')).toBeFocused()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const androidHttps = await page.evaluate(() => /Android/i.test(navigator.userAgent) && location.protocol === 'https:')
    await expect(panel.locator('a[href^="intent:"]')).toHaveCount(androidHttps ? 1 : 0)
    const proceed = panel.getByRole('button')
    await expect(proceed).toBeInViewport({ ratio: 1 })
    const box = await proceed.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`browser-return-${locale}.png`), fullPage: true })
    await proceed.click()
    await expect(page).toHaveURL(/\/events\/mine$/)
    await expect(panel).toHaveCount(0)
    await page.unrouteAll({ behavior: 'wait' })
  })
}

test('new X account completes compact and profile before the browser return choice', async ({ page }) => {
  await installFixture(page, 'en')
  let saved = false
  let profileWrites = 0
  await page.route('**/rest/v1/rpc/get_profile_for_viewer', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(saved ? syntheticProfile : null),
  }))
  await page.route('**/rest/v1/profiles', route => {
    if (route.request().method() === 'POST') { saved = true; profileWrites++ }
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })
  await page.goto('/onboarding?pwa_return=1&from=%2Fevents%2Fmine')
  const panel = page.getByRole('region', { name: 'Signed in successfully' })
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(panel).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: /agree.*continue/i }).click()
  await page.locator('form .onboarding-submit').click()
  const pushLater = page.locator('.onboarding-push-later')
  await expect(panel.or(pushLater)).toBeVisible()
  if (await pushLater.isVisible()) await pushLater.click()
  await expect(panel).toBeVisible()
  expect(profileWrites).toBe(1)
  await panel.getByRole('button').click()
  await expect(page).toHaveURL(/\/events\/mine$/)
  expect(profileWrites).toBe(1)
  await page.unrouteAll({ behavior: 'wait' })
})

for (const locale of ['zh-TW', 'en']) {
  test(`saved profile retry retains onboarding through failed and delayed RPC: ${locale}`, async ({ page }) => {
    await installFixture(page, locale)
    let profileWrites = 0
    let savedReads = 0
    let releaseRetry!: () => void
    const retryResponse = new Promise<void>(resolve => { releaseRetry = resolve })
    await page.route('**/rest/v1/profiles', route => {
      if (route.request().method() === 'POST') profileWrites++
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
    })
    await page.route('**/rest/v1/rpc/get_profile_for_viewer', async route => {
      if (!profileWrites) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
      savedReads++
      if (savedReads === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic temporary failure' }) })
      await retryResponse
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(syntheticProfile) })
    })
    try {
      await page.goto('/onboarding?pwa_return=1&from=%2Fevents%2Fmine')
      await page.getByRole('dialog').getByRole('button', { name: /agree.*continue|同意並繼續/i }).click()
      await page.locator('form .onboarding-submit').click()
      const recovery = page.locator('section[aria-labelledby="onboarding-refresh-title"]')
      const pushLater = page.locator('.onboarding-push-later')
      await expect(recovery.or(pushLater)).toBeVisible()
      if (await pushLater.isVisible()) await pushLater.click()
      await expect(recovery).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await recovery.getByRole('button').click()
      await expect.poll(() => savedReads).toBe(2)
      await expect(recovery).toBeVisible()
      await expect(recovery).toHaveAttribute('aria-busy', 'true')
      await expect(recovery.getByRole('button')).toBeDisabled()
      await expect(recovery.getByRole('button')).toHaveText(locale === 'en' ? 'Loading...' : '載入中...')
      await expect(pushLater).toHaveCount(0)
      expect(profileWrites).toBe(1)
      releaseRetry()
      const panel = page.getByRole('region', { name: locale === 'en' ? 'Signed in successfully' : '登入成功' })
      await expect(panel).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await panel.getByRole('button').click()
      await expect(page).toHaveURL(/\/events\/mine$/)
      expect(profileWrites).toBe(1)
    } finally {
      releaseRetry()
      await page.unrouteAll({ behavior: 'wait' })
    }
  })
}
