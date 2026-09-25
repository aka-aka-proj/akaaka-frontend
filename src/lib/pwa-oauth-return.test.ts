import { describe, expect, it } from 'vitest'
import { buildPwaReturnLinks, shouldMarkPwaReturn } from './pwa-oauth-return'

describe('PWA OAuth return', () => {
  it.each([
    ['x', 'Android Chrome', true, true],
    ['x', 'Android Chrome', false, false],
    ['google', 'Android Chrome', true, false],
    ['facebook', 'Android Chrome', true, false],
    ['x', 'iPhone Safari', true, false],
    ['x', 'Desktop Chrome', true, false],
  ])('marks only Android standalone X: %s / %s / %s', (provider, ua, standalone, expected) => {
    expect(shouldMarkPwaReturn(provider, ua, standalone)).toBe(expected)
  })

  it('rebuilds a clean same-origin onboarding URL without callback credentials or return marker', () => {
    const source = '/events/mine?type=series&status=draft'
    const links = buildPwaReturnLinks('https://example.test', `?pwa_return=1&from=${encodeURIComponent(source)}&code=secret&access_token=secret`)
    expect(links.continuePath).toBe(`/onboarding?from=${encodeURIComponent(source)}`)
    expect(links.intent).toBe(`intent://example.test${links.continuePath}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(`https://example.test${links.continuePath}`)};end`)
    expect(links.intent).not.toMatch(/secret|pwa_return|package=/)
  })

  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/events\n', 'javascript:alert(1)', '/auth?access_token=secret', '/events#access_token=secret', '/onboarding?pwa_return=1', '/onboarding?from=%2Fevents'])('rejects unsafe or recursive source %s', (source) => {
    expect(buildPwaReturnLinks('https://example.test', `?from=${encodeURIComponent(source)}`).continuePath).toBe('/onboarding?from=%2Fevents')
  })

  it('does not offer an HTTPS intent for a non-HTTPS development origin', () => {
    expect(buildPwaReturnLinks('http://localhost:5173', '').intent).toBeNull()
  })
})
