import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { EventItem } from '../types'

interface SeriesDetail {
  id: string
  creator_id: string
  title: string
  description: string | null
  is_whole_series_required: boolean
  display_order: number
  lifecycle_status: 'draft' | 'published' | 'archived' | 'cancelled'
}

interface SeriesMemberRow {
  id: string
  event_id: string
  position: number
  event: EventItem | null
}

function normalizeMemberRows(data: unknown): SeriesMemberRow[] {
  if (!Array.isArray(data)) return []
  return data.map((row) => {
    const value = row as { id: string; event_id: string; position: number; event?: unknown }
    const nested = Array.isArray(value.event) ? value.event[0] : value.event
    return {
      id: value.id,
      event_id: value.event_id,
      position: value.position,
      event: (nested as EventItem | null | undefined) ?? null,
    }
  })
}

export function ManageEventSeriesPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { t } = useT()

  const [series, setSeries] = useState<SeriesDetail | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isWholeSeriesRequired, setIsWholeSeriesRequired] = useState(false)
  const [members, setMembers] = useState<SeriesMemberRow[]>([])
  const [allMyEvents, setAllMyEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showAddPicker, setShowAddPicker] = useState(false)

  const filterUnassignedDraftEvents = async (events: EventItem[]) => {
    const { data: memberships } = await supabase
      .from('event_series_membership')
      .select('event_id')
    const assignedIds = new Set((memberships ?? []).map((membership) => membership.event_id))
    return events.filter((event) => !assignedIds.has(event.id))
  }

  useEffect(() => {
    if (!user || !id) return
    let cancelled = false

    const load = async () => {
      const { data: seriesData, error: seriesError } = await supabase
        .from('event_series')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return

      if (seriesError || !seriesData) {
        setMessage('Series not found')
        setLoading(false)
        return
      }

      if ((seriesData as SeriesDetail).creator_id !== user.id) {
        setMessage('Only the series host can manage this series')
        setLoading(false)
        return
      }

      setSeries(seriesData as SeriesDetail)
      setTitle((seriesData as SeriesDetail).title)
      setDescription((seriesData as SeriesDetail).description ?? '')
      setIsWholeSeriesRequired((seriesData as SeriesDetail).is_whole_series_required)

      const { data: membersData } = await supabase
        .from('event_series_membership')
        .select('id, event_id, position, event:events(*)')
        .eq('series_id', id)
        .order('position', { ascending: true })

      if (cancelled) return
      const normalizedMembers = normalizeMemberRows(membersData)
      setMembers(normalizedMembers)

      // Load host's other events (for add picker)
      const existingIds = normalizedMembers.map((m) => m.event_id)
      let myEventsQuery = supabase
        .from('events')
        .select('*')
        .eq('creator_id', user.id)
        .eq('lifecycle_status', 'draft')
        .order('start_time', { ascending: false })
      if (existingIds.length > 0) {
        myEventsQuery = myEventsQuery.not('id', 'in', `(${existingIds.join(',')})`)
      }
      const { data: myEventsData } = await myEventsQuery

      if (cancelled) return
      setAllMyEvents(await filterUnassignedDraftEvents((myEventsData as EventItem[] | null) ?? []))
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [user, id])

  const canAdd = useMemo(() => series?.lifecycle_status === 'draft' && allMyEvents.length > 0, [series, allMyEvents])

  const handleSave = async (keepSaving = false): Promise<boolean> => {
    if (!user || !id) return false
    if (!title.trim()) {
      setMessage(t('eventSeries.seriesName') + ' is required')
      return false
    }
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('event_series')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        is_whole_series_required: isWholeSeriesRequired,
      })
      .eq('id', id)

    if (error) {
      setSaving(false)
      setMessage(error.message)
      return false
    }
    if (!keepSaving) setSaving(false)
    setMessage(t('eventSeries.manageSaved'))
    return true
  }

  const handleAddEvent = async (eventId: string) => {
    if (!id) return
    setSaving(true)
    const nextPosition = members.length + 1

    const { error } = await supabase.from('event_series_membership').insert([
      { series_id: id, event_id: eventId, position: nextPosition },
    ])

    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }

    // Refetch
    const { data: membersData } = await supabase
      .from('event_series_membership')
      .select('id, event_id, position, event:events(*)')
      .eq('series_id', id)
      .order('position', { ascending: true })
    const normalizedMembers = normalizeMemberRows(membersData)
    setMembers(normalizedMembers)

    let myEventsQuery = supabase
      .from('events')
      .select('*')
      .eq('creator_id', user!.id)
      .eq('lifecycle_status', 'draft')
      .order('start_time', { ascending: false })
    if (normalizedMembers.length > 0) {
      myEventsQuery = myEventsQuery.not('id', 'in', `(${normalizedMembers.map((m) => m.event_id).join(',')})`)
    }
    const { data: myEventsData } = await myEventsQuery
    setAllMyEvents(await filterUnassignedDraftEvents((myEventsData as EventItem[] | null) ?? []))
    setShowAddPicker(false)
  }

  const handleRemoveEvent = async (membershipId: string) => {
    if (!id) return
    setSaving(true)

    const { error } = await supabase.from('event_series_membership').delete().eq('id', membershipId)

    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }

    // Refetch and renormalize positions
    const { data: membersData } = await supabase
      .from('event_series_membership')
      .select('id, event_id, position, event:events(*)')
      .eq('series_id', id)
      .order('position', { ascending: true })

    const remaining = normalizeMemberRows(membersData)
    // Renormalize positions 1..n
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i + 1) {
        await supabase
          .from('event_series_membership')
          .update({ position: i + 1 })
          .eq('id', remaining[i].id)
      }
    }
    const normalized = remaining.map((m, i) => ({ ...m, position: i + 1 }))
    setMembers(normalized)

    let myEventsQuery = supabase
      .from('events')
      .select('*')
      .eq('creator_id', user!.id)
      .eq('lifecycle_status', 'draft')
      .order('start_time', { ascending: false })
    if (normalized.length > 0) {
      myEventsQuery = myEventsQuery.not('id', 'in', `(${normalized.map((m) => m.event_id).join(',')})`)
    }
    const { data: myEventsData } = await myEventsQuery
    setAllMyEvents(await filterUnassignedDraftEvents((myEventsData as EventItem[] | null) ?? []))
  }

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= members.length) return
    const previous = members
    const next = [...members]
    const a = next[index]
    const b = next[target]
    const aPos = a.position
    const bPos = b.position
    // Swap array order AND keep .position fields consistent with the DB,
    // so consecutive moves (before any refetch) read fresh positions.
    next[index] = { ...b, position: aPos }
    next[target] = { ...a, position: bPos }
    setMembers(next)

    // Persist the swap and restore UI/DB if either write fails.
    setSaving(true)
    const first = await supabase.from('event_series_membership').update({ position: aPos }).eq('id', b.id)
    if (first.error) {
      setMembers(previous)
      setSaving(false)
      setMessage(first.error.message)
      return
    }
    const second = await supabase.from('event_series_membership').update({ position: bPos }).eq('id', a.id)
    if (second.error) {
      await supabase.from('event_series_membership').update({ position: bPos }).eq('id', b.id)
      setMembers(previous)
      setSaving(false)
      setMessage(second.error.message)
      return
    }
    setSaving(false)
  }

  const handlePublish = async () => {
    if (!id || !series || series.lifecycle_status !== 'draft' || members.length < 2) return
    setSaving(true)
    setMessage('')
    const saved = await handleSave(true)
    if (!saved) {
      setSaving(false)
      return
    }
    const { data, error } = await supabase.functions.invoke('publish-event-series', {
      body: { series_id: id },
    })
    setSaving(false)
    if (error || !data?.success) {
      setMessage(error?.message ?? t('eventSeries.publishFailed'))
      return
    }
    setSeries((current) => current ? { ...current, lifecycle_status: 'published' } : current)
    setMessage(t('eventSeries.publishSucceeded'))
  }

  if (loading) {
    return (
      <Layout>
        <p>{t('common.loading')}</p>
      </Layout>
    )
  }

  if (!series) {
    return (
      <Layout>
        <p>{message || t('eventDetail.notFound')}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="card">
        <div className="create-event-header">
          <h1>{t('eventSeries.manageSeriesTitle')}</h1>
          <Link to={`/events/${members[0]?.event_id ?? ''}`} className="link-button">
            <Icon href="/action-icons.svg" name="action-chevron-left" size={14} />
            {t('eventSeries.backToSeries')}
          </Link>
        </div>

        {message && <p className="message">{message}</p>}

        <p className="form-field-hint">
          {series.lifecycle_status === 'draft' ? t('eventSeries.draftVisibility') : t('eventSeries.publishedVisibility')}
        </p>

        <div className="form-section" aria-labelledby="manage-basic-title">
          <h2 id="manage-basic-title">{t('eventSeries.basicInfo')}</h2>

          <label className="form-field">
            <span>{t('eventSeries.seriesName')} *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="form-field">
            <span>{t('eventSeries.seriesDescription')}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>

          <label className="checkbox" style={{ marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={isWholeSeriesRequired}
              onChange={(e) => setIsWholeSeriesRequired(e.target.checked)}
            />
            <div>
              <strong>{t('eventSeries.requiredBadge')}</strong>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{t('eventSeries.wholeSeriesHint')}</p>
            </div>
          </label>

          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="primary-cta primary-cta--small" disabled={saving || !title.trim()} onClick={() => void handleSave()}>
              {saving ? t('common.processing') : t('eventSeries.saveSeries')}
            </button>
            {series.lifecycle_status === 'draft' && (
              <button
                type="button"
                className="primary-cta primary-cta--small"
                style={{ marginLeft: '0.5rem' }}
                disabled={saving || members.length < 2 || !title.trim()}
                onClick={() => void handlePublish()}
              >
                {t('eventSeries.publishSeries')}
              </button>
            )}
          </div>
        </div>

        <div className="form-section" aria-labelledby="manage-members-title">
          <div className="form-section-heading">
            <h2 id="manage-members-title">{t('eventSeries.memberEvents', { count: members.length })}</h2>
            {series.lifecycle_status === 'draft' && (
              <div>
                <Link to={`/events/new?series_id=${id}`} className="secondary-action">
                  {t('eventSeries.createSession')}
                </Link>
                {canAdd && (
                  <button type="button" className="secondary-action" style={{ marginLeft: '0.5rem' }} onClick={() => setShowAddPicker(true)}>
                    {t('eventSeries.addDraftEvent')}
                  </button>
                )}
              </div>
            )}
          </div>

          <ol className="series-manage-list">
            {members.map((member, index) => (
              <li key={member.id} className="series-manage-item">
                <span className="series-manage-position">{index + 1}</span>
                <div className="series-manage-info">
                  <span className="series-manage-title">{member.event?.title ?? '?'}</span>
                  <span className="series-manage-time">
                    {member.event ? new Date(member.event.start_time).toLocaleString() : ''}
                  </span>
                </div>
                {series.lifecycle_status === 'draft' && (
                  <div className="series-manage-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void handleMove(index, -1)}
                      disabled={index === 0 || saving}
                      aria-label={t('eventSeries.moveUp')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void handleMove(index, 1)}
                      disabled={index === members.length - 1 || saving}
                      aria-label={t('eventSeries.moveDown')}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="danger-action"
                      onClick={() => void handleRemoveEvent(member.id)}
                      disabled={saving}
                    >
                      {t('eventSeries.removeEvent')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {members.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)' }}>{t('eventSeries.noEligibleEvents')}</p>
          )}
        </div>

        {showAddPicker && (
          <div className="modal-overlay" role="presentation" onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAddPicker(false)
          }}>
            <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="add-event-title">
              <div className="report-modal-header">
                <h3 id="add-event-title">{t('eventSeries.addDraftEvent')}</h3>
                <button type="button" className="modal-close" onClick={() => setShowAddPicker(false)} aria-label={t('common.close')}>×</button>
              </div>
              <div className="modal-body" style={{ padding: '1rem' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {allMyEvents.map((event) => (
                    <li key={event.id} className="thread-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                      <span>{event.title}</span>
                      <button type="button" className="primary-cta primary-cta--small" onClick={() => void handleAddEvent(event.id)}>
                        {t('eventSeries.addDraftEvent')}
                      </button>
                    </li>
                  ))}
                  {allMyEvents.length === 0 && <p>{t('eventSeries.noEligibleEvents')}</p>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
