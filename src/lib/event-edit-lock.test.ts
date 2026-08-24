import { afterEach, describe, expect, it, vi } from 'vitest'
import { isEventEditLocked } from './event-utils'

const NOW = new Date('2026-09-01T10:00:00.000Z').getTime()

const isoAt = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

afterEach(() => {
  vi.useRealTimers()
})

describe('isEventEditLocked', () => {
  it('keeps drafts editable even after start_time has passed', () => {
    vi.setSystemTime(NOW)
    expect(isEventEditLocked({ lifecycle_status: 'draft', start_time: isoAt(-3_600_000) })).toBe(false)
  })

  it('stays unlocked before start_time for live events', () => {
    vi.setSystemTime(NOW)
    expect(isEventEditLocked({ lifecycle_status: 'published', start_time: isoAt(3_600_000) })).toBe(false)
    expect(isEventEditLocked({ lifecycle_status: 'registration_open', start_time: isoAt(60_000) })).toBe(false)
  })

  it('locks at the exact start_time boundary and after', () => {
    vi.setSystemTime(NOW)
    expect(isEventEditLocked({ lifecycle_status: 'published', start_time: isoAt(0) })).toBe(true)
    expect(isEventEditLocked({ lifecycle_status: 'published', start_time: isoAt(-1) })).toBe(true)
  })

  it('locks terminal lifecycle statuses regardless of time', () => {
    vi.setSystemTime(NOW)
    for (const status of ['completed', 'archived', 'cancelled'] as const) {
      expect(isEventEditLocked({ lifecycle_status: status, start_time: isoAt(3_600_000) })).toBe(true)
    }
  })
})
