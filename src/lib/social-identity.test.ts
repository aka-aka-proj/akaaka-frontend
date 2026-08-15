import { describe, expect, it } from 'vitest'
import { getSocialIdentityRedirect, getSocialVerificationPlatform } from './social-identity'

describe('social identity redirects', () => {
  it('keeps the provider callback on the current origin', () => {
    expect(getSocialIdentityRedirect('https://akaaka-frontend-preview.vercel.app', 'x'))
      .toBe('https://akaaka-frontend-preview.vercel.app/profile/me?social_verification=x')
  })

  it('accepts only supported verification platforms', () => {
    expect(getSocialVerificationPlatform('?social_verification=facebook')).toBe('facebook')
    expect(getSocialVerificationPlatform('?social_verification=instagram')).toBeNull()
  })
})
