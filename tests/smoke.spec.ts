import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('public event discovery', () => {
  test('preserves the authentication boundary for event discovery', async ({ page }) => {
    await page.goto('/events')

    await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /電子郵件|email/i })).toBeVisible()
  })

  const protectedRoutes = [
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

  for (const route of protectedRoutes) {
    test(`preserves authentication boundary: ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    })
  }

  test('does not create horizontal overflow on a mobile viewport', async ({ page }) => {
    await page.goto('/events')
    await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
  })

  test('supports keyboard focus and validation on the authentication form', async ({ page }) => {
    await page.goto('/events')
    const email = page.getByRole('textbox', { name: /電子郵件|email/i })
    const password = page.getByLabel(/密碼|password/i)
    const signIn = page.getByRole('button', { name: /^(登入|sign in)$/i })

    await email.focus()
    await page.keyboard.press('Tab')
    await expect(password).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(signIn).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText(/請輸入電子郵件和密碼|email.*password/i)).toBeVisible()
  })

  test('has no automated axe violations on the authentication boundary', async ({ page }) => {
    await page.goto('/events')
    await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('matches the reviewed anonymous authentication-boundary visual baseline', async ({ page }, testInfo) => {
    test.skip(!['chromium-desktop', 'chromium-mobile'].includes(testInfo.project.name), 'Visual baseline is intentionally limited to reviewed Chromium states')
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'External CAPTCHA widgets are excluded from deterministic visual baselines; production runs keep functional and axe coverage')
    await page.addInitScript(() => localStorage.setItem('akaaka-locale', 'en'))
    await page.goto('/events')
    await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    await page.evaluate(() => {
      const mask = document.createElement('div')
      mask.dataset.screenshotMask = 'native-language-control'
      Object.assign(mask.style, {
        position: 'fixed',
        top: '20px',
        right: '175px',
        width: '130px',
        height: '70px',
        zIndex: '2147483647',
      })
      document.body.append(mask)
    })
    await expect(page).toHaveScreenshot('auth-boundary.png', {
      fullPage: true,
      animations: 'disabled',
      // Native language controls are rendered by the host browser/OS; functional coverage remains above.
      mask: [page.locator('[data-screenshot-mask="native-language-control"]')],
    })
  })
})
