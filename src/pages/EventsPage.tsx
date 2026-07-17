import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../supabaseClient'
import type { EventItem } from '../types'

export function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true })

      if (error) {
        setMessage(error.message)
        return
      }

      setEvents((data as EventItem[]) ?? [])
    }

    void loadEvents()
  }, [])

  return (
    <Layout title="Events">
      <section className="card">
        <Link to="/events/new">Create event</Link>
        {message ? <p className="message">{message}</p> : null}
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <Link to={`/events/${event.id}`}>{event.title}</Link>
              <p>{event.description ?? 'No description'}</p>
              <p>{new Date(event.start_time).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  )
}
