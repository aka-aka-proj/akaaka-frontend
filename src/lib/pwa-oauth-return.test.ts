import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPwaReturnLinks, isStandaloneDisplay, shouldMarkPwaReturn } from './pwa-oauth-return'

describe('PWA OAuth return', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('recognizes the iOS home-screen standalone flag without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    vi.stubGlobal('navigator', { standalone: true })
    expect(isStandaloneDisplay()).toBe(true)
  })

  it.each([
    ['x', 'Android Chrome', true, true],
    ['x', 'Android Chrome', false, true],
    ['google', 'Android Chrome', true, false],
    ['facebook', 'Android Chrome', true, false],
    ['x', 'iPhone Safari', true, true],
    ['x', 'Desktop Chrome', true, true],
  ])('marks X on every browser: %s / %s / %s', (provider, _ua, _standalone, expected) => {
    expect(shouldMarkPwaReturn(provider)).toBe(expected)
  })

  it('rebuilds a clean same-origin onboarding URL without callback credentials or return marker', () => {
    const source = '/events/mine?type=series&status=draft'
    const links = buildPwaReturnLinks('https://example.test', `?pwa_return=1&from=${encodeURIComponent(source)}&code=secret&access_token=secret`, 'Android Chrome')
    expect(links.continuePath).toBe(`/onboarding?from=${encodeURIComponent(source)}`)
    expect(links.intent).toBe(`intent://example.test${links.continuePath}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(`https://example.test${links.continuePath}`)};end`)
    expect(links.intent).not.toMatch(/secret|pwa_return|package=/)
  })

  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/events\n', 'javascript:alert(1)', '/auth?access_token=secret', '/events#access_token=secret', '/onboarding?pwa_return=1', '/onboarding?from=%2Fevents'])('rejects unsafe or recursive source %s', (source) => {
    expect(buildPwaReturnLinks('https://example.test', `?from=${encodeURIComponent(source)}`).continuePath).toBe('/onboarding?from=%2Fevents')
  })

  it.each(['iPhone Safari', 'Desktop Firefox', 'iPad Safari'])('does not offer an Android Intent on %s', (ua) => {
    expect(buildPwaReturnLinks('https://example.test', '?pwa_return=1', ua).intent).toBeNull()
  })

  it('does not offer an HTTPS intent for a non-HTTPS development origin', () => {
    expect(buildPwaReturnLinks('http://localhost:5173', '', 'Android Chrome').intent).toBeNull()
  })
})
