import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

export function CreateEventPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState('')
  const [startTime, setStartTime] = useState('')
  const [isVenueHosted, setIsVenueHosted] = useState(false)
  const [visibilityType, setVisibilityType] = useState('public')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

    if (isVenueHosted && profile?.role_status !== 'venue_approved') {
      setMessage(t('createEvent.venueApprovalRequired'))
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          event_type: eventType.trim() || null,
          start_time: new Date(startTime).toISOString(),
          is_venue_hosted: isVenueHosted,
          visibility_settings: { type: visibilityType },
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
          <input
            aria-label={t('createEvent.eventTypeLabel')}
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          />
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
        <label className="checkbox">
          <input
            aria-label={t('createEvent.venueHostedLabel')}
            type="checkbox"
            checked={isVenueHosted}
            onChange={(event) => setIsVenueHosted(event.target.checked)}
          />
          <Icon href="/form-icons.svg" name="form-location" size={16} />
          {t('createEvent.venueHostedLabel')}
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
