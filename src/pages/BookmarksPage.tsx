import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { EventBookmarkButton } from '../components/EventBookmarkButton'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { EventItem } from '../types'

interface BookmarkRow {
  event_id: string
  created_at: string
}

export function BookmarksPage() {
  const { t } = useT()
  const { user } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setMessage('')
      const { data: bookmarkData, error: bookmarkError } = await supabase
        .from('event_bookmarks')
        .select('event_id, created_at')
        .eq('profile_id', user?.id ?? '')
        .order('created_at', { ascending: false })

      if (bookmarkError) {
        if (!cancelled) setMessage(bookmarkError.message)
        setLoading(false)
        return
      }

      const rows = (bookmarkData as BookmarkRow[] | null) ?? []
      if (rows.length === 0) {
        if (!cancelled) setEvents([])
        setLoading(false)
        return
      }

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .in('id', rows.map((row) => row.event_id))

      if (!cancelled) {
        if (eventError) {
          setMessage(eventError.message)
        } else {
          const eventMap = new Map(((eventData as EventItem[] | null) ?? []).map((event) => [event.id, event]))
          setEvents(rows.flatMap((row) => {
            const event = eventMap.get(row.event_id)
            return event ? [event] : []
          }))
        }
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user?.id])

  const removeBookmark = (eventId: string) => {
    setEvents((current) => current.filter((event) => event.id !== eventId))
  }

  return (
    <Layout>
      <section className="card">
        <div className="events-toolbar">
          <div>
            <p className="eyebrow">{t('events.title')}</p>
            <h1>{t('events.bookmarksTitle')}</h1>
          </div>
          <Link to="/events" className="create-event-link">{t('events.exploreTitle')}</Link>
        </div>
        {message ? <p className="message" role="alert">{message}</p> : null}
        {loading ? <p>{t('common.loading')}</p> : events.length === 0 ? (
          <div className="empty-state">
            <p>{t('events.noBookmarks')}</p>
            <Link to="/events" className="calendar-btn">{t('events.exploreTitle')}</Link>
          </div>
        ) : (
          <ul className="event-grid">
            {events.map((event) => (
              <li key={event.id} className="event-list-item">
                <article className="event-card">
                  <div className="event-card-heading">
                    <Link to={`/events/${event.id}`} className="event-card-title">{event.title}</Link>
                    <EventBookmarkButton eventId={event.id} isBookmarked onChange={(bookmarked) => { if (!bookmarked) removeBookmark(event.id) }} />
                  </div>
                  <p className="event-card-description">{event.description ?? t('events.noDescription')}</p>
                  <p className="event-card-meta"><Icon href="/form-icons.svg" name="form-calendar" size={16} /> <span>{new Date(event.start_time).toLocaleString()}</span></p>
                  {event.location_region ? <p className="event-card-meta"><Icon href="/form-icons.svg" name="form-location" size={16} /> <span>{t(`events.region${event.location_region}`)}{event.location_detail ? ` — ${event.location_detail}` : ''}</span></p> : null}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  )
}
