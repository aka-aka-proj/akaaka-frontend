import type { SupabaseClient } from '@supabase/supabase-js'

export type SchedulingPollStatus = 'open' | 'closed'
export type SchedulingPollOptionKind = 'datetime' | 'location'

export interface SchedulingPoll {
  id: string
  eventId: string
  creatorId: string
  status: SchedulingPollStatus
  closedAt: string | null
}

export interface SchedulingPollOption {
  id: string
  pollId: string
  kind: SchedulingPollOptionKind
  startsAt: string | null
  locationLabel: string | null
  sortOrder: number
}

export interface SchedulingPollSnapshot {
  poll: SchedulingPoll
  options: SchedulingPollOption[]
  eligibleVoterIds: string[]
  selectedOptionIds: string[]
  voteCounts: Record<string, number>
}

export interface SchedulingPollCandidateInput {
  kind: SchedulingPollOptionKind
  startsAt?: string
  locationLabel?: string
}

export interface FinalizeSchedulingPollInput {
  datetimeOptionId?: string | null
  locationOptionId?: string | null
}

type PollRow = {
  id: string
  event_id: string
  creator_id: string
  status: SchedulingPollStatus
  closed_at: string | null
}

type OptionRow = {
  id: string
  poll_id: string
  kind: SchedulingPollOptionKind
  starts_at: string | null
  location_label: string | null
  sort_order: number
}

type VoterRow = { profile_id: string }
type VoteRow = { option_id: string }
type ResultRow = { option_id: string; vote_count: number | string }

function mapPoll(row: PollRow): SchedulingPoll {
  return {
    id: row.id,
    eventId: row.event_id,
    creatorId: row.creator_id,
    status: row.status,
    closedAt: row.closed_at,
  }
}

function mapOption(row: OptionRow): SchedulingPollOption {
  return {
    id: row.id,
    pollId: row.poll_id,
    kind: row.kind,
    startsAt: row.starts_at,
    locationLabel: row.location_label,
    sortOrder: row.sort_order,
  }
}

export function validateSchedulingPollCandidates(candidates: SchedulingPollCandidateInput[]) {
  if (candidates.length < 2) throw new Error('A scheduling poll requires at least two candidates.')

  for (const candidate of candidates) {
    if (candidate.kind === 'datetime') {
      if (!candidate.startsAt || candidate.locationLabel) {
        throw new Error('Datetime candidates require startsAt and cannot include locationLabel.')
      }
    } else if (!candidate.locationLabel?.trim() || candidate.startsAt) {
      throw new Error('Location candidates require locationLabel and cannot include startsAt.')
    }
  }
}

export async function loadSchedulingPollForEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SchedulingPollSnapshot | null> {
  const { data: pollData, error: pollError } = await supabase
    .from('event_scheduling_polls')
    .select('id,event_id,creator_id,status,closed_at')
    .eq('event_id', eventId)
    .maybeSingle()

  if (pollError) throw pollError
  if (!pollData) return null

  const poll = mapPoll(pollData as PollRow)
  const [optionsResponse, votersResponse, votesResponse, resultsResponse] = await Promise.all([
    supabase.from('event_scheduling_poll_options').select('id,poll_id,kind,starts_at,location_label,sort_order').eq('poll_id', poll.id).order('sort_order'),
    supabase.from('event_scheduling_poll_voters').select('profile_id').eq('poll_id', poll.id),
    supabase.from('event_scheduling_poll_votes').select('option_id').eq('poll_id', poll.id),
    supabase.rpc('get_event_scheduling_poll_results', { p_poll_id: poll.id }),
  ])

  if (optionsResponse.error) throw optionsResponse.error
  if (votersResponse.error) throw votersResponse.error
  if (votesResponse.error) throw votesResponse.error
  if (resultsResponse.error) throw resultsResponse.error

  const voteCounts = Object.fromEntries(
    ((resultsResponse.data ?? []) as ResultRow[]).map((row) => [row.option_id, Number(row.vote_count)]),
  )

  return {
    poll,
    options: ((optionsResponse.data ?? []) as OptionRow[]).map(mapOption),
    eligibleVoterIds: ((votersResponse.data ?? []) as VoterRow[]).map((row) => row.profile_id),
    selectedOptionIds: ((votesResponse.data ?? []) as VoteRow[]).map((row) => row.option_id),
    voteCounts,
  }
}

export async function createSchedulingPoll(
  supabase: SupabaseClient,
  input: {
    eventId: string
    creatorId: string
    candidates: SchedulingPollCandidateInput[]
    eligibleVoterIds: string[]
  },
): Promise<string> {
  validateSchedulingPollCandidates(input.candidates)

  const { data: pollData, error: pollError } = await supabase
    .from('event_scheduling_polls')
    .insert({ event_id: input.eventId, creator_id: input.creatorId })
    .select('id')
    .single()
  if (pollError) throw pollError

  const pollId = (pollData as { id: string }).id
  const optionRows = input.candidates.map((candidate, sortOrder) => ({
    poll_id: pollId,
    kind: candidate.kind,
    starts_at: candidate.kind === 'datetime' ? candidate.startsAt : null,
    location_label: candidate.kind === 'location' ? candidate.locationLabel?.trim() : null,
    sort_order: sortOrder,
  }))

  const { error: optionError } = await supabase.from('event_scheduling_poll_options').insert(optionRows)
  if (optionError) throw optionError

  if (input.eligibleVoterIds.length > 0) {
    const { error: voterError } = await supabase.from('event_scheduling_poll_voters').insert(
      [...new Set(input.eligibleVoterIds)].map((profileId) => ({ poll_id: pollId, profile_id: profileId })),
    )
    if (voterError) throw voterError
  }

  return pollId
}

export async function replaceMySchedulingPollVotes(
  supabase: SupabaseClient,
  pollId: string,
  profileId: string,
  optionIds: string[],
) {
  const { error: deleteError } = await supabase
    .from('event_scheduling_poll_votes')
    .delete()
    .eq('poll_id', pollId)
    .eq('profile_id', profileId)
  if (deleteError) throw deleteError

  const uniqueOptionIds = [...new Set(optionIds)]
  if (uniqueOptionIds.length === 0) return

  const { error: insertError } = await supabase.from('event_scheduling_poll_votes').insert(
    uniqueOptionIds.map((optionId) => ({ poll_id: pollId, option_id: optionId, profile_id: profileId })),
  )
  if (insertError) throw insertError
}

export async function resetSchedulingPollVotes(supabase: SupabaseClient, pollId: string) {
  const { error } = await supabase.rpc('reset_event_scheduling_poll_votes', { p_poll_id: pollId })
  if (error) throw error
}

export async function finalizeSchedulingPoll(
  supabase: SupabaseClient,
  pollId: string,
  input: FinalizeSchedulingPollInput,
) {
  const { data, error } = await supabase.rpc('finalize_event_scheduling_poll', {
    p_poll_id: pollId,
    p_datetime_option_id: input.datetimeOptionId ?? null,
    p_location_option_id: input.locationOptionId ?? null,
  })
  if (error) throw error
  return data
}
