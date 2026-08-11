import { describe, expect, it } from 'vitest'
import en from './en'
import zhTW from './zh-TW'

describe('privacy transparency translations', () => {
  it('keeps the sensitive-flow disclosure keys paired in both supported locales', () => {
    const keys = [
      'eventVisibility',
      'registrationResponses',
      'reportDetails',
      'issueDetails',
      'directMessage',
      'notifications',
      'aiConversation',
    ] as const

    for (const key of keys) {
      expect(en.privacyDisclosure[key]).toBeTruthy()
      expect(zhTW.privacyDisclosure[key]).toBeTruthy()
    }
  })
})
