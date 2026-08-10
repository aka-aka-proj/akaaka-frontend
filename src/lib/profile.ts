import type { Profile, SocialLink, Visibility } from '../types'

const SOCIAL_PLATFORMS = new Set(['facebook', 'instagram', 'x'])
const VISIBILITY_OPTIONS = new Set(['public', 'connections_only', 'private'])

export const PRESET_AVATAR_PATHS = [
  'Creative_studio_20260806_202218.jpg',
  'Creative_studio_20260806_202339.jpg',
  'Creative_studio_20260806_202422.jpg',
  'Creative_studio_20260806_202518.jpg',
  'Creative_studio_20260806_202557.jpg',
  'Creative_studio_20260806_202648.jpg',
  'Creative_studio_20260806_202733.jpg',
  'Creative_studio_20260806_203217.jpg',
  'Creative_studio_20260806_203310.jpg',
  'Creative_studio_20260806_203532.jpg',
  'Creative_studio_20260806_203647.jpg',
  'Creative_studio_20260806_203804.jpg',
  'Creative_studio_20260806_203938.jpg',
  'Creative_studio_20260806_204120.jpg',
  'Creative_studio_20260806_204327.jpg',
].map((filename) => `/avatar/${filename}`)

const PRESET_AVATAR_PATH_SET = new Set(PRESET_AVATAR_PATHS)

export function getAvatarPath(profile: Pick<Profile, 'metadata'> | null | undefined): string {
  const avatarPath = profile?.metadata?.avatar_path
  return typeof avatarPath === 'string' && PRESET_AVATAR_PATH_SET.has(avatarPath)
    ? avatarPath
    : '/default-avatar.svg'
}

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

export function mapProfileRow(row: unknown): Profile {
  const source = (row ?? {}) as Record<string, unknown>
  return {
    id: String(source.id ?? ''),
    role_status: (source.role_status as Profile['role_status']) ?? 'general',
    display_name: (source.display_name as string | null) ?? null,
    bio: (source.bio as string | null) ?? null,
    external_social_links: normalizeSocialLinks(source.external_social_links),
    metadata: (source.metadata as Profile['metadata']) ?? null,
    reputation_score: Number(source.reputation_score ?? 0),
  }
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
