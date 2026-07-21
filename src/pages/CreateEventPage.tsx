import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { EVENT_TYPES } from '../lib/event-types'

export function CreateEventPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [visibilityType, setVisibilityType] = useState('public')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const addType = (type: string) => {
    if (type && !eventType.includes(type) && EVENT_TYPES.includes(type as any)) {
      setEventType([...eventType, type])
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setMessage(t('createEvent.signInFirst'))
      return
    }

    if (!title.trim() || !startTime) {
      setMessage(t('createEvent.titleRequired'))
      return
    }

    setSubmitting(true)
    const isVenueHosted = profile?.role_status === 'venue_approved'
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          event_type: eventType.length > 0 ? eventType : [],
          start_time: new Date(startTime).toISOString(),
          is_venue_hosted: isVenueHosted,
          visibility_settings: { type: visibilityType },
          max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
          registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
        },
      ])
      .select('id')
      .single()
    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    navigate(`/events/${data.id}`, { replace: true })
  }

  return (
    <Layout title={t('createEvent.title')}>
      <form className="card" onSubmit={submit}>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.titleLabel')}
          </span>
          <input
            aria-label={t('createEvent.titleLabel')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.descriptionLabel')}
          </span>
          <textarea
            aria-label={t('createEvent.descriptionLabel')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('createEvent.eventTypeLabel')}
          </span>
          <select 
            onChange={(e) => addType(e.target.value)}
            defaultValue=""
            style={{ marginBottom: '8px', width: '100%' }}
          >
            <option value="" disabled>{t('createEvent.selectEventType') || 'Select event type'}</option>
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
                  aria-label={t('createEvent.removeType') || 'Remove type'}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('createEvent.startTimeLabel')}
          </span>
          <input
            aria-label={t('createEvent.startTimeLabel')}
            type="datetime-local"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.maxCapacityLabel')}
          </span>
          <input
            aria-label={t('createEvent.maxCapacityLabel')}
            type="number"
            min="1"
            placeholder={t('createEvent.maxCapacityPlaceholder')}
            value={maxCapacity}
            onChange={(event) => setMaxCapacity(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('createEvent.registrationDeadlineLabel')}
          </span>
          <input
            aria-label={t('createEvent.registrationDeadlineLabel')}
            type="datetime-local"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-eye" size={16} /> {t('createEvent.visibilityLabel')}
          </span>
          <select
            aria-label={t('createEvent.visibilityLabel')}
            value={visibilityType}
            onChange={(event) => setVisibilityType(event.target.value)}
          >
            <option value="public">{t('createEvent.public')}</option>
            <option value="connections_only">{t('createEvent.connectionsOnly')}</option>
            <option value="private">{t('createEvent.private')}</option>
          </select>
        </label>
        <button type="submit" disabled={submitting}>
          <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('createEvent.saveEvent')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
