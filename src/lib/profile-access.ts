import type { PostgrestError } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../supabaseClient'
import { mapProfileRow } from './profile'

export async function getProfileForViewer(profileId: string): Promise<{
  data: Profile | null
  error: PostgrestError | null
}> {
  const { data, error } = await supabase
    .rpc('get_profile_for_viewer', { target_profile_id: profileId })
    .maybeSingle()

  return { data: data ? mapProfileRow(data) : null, error }
}

export async function getProfilesForViewer(profileIds: string[]): Promise<{
  data: Profile[]
  error: PostgrestError | null
}> {
  const results = await Promise.all(profileIds.map(getProfileForViewer))
  return {
    data: results.flatMap((result) => result.data ? [result.data] : []),
    error: results.find((result) => result.error)?.error ?? null,
  }
}
