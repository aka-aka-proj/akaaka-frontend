import { expect, test } from '@playwright/test'

test('iPhone Safari starts X OAuth with the expected provider and callback', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-mobile', 'This contract check targets the iPhone Safari/WebKit project')

  const pageErrors: Error[] = []
  const failedRequests: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`))

  let authorizeUrl: URL | null = null
  await page.route('**/auth/v1/authorize**', async (route) => {
    authorizeUrl = new URL(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>OAuth authorize intercepted</title>',
    })
  })

  await page.goto('/auth')
  const appOrigin = new URL(page.url()).origin
  await page.getByRole('button', { name: /continue with x|使用 x 登入/i }).click()
  await expect.poll(() => authorizeUrl?.searchParams.get('provider')).toBe('x')

  expect(authorizeUrl?.searchParams.get('redirect_to')).toBe(`${appOrigin}/onboarding`)
  expect(pageErrors).toEqual([])
  expect(failedRequests).toEqual([])
})
