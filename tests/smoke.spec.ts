import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('public event discovery', () => {
  test('preserves the authentication boundary for event discovery', async ({ page }) => {
    await page.goto('/events')

    await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /電子郵件|email/i })).toBeVisible()
  })

  test('preserves the authentication boundary for every protected route', async ({ page }) => {
    const protectedRoutes = [
      '/onboarding',
      '/events',
      '/events/new',
      '/events/bookmarks',
      '/events/example/edit',
      '/events/example',
      '/profile/me',
      '/profile/me/edit',
      '/profile/me/feedback',
      '/profile/me/reports',
      '/profile/example',
      '/reports/me',
      '/registrations/me',
      '/notifications',
      '/messages',
      '/following',
      '/settings/notifications',
      '/issues',
      '/issues/new',
      '/virtual-lovers',
      '/virtual-lovers/new',
      '/settings/security-privacy',
      '/settings/analytics',
    ]

    for (const route of protectedRoutes) {
      await page.goto(route)
      await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    }
  })

  test('does not create horizontal overflow on a mobile viewport', async ({ page }) => {
    await page.goto('/events')
    await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
  })

  test('has no automated axe violations on the authentication boundary', async ({ page }) => {
    await page.goto('/events')
    await expect(page.getByRole('heading', { name: /登入|sign in/i })).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
})
