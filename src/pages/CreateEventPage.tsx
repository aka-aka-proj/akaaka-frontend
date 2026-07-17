import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
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
        <label>
          {t('createEvent.titleLabel')}
          <input
            aria-label={t('createEvent.titleLabel')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {t('createEvent.descriptionLabel')}
          <textarea
            aria-label={t('createEvent.descriptionLabel')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          {t('createEvent.eventTypeLabel')}
          <input
            aria-label={t('createEvent.eventTypeLabel')}
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          />
        </label>
        <label>
          {t('createEvent.startTimeLabel')}
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
          {t('createEvent.venueHostedLabel')}
        </label>
        <label>
          {t('createEvent.visibilityLabel')}
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
          {t('createEvent.saveEvent')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
