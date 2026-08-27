import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { EventItem } from '../types'

interface SelectableEvent extends EventItem {
  selected: boolean
}

export function CreateEventSeriesPage() {
  const { user } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isWholeSeriesRequired, setIsWholeSeriesRequired] = useState(false)
  const [myEvents, setMyEvents] = useState<SelectableEvent[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('creator_id', user.id)
        .in('lifecycle_status', ['published', 'registration_open', 'completed'])
        .order('start_time', { ascending: false })

      if (cancelled) return
      setMyEvents((data as SelectableEvent[] | null)?.map((e) => ({ ...e, selected: false })) ?? [])
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [user])

  const selectedEvents = useMemo(
    () => myEvents.filter((e) => selectedIds.has(e.id)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [myEvents, selectedIds],
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    if (!user || selectedEvents.length < 2) return
    setSubmitting(true)
    setMessage('')

    // Normalize: check no event is already in a series
    const { data: existingMemberships } = await supabase
      .from('event_series_membership')
      .select('event_id')
      .in('event_id', selectedEvents.map((e) => e.id))

    if (existingMemberships && existingMemberships.length > 0) {
      const taken = existingMemberships.map((m) => m.event_id)
      setMessage(`Some events already belong to another series: ${taken.join(', ')}`)
      setSubmitting(false)
      return
    }

    const memberEvents = selectedEvents.map((e, i) => ({
      event_id: e.id,
      position: i + 1,
    }))

    const { error } = await supabase.functions.invoke('create-event-series', {
      body: {
        title: title.trim(),
        description: description.trim() || undefined,
        is_whole_series_required: isWholeSeriesRequired,
        member_events: memberEvents,
      },
    })

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    navigate(`/events/${selectedEvents[0].id}`)
  }

  if (loading) {
    return (
      <Layout>
        <p>{t('common.loading')}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="card">
        <div className="create-event-header">
          <h1>{t('eventSeries.createSeriesTitle')}</h1>
        </div>

        <div className="form-section" aria-labelledby="series-basic-title">
          <h2 id="series-basic-title">{t('eventSeries.basicInfo')}</h2>

          <label className="form-field">
            <span>{t('eventSeries.seriesName')} *</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('eventSeries.seriesNamePlaceholder')}
              required
            />
          </label>

          <label className="form-field">
            <span>{t('eventSeries.seriesDescription')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('eventSeries.seriesDescriptionPlaceholder')}
              rows={3}
            />
          </label>

          <label className="checkbox" style={{ marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={isWholeSeriesRequired}
              onChange={(e) => setIsWholeSeriesRequired(e.target.checked)}
            />
            <div>
              <strong>{t('eventSeries.requiredBadge')}</strong>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                {t('eventSeries.wholeSeriesHint')}
              </p>
            </div>
          </label>
        </div>

        <div className="form-section" aria-labelledby="series-events-title">
          <h2 id="series-events-title">{t('eventSeries.selectEvents', { count: selectedEvents.length, min: 2 })}</h2>

          {message && <p className="message">{message}</p>}

          {myEvents.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)' }}>{t('eventSeries.noEligibleEvents')}</p>
          )}

          <div className="series-event-select-grid">
            {myEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className={`series-event-select-item${selectedIds.has(event.id) ? ' selected' : ''}`}
                onClick={() => toggleSelect(event.id)}
              >
                <div className="series-event-select-info">
                  <span className="series-event-select-title">{event.title}</span>
                  <span className="series-event-select-time">
                    {new Date(event.start_time).toLocaleString()}
                  </span>
                </div>
                <span className="series-event-select-check">
                  {selectedIds.has(event.id) ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        {selectedEvents.length >= 2 && (
          <div className="series-preview-section">
            <h3>{t('eventSeries.previewSeries')}</h3>
            <ol className="series-preview-list">
              {selectedEvents.map((event, idx) => (
                <li key={event.id}>
                  <strong>{t('eventSeries.sessionNumber', { number: idx + 1 })}</strong>: {event.title}
                  <br />
                  <time>{new Date(event.start_time).toLocaleString()}</time>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="secondary-action" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="primary-cta"
            disabled={!title.trim() || selectedEvents.length < 2 || submitting}
            onClick={() => void handleCreate()}
          >
            {submitting ? t('common.processing') : t('eventSeries.createSeries')}
          </button>
        </div>
      </div>
    </Layout>
  )
}
