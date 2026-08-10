import { describe, expect, it } from 'vitest'
import { isAllowedExternalRegistrationUrl } from './external-registration'

describe('isAllowedExternalRegistrationUrl', () => {
  it('allows Google Forms and Docs HTTPS URLs', () => {
    expect(isAllowedExternalRegistrationUrl('https://docs.google.com/forms/d/e/example/viewform')).toBe(true)
    expect(isAllowedExternalRegistrationUrl('https://docs.google.com/document/d/example/edit')).toBe(true)
  })

  it('rejects unsafe schemes, hosts, ports, and redirect-like URLs', () => {
    expect(isAllowedExternalRegistrationUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalRegistrationUrl('https://evil.example/forms/example')).toBe(false)
    expect(isAllowedExternalRegistrationUrl('https://docs.google.com:8443/forms/example')).toBe(false)
    expect(isAllowedExternalRegistrationUrl('https://docs.google.com/forms.example')).toBe(false)
  })
})
