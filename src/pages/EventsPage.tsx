import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { ShareButton } from '../components/ShareButton'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { canSeeEvent } from '../lib/event-visibility'
import type { EventItem } from '../types'

type TimeFilter = 'all' | 'upcoming' | 'past'

export function EventsPage() {
  const { t } = useT()
  const { user } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [myEventsOnly, setMyEventsOnly] = useState(false)

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

  const eventTypes = useMemo(() => {
    const types = new Set<string>()
    for (const event of events) {
      if (event.event_type) {
        types.add(event.event_type)
      }
    }
    return Array.from(types).sort()
  }, [events])

  const filtered = useMemo(() => {
    const now = Date.now()
    const q = search.toLowerCase()

    return events.filter((event) => {
      if (!canSeeEvent(event, user?.id)) return false

      if (q) {
        const titleMatch = event.title.toLowerCase().includes(q)
        const descMatch = (event.description ?? '').toLowerCase().includes(q)
        if (!titleMatch && !descMatch) return false
      }

      if (selectedType !== null) {
        const eventType = event.event_type ?? ''
        if (eventType !== selectedType) return false
      }

      if (timeFilter === 'upcoming') {
        if (new Date(event.start_time).getTime() < now) return false
      } else if (timeFilter === 'past') {
        if (new Date(event.start_time).getTime() >= now) return false
      }

      if (myEventsOnly && user) {
        if (event.creator_id !== user.id) return false
      }

      return true
    })
  }, [events, search, selectedType, timeFilter, myEventsOnly, user])

  return (
    <Layout title={t('events.title')}>
      <section className="card">
        <Link to="/events/new" className="create-event-link"><Icon href="/nav-icons.svg" name="nav-create" size={16} /> {t('events.createEvent')}</Link>

        <input
          className="search-input"
          type="search"
          placeholder={t('events.searchPlaceholder')}
          aria-label={t('events.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {eventTypes.length > 0 && (
          <>
            <h3>{t('events.activityTypeLabel')}</h3>
            <div className="chip-group">
              <button
                type="button"
                className={`chip${selectedType === null ? ' chip-active' : ''}`}
                onClick={() => setSelectedType(null)}
              >
                {t('events.allTypes')}
              </button>
              {eventTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`chip${selectedType === type ? ' chip-active' : ''}`}
                  onClick={() => setSelectedType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </>
        )}

        <h3>{t('events.timeLabel')}</h3>
        <div className="chip-group">
          <button
            type="button"
            className={`chip${timeFilter === 'all' ? ' chip-active' : ''}`}
            onClick={() => setTimeFilter('all')}
          >
            {t('events.timeAll')}
          </button>
          <button
            type="button"
            className={`chip${timeFilter === 'upcoming' ? ' chip-active' : ''}`}
            onClick={() => setTimeFilter('upcoming')}
          >
            {t('events.upcoming')}
          </button>
          <button
            type="button"
            className={`chip${timeFilter === 'past' ? ' chip-active' : ''}`}
            onClick={() => setTimeFilter('past')}
          >
            {t('events.past')}
          </button>
        </div>

        {user && (
          <div className="chip-group">
            <button
              type="button"
              className={`chip${myEventsOnly ? ' chip-active' : ''}`}
              onClick={() => setMyEventsOnly((v) => !v)}
            >
              {t('events.myEvents')}
            </button>
          </div>
        )}

        {message ? <p className="message">{message}</p> : null}

        {events.length === 0 ? (
          <div className="empty-state">
            <img src="/illustration-empty-events.svg" alt="" width={480} height={320} className="illustration" />
            <p>{t('events.noDescription')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{t('events.noResults')}</p>
        ) : (
          <ul>
            {filtered.map((event) => (
              <li key={event.id} className="event-list-item">
                <Link to={`/events/${event.id}`}>{event.title}</Link>
                <ShareButton
                  title={event.title}
                  text={event.description ?? ''}
                  url={`${window.location.origin}/events/${event.id}`}
                />
                <p>{event.description ?? t('events.noDescription')}</p>
                <p><Icon href="/form-icons.svg" name="form-calendar" size={14} /> {new Date(event.start_time).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  )
}
