import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { canSeeEvent } from '../lib/event-visibility'
import { parseEventTypes } from '../lib/event-utils'
import type { EventItem, TaiwanRegion } from '../types'
import { TAIWAN_REGIONS } from '../types'

type TimeFilter = 'all' | 'upcoming' | 'past'

export function EventsPage() {
  const { t } = useT()
  const { user } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<TaiwanRegion | null>(null)
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
      const parsedTypes = parseEventTypes(event.event_type)
      for (const t of parsedTypes) {
        types.add(t)
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
        const locDetailMatch = (event.location_detail ?? '').toLowerCase().includes(q)
        if (!titleMatch && !descMatch && !locDetailMatch) return false
      }

      if (selectedType !== null) {
        const eventTypes = parseEventTypes(event.event_type)
        if (!eventTypes.includes(selectedType)) return false
      }

      if (selectedRegion !== null) {
        if (event.location_region !== selectedRegion) return false
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
  }, [events, search, selectedType, selectedRegion, timeFilter, myEventsOnly, user])

  return (
    <Layout>
      {user ? (
        <Link to="/events/new" className="fab" aria-label={t('events.createEvent')}>
          <Icon href="/nav-icons.svg" name="nav-create" size={24} />
        </Link>
      ) : null}

      <section className="card">
        <Link to="/events/new" className="create-event-link desktop-only"><Icon href="/nav-icons.svg" name="nav-create" size={16} /> {t('events.createEvent')}</Link>

        <input
          id="search-activities"
          name="search"
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

        <h3>{t('events.regionLabel')}</h3>
        <div className="chip-group">
          <button
            type="button"
            className={`chip${selectedRegion === null ? ' chip-active' : ''}`}
            onClick={() => setSelectedRegion(null)}
          >
            {t('events.allRegions')}
          </button>
          {TAIWAN_REGIONS.map((region) => (
            <button
              key={region}
              type="button"
              className={`chip${selectedRegion === region ? ' chip-active' : ''}`}
              onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
            >
              {t(`events.region${region}` as any)}
            </button>
          ))}
        </div>

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
                <p>{event.description ?? t('events.noDescription')}</p>
                <p><Icon href="/form-icons.svg" name="form-calendar" size={14} /> {t('events.startTimeLabel')} {new Date(event.start_time).toLocaleString()}</p>
                {event.location_region ? (
                  <p><Icon href="/form-icons.svg" name="form-location" size={14} /> {t(`events.region${event.location_region}` as any)}{event.location_detail ? ` — ${event.location_detail}` : ''}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  )
}
