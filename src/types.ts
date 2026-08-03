export type RoleStatus = 'general' | 'venue_pending' | 'venue_approved' | 'admin'
export type SocialPlatform = 'facebook' | 'instagram' | 'x'
export type Visibility = 'public' | 'connections_only' | 'private'
export type EventCategory = 'Social' | 'Practice'

export type TaiwanRegion = 'North' | 'Central' | 'South' | 'East' | 'Islands' | 'Online'

export const TAIWAN_REGIONS: TaiwanRegion[] = ['North', 'Central', 'South', 'East', 'Islands', 'Online']

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
  | 'rigging'

export interface SocialLink {
  platform: SocialPlatform
  url: string
  is_connected?: boolean
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
    twitter_handle?: string
  } | null
  reputation_score: number
}

export interface EventItem {
  id: string
  creator_id: string
  title: string
  description: string | null
  category: EventCategory
  event_type: string | null
  is_venue_hosted: boolean
  visibility_settings: { type?: Visibility } | null
  registration_form_config: RegistrationFormField[] | null
  recurrence_rule: RecurrenceRule | null
  series_id: string | null
  start_time: string
  location_region: TaiwanRegion | null
  location_detail: string | null
  max_capacity: number | null
  registration_deadline: string | null
  created_at: string
  creator?: Profile | null
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'waitlisted' | 'cancellation_pending' | 'cancellation_rejected'

export interface Registration {
  id: string
  event_id: string
  profile_id: string
  status: RegistrationStatus
  waitlist_position: number | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  event?: EventItem | null
  profile?: Profile | null
}

export interface EventThread {
  id: string
  event_id: string
  profile_id: string
  content: string
  parent_id: string | null
  created_at: string
  profile?: Profile | null
}

export interface Recommendation {
  id: string
  from_profile_id: string
  to_profile_id: string
  score_increment: number
  comment: string | null
  created_at: string
  from_profile: { display_name: string | null } | null
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

export interface RegistrationFormField {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio'
  label: string
  required: boolean
  placeholder?: string
  options?: string[]
}

export interface RecurrenceRule {
  frequency: 'weekly' | 'monthly'
  interval: number
  days?: string[]
  count?: number
  until?: string
}

export interface RegistrationResponse {
  id: string
  registration_id: string
  responses: Record<string, unknown>
  created_at: string
}
