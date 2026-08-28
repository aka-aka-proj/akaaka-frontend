import { describe, expect, it } from 'vitest'
import { getInitialHostConsoleView } from '../lib/event-detail-view'

describe('EventDetailPage initial host console view', () => {
  it('defaults the event host to management mode', () => {
    expect(getInitialHostConsoleView(true)).toBe('management')
  })

  it('keeps non-host viewers in the participants view', () => {
    expect(getInitialHostConsoleView(false)).toBe('participants')
  })
})
