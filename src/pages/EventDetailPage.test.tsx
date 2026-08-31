import { describe, expect, it } from 'vitest'
import { getInitialHostConsoleView, shouldShowPublishShortcut } from '../lib/event-detail-view'

describe('EventDetailPage initial host console view', () => {
  it('defaults the event host to management mode', () => {
    expect(getInitialHostConsoleView(true)).toBe('management')
  })

  it('keeps non-host viewers in the participants view', () => {
    expect(getInitialHostConsoleView(false)).toBe('participants')
  })

  it('shows the publish shortcut for drafts and unpublished events', () => {
    expect(shouldShowPublishShortcut('draft', 'closed')).toBe(true)
    expect(shouldShowPublishShortcut('published', 'closed')).toBe(true)
  })

  it('does not show a duplicate publish shortcut for published events', () => {
    expect(shouldShowPublishShortcut('published', 'published')).toBe(false)
  })
})
