import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { EventItem } from '../types'
import { EVENT_TYPES } from '../lib/event-types'

export function EditEventPage() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState<string[]>([])
  const [currentType, setCurrentType] = useState('')
  const [startTime, setStartTime] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [isVenueHosted, setIsVenueHosted] = useState(false)
  const [visibilityType, setVisibilityType] = useState('public')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null)
  const [approvedCount, setApprovedCount] = useState(0)

  const addType = (type: string) => {
    if (type && !eventType.includes(type) && EVENT_TYPES.includes(type as any)) {
      setEventType([...eventType, type])
    }
  }

  useEffect(() => {
    if (!id) {
      return
    }

    const loadEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        setMessage(t('editEvent.notFound'))
        setLoading(false)
        return
      }

      const event = data as EventItem

      if (user && event.creator_id !== user.id) {
        navigate(`/events/${id}`, { replace: true })
        return
      }

      setTitle(event.title)
      setDescription(event.description ?? '')
      
      let initialEventType: string[] = []
      if (Array.isArray(event.event_type)) {
        initialEventType = event.event_type
      } else if (typeof event.event_type === 'string' && event.event_type) {
        initialEventType = [event.event_type]
      }
      setEventType(initialEventType)

      setStartTime(event.start_time ? toLocalDatetime(event.start_time) : '')
      setMaxCapacity(event.max_capacity?.toString() ?? '')
      setRegistrationDeadline(event.registration_deadline ? toLocalDatetime(event.registration_deadline) : '')
      setIsVenueHosted(event.is_venue_hosted)
      setVisibilityType(event.visibility_settings?.type ?? 'public')

      const { data: regs } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', id)
        .eq('status', 'approved')

      setApprovedCount(((regs as unknown[]) ?? []).length)
      setLoading(false)
    }

    void loadEvent()
  }, [id, user?.id])

  useEffect(() => {
    if (!submitting) {
      return
    }
    const cap = maxCapacity ? parseInt(maxCapacity, 10) : null
    if (cap !== null && cap < approvedCount) {
      setCapacityWarning(
        t('editEvent.capacityWarning', { max: cap, approved: approvedCount }),
      )
    } else {
      setCapacityWarning(null)
    }
  }, [maxCapacity, approvedCount, submitting, t])

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso)
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60_000)
    return local.toISOString().slice(0, 16)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !id) {
      setMessage(t('editEvent.signInFirst'))
      return
    }

    if (!title.trim() || !startTime) {
      setMessage(t('editEvent.titleRequired'))
      return
    }

    if (isVenueHosted && profile?.role_status !== 'venue_approved') {
      setMessage(t('editEvent.venueApprovalRequired'))
      return
    }

    setSubmitting(true)
    setMessage('')

    const { error } = await supabase
      .from('events')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType.length > 0 ? eventType : [],
        start_time: new Date(startTime).toISOString(),
        is_venue_hosted: isVenueHosted,
        visibility_settings: { type: visibilityType },
        max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
        registration_deadline: registrationDeadline
          ? new Date(registrationDeadline).toISOString()
          : null,
      })
      .eq('id', id)

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(t('editEvent.eventUpdated'))
    navigate(`/events/${id}`, { replace: true })
  }

  if (loading) {
    return (
      <Layout title={t('editEvent.title')}>
        <section className="card">
          <p>{t('editEvent.loading')}</p>
        </section>
      </Layout>
    )
  }

  return (
    <Layout title={t('editEvent.title')}>
      <form className="card" onSubmit={submit}>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.titleLabel')}
          </span>
          <input
            aria-label={t('editEvent.titleLabel')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.descriptionLabel')}
          </span>
          <textarea
            aria-label={t('editEvent.descriptionLabel')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.eventTypeLabel')}
          </span>
          <select 
            onChange={(e) => addType(e.target.value)}
            defaultValue=""
            style={{ marginBottom: '8px', width: '100%' }}
          >
            <option value="" disabled>{t('editEvent.selectEventType')}</option>
            {EVENT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="tags-input-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid var(--border-color, #ccc)', borderRadius: '4px', background: 'var(--bg-primary, #fff)' }}>
            {eventType.map(type => (
              <span key={type} className="tag" style={{ background: 'var(--bg-secondary, #eee)', padding: '4px 8px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                {type}
                <button 
                  type="button" 
                  onClick={() => setEventType(eventType.filter(t => t !== type))} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px', lineHeight: '1', color: 'var(--text-secondary, #666)' }}
                  aria-label={t('editEvent.removeType')}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.startTimeLabel')}
          </span>
          <input
            aria-label={t('editEvent.startTimeLabel')}
            type="datetime-local"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.maxCapacityLabel')}
          </span>
          <input
            aria-label={t('editEvent.maxCapacityLabel')}
            type="number"
            min="1"
            placeholder={t('editEvent.maxCapacityPlaceholder')}
            value={maxCapacity}
            onChange={(event) => setMaxCapacity(event.target.value)}
          />
        </label>
        {capacityWarning ? (
          <p className="message warning">{capacityWarning}</p>
        ) : null}
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.registrationDeadlineLabel')}
          </span>
          <input
            aria-label={t('editEvent.registrationDeadlineLabel')}
            type="datetime-local"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            aria-label={t('editEvent.venueHostedLabel')}
            type="checkbox"
            checked={isVenueHosted}
            onChange={(event) => setIsVenueHosted(event.target.checked)}
          />
          <Icon href="/form-icons.svg" name="form-location" size={16} />
          {t('editEvent.venueHostedLabel')}
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-eye" size={16} /> {t('editEvent.visibilityLabel')}
          </span>
          <select
            aria-label={t('editEvent.visibilityLabel')}
            value={visibilityType}
            onChange={(event) => setVisibilityType(event.target.value)}
          >
            <option value="public">{t('editEvent.public')}</option>
            <option value="connections_only">{t('editEvent.connectionsOnly')}</option>
            <option value="private">{t('editEvent.private')}</option>
          </select>
        </label>
        <button type="submit" disabled={submitting}>
          <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('editEvent.saveEvent')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
