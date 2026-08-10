import { describe, expect, it } from 'vitest'
import { isAllowedEventSourceUrl } from './event-source'

describe('isAllowedEventSourceUrl', () => {
  it('allows the supported X and BDSM calendar URL shapes', () => {
    expect(isAllowedEventSourceUrl('https://x.com/example/status/123')).toBe(true)
    expect(isAllowedEventSourceUrl('https://todo.smertw.com/events/6138')).toBe(true)
  })

  it('rejects redirects, arbitrary hosts, and malformed paths', () => {
    expect(isAllowedEventSourceUrl('https://bit.ly/example')).toBe(false)
    expect(isAllowedEventSourceUrl('https://todo.smertw.com/events/6138/extra')).toBe(false)
    expect(isAllowedEventSourceUrl('https://x.com:8443/example/status/123')).toBe(false)
  })
})
