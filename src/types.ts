export type RoleStatus = 'general' | 'venue_pending' | 'venue_approved'
export type SocialPlatform = 'facebook' | 'instagram' | 'x'
export type Visibility = 'public' | 'connections_only' | 'private'

export type GenderIdentity =
  | 'man'
  | 'woman'
  | 'non_binary'
  | 'genderqueer'
  | 'agender'
  | 'bigender'
  | 'demiboy'
  | 'demigirl'
  | 'genderfluid'
  | 'two_spirit'
  | 'questioning'
  | 'other'

export type BdsmRole =
  | 'dom'
  | 'sub'
  | 'switch'
  | 'master'
  | 'slave'
  | 'owner'
  | 'pet'
  | 'brat'
  | 'rope_bunny'
  | 'rigging'

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export interface Profile {
  id: string
  role_status: RoleStatus
  display_name: string | null
  bio: string | null
  external_social_links: SocialLink[]
  metadata: {
    visibility?: {
      bio?: Visibility
      gender_identity?: Visibility
      bdsm_roles?: Visibility
    }
    gender_identity?: GenderIdentity
    bdsm_roles?: BdsmRole[]
  } | null
  reputation_score: number
}

export interface EventItem {
  id: string
  creator_id: string
  title: string
  description: string | null
  event_type: string | null
  is_venue_hosted: boolean
  visibility_settings: { type?: string } | null
  start_time: string
  created_at: string
}

export interface EventThread {
  id: string
  event_id: string
  profile_id: string
  content: string
  parent_id: string | null
  created_at: string
}

export interface ReportItem {
  id: string
  reporter_id: string
  target_profile_id: string | null
  target_event_id: string | null
  category: 'harassment' | 'impersonation' | 'spam' | 'safety_risk' | 'other'
  details: string
  status: 'open' | 'triaging' | 'resolved' | 'rejected'
  created_at: string
}
