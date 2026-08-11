import { describe, expect, it } from 'vitest'
import { getAttendanceFeeLabel } from './event-utils'

describe('getAttendanceFeeLabel', () => {
  it('renders free and description-only fees in both supported locales', () => {
    expect(getAttendanceFeeLabel('free', null, 'zh-TW')).toBe('免費')
    expect(getAttendanceFeeLabel('free', null, 'en')).toBe('Free')
    expect(getAttendanceFeeLabel('see_description', null, 'zh-TW')).toBe('依活動說明')
    expect(getAttendanceFeeLabel('see_description', null, 'en')).toBe('See description')
  })

  it('renders fixed fees without implying payment processing', () => {
    expect(getAttendanceFeeLabel('fixed', 500, 'zh-TW')).toBe('NT$ 500')
    expect(getAttendanceFeeLabel('fixed', 500, 'en')).toBe('NT$ 500')
  })
})
