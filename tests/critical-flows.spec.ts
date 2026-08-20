import { expect, test } from '@playwright/test'

test.describe('critical anonymous flows', () => {
  test('supports password recovery request validation and return to sign-in', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await expect(page.getByRole('heading', { name: /forgot password|忘記密碼/i })).toBeVisible()

    await page.getByRole('button', { name: /send reset email|寄送重設密碼信/i }).click()
    await expect(page.getByRole('status')).toContainText(/email|電子郵件/i)

    await page.getByRole('button', { name: /back to sign-in|返回登入/i }).click()
    await expect(page).toHaveURL(/\/auth$/)
  })

  test('prevents submitting mismatched new passwords', async ({ page }) => {
    await page.goto('/auth/reset-password')
    await page.getByLabel(/^new password$|^新密碼$/i).fill('first-password')
    await page.getByLabel(/^confirm new password$|^確認新密碼$/i).fill('different-password')
    await page.getByRole('button', { name: /save new password|儲存新密碼/i }).click()

    await expect(page.getByRole('status')).toContainText(/passwords do not match|密碼不一致/i)
  })

  test('keeps anonymous users out of every admin surface', async ({ page }) => {
    for (const route of ['/admin/moderation', '/admin/role-upgrade', '/admin/issues']) {
      await page.goto(route)
      await expect(page.getByRole('heading', { name: /sign in|登入/i })).toBeVisible()
      await expect(page).toHaveURL(/\/auth(?:\?from=[^&]*)?$/)
    }
  })
})
