export type VerifiableSocialPlatform = 'x' | 'facebook'

export function getSocialIdentityRedirect(origin: string, platform: VerifiableSocialPlatform): string {
  return `${origin}/profile/me?social_verification=${encodeURIComponent(platform)}`
}

export function getSocialVerificationPlatform(search: string): VerifiableSocialPlatform | null {
  const platform = new URLSearchParams(search).get('social_verification')
  return platform === 'x' || platform === 'facebook' ? platform : null
}
