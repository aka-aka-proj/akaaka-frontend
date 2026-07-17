import type { Profile, SocialLink, Visibility } from '../types'

const SOCIAL_PLATFORMS = new Set(['facebook', 'instagram', 'x'])
const VISIBILITY_OPTIONS = new Set(['public', 'connections_only', 'private'])

export function normalizeSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null
      }

      const platform = Reflect.get(item, 'platform')
      const url = Reflect.get(item, 'url')
      if (
        typeof platform !== 'string' ||
        typeof url !== 'string' ||
        !SOCIAL_PLATFORMS.has(platform) ||
        url.trim().length === 0
      ) {
        return null
      }

      return { platform: platform as SocialLink['platform'], url: url.trim() }
    })
    .filter((item): item is SocialLink => item !== null)
}

export function getBioVisibility(profile: Profile | null | undefined): Visibility {
  const visibility = profile?.metadata?.visibility?.bio
  if (visibility && VISIBILITY_OPTIONS.has(visibility)) {
    return visibility
  }

  return 'public'
}

export function canViewBio(
  viewerId: string | null | undefined,
  profileId: string,
  visibility: Visibility,
) {
  if (viewerId === profileId) {
    return true
  }

  return visibility === 'public'
}
