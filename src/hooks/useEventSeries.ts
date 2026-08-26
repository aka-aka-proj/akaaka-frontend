import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

export interface EventSeries {
  id: string
  creator_id: string
  title: string
  description: string | null
  is_whole_series_required: boolean
  display_order: number
  lifecycle_status: 'draft' | 'published' | 'archived' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface EventSeriesMember {
  event_id: string
  position: number
}

export interface EventSeriesWithMembers extends EventSeries {
  members: EventSeriesMember[]
}

export function useEventSeries(seriesId: string | null): EventSeriesWithMembers | null {
  const [series, setSeries] = useState<EventSeriesWithMembers | null>(null)

  useEffect(() => {
    if (!seriesId) {
      setSeries(null)
      return
    }

    let cancelled = false

    const load = async () => {
      const { data: seriesData, error: seriesError } = await supabase
        .from('event_series')
        .select('*')
        .eq('id', seriesId)
        .single()

      if (cancelled) return
      if (seriesError || !seriesData) {
        setSeries(null)
        return
      }

      const { data: membersData } = await supabase
        .from('event_series_membership')
        .select('event_id, position')
        .eq('series_id', seriesId)
        .order('position', { ascending: true })

      if (cancelled) return

      setSeries({
        ...(seriesData as EventSeries),
        members: (membersData as EventSeriesMember[]) ?? [],
      })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [seriesId])

  return series
}

export function useIsEventInSeries(eventId: string | undefined): {
  loading: boolean
  seriesId: string | null
} {
  const [loading, setLoading] = useState(true)
  const [seriesId, setSeriesId] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from('event_series_membership')
        .select('series_id')
        .eq('event_id', eventId)
        .maybeSingle()

      if (cancelled) return
      setSeriesId(data?.series_id ?? null)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [eventId])

  return { loading, seriesId }
}

export function useSeriesMembersEvents(seriesId: string | null): EventSeriesMember[] {
  const series = useEventSeries(seriesId)

  return useMemo(() => {
    if (!series) return []
    return series.members
  }, [series?.members])
}

export function useCurrentSeriesEventPosition(
  seriesId: string | null,
  currentEventId: string | undefined,
): number {
  const members = useSeriesMembersEvents(seriesId)

  return useMemo(() => {
    if (!currentEventId || members.length === 0) return -1
    return members.findIndex((m) => m.event_id === currentEventId)
  }, [members, currentEventId])
}