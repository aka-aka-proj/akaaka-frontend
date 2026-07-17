import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

export function CreateEventPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
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
      setMessage('Please sign in first.')
      return
    }

    if (!title.trim() || !startTime) {
      setMessage('Title and start time are required.')
      return
    }

    if (isVenueHosted && profile?.role_status !== 'venue_approved') {
      setMessage('Only venue_approved users can create venue-hosted events.')
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
    <Layout title="Create Event">
      <form className="card" onSubmit={submit}>
        <label>
          Title
          <input
            aria-label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          Event type
          <input
            aria-label="Event type"
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          />
        </label>
        <label>
          Start time
          <input
            aria-label="Start time"
            type="datetime-local"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            aria-label="Venue hosted"
            type="checkbox"
            checked={isVenueHosted}
            onChange={(event) => setIsVenueHosted(event.target.checked)}
          />
          Venue hosted
        </label>
        <label>
          Visibility
          <select
            aria-label="Visibility"
            value={visibilityType}
            onChange={(event) => setVisibilityType(event.target.value)}
          >
            <option value="public">public</option>
            <option value="connections_only">connections_only</option>
            <option value="private">private</option>
          </select>
        </label>
        <button type="submit" disabled={submitting}>
          Save event
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
