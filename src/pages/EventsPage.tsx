import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { EventBookmarkButton } from '../components/EventBookmarkButton'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { canSeeEvent } from '../lib/event-visibility'
import { getAttendanceFeeLabel, parseEventTypes } from '../lib/event-utils'
import { hasPracticeTag, getEffectiveCategory, getEventTypeI18nKey } from '../lib/event-types'
import type { EventItem, EventCategory, TaiwanRegion } from '../types'
import { TAIWAN_REGIONS } from '../types'

type TimeFilter = 'all' | 'upcoming' | 'past'
type CategoryFilter = 'all' | EventCategory
const DEFAULT_TIME_FILTER: TimeFilter = 'upcoming'
const EVENT_PAGE_SIZE = 50

export function EventsPage() {
  const { t, locale } = useT()
  const { user } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [message, setMessage] = useState('')
  const [eventsLoading, setEventsLoading] = useState(false)
  const [hasMoreEvents, setHasMoreEvents] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<TaiwanRegion | null>(null)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(DEFAULT_TIME_FILTER)
  const [myEventsOnly, setMyEventsOnly] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [bookmarkedEventIds, setBookmarkedEventIds] = useState<string[]>([])
  const userId = user?.id

  const activeFilterCount = [selectedType !== null, selectedRegion !== null, timeFilter !== 'all', myEventsOnly].filter(Boolean).length

  const clearFilters = () => {
    setSelectedType(null)
    setSelectedRegion(null)
    setTimeFilter(DEFAULT_TIME_FILTER)
    setMyEventsOnly(false)
  }

  useEffect(() => {
    const loadEvents = async () => {
      setEventsLoading(true)
      setMessage('')
      const { data, error } = await supabase
        .rpc('search_events', {
          p_search: search || null,
          p_event_type: selectedType,
          p_location_region: selectedRegion,
          p_time_filter: timeFilter,
          p_creator_id: myEventsOnly ? userId : null,
          p_limit: EVENT_PAGE_SIZE,
          p_offset: 0,
        })

      if (error) {
        setMessage(error.message)
        setEvents([])
        setHasMoreEvents(false)
        setEventsLoading(false)
        return
      }

      const nextEvents = (data as EventItem[]) ?? []
      setEvents(nextEvents)
      setHasMoreEvents(nextEvents.length === EVENT_PAGE_SIZE)
      setEventsLoading(false)
    }

    void loadEvents()
  }, [search, selectedType, selectedRegion, timeFilter, myEventsOnly, userId])

  const loadMoreEvents = async () => {
    if (eventsLoading || !hasMoreEvents) return
    setEventsLoading(true)
    const { data, error } = await supabase.rpc('search_events', {
      p_search: search || null,
      p_event_type: selectedType,
      p_location_region: selectedRegion,
      p_time_filter: timeFilter,
      p_creator_id: myEventsOnly ? userId : null,
      p_limit: EVENT_PAGE_SIZE,
      p_offset: events.length,
    })
    if (error) {
      setMessage(error.message)
    } else {
      const nextEvents = (data as EventItem[]) ?? []
      setEvents((current) => [...current, ...nextEvents])
      setHasMoreEvents(nextEvents.length === EVENT_PAGE_SIZE)
    }
    setEventsLoading(false)
  }

  useEffect(() => {
    if (!userId) {
      setBookmarkedEventIds([])
      return
    }
    const loadBookmarks = async () => {
      const { data } = await supabase.from('event_bookmarks').select('event_id').eq('profile_id', userId)
      setBookmarkedEventIds(((data as { event_id: string }[] | null) ?? []).map((item) => item.event_id))
    }
    void loadBookmarks()
  }, [userId])

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

    return events.filter((event) => {
      if (!canSeeEvent(event, user?.id)) return false

      if (selectedType !== null) {
        const eventTypes = parseEventTypes(event.event_type)
        if (!eventTypes.includes(selectedType)) return false
      }

      if (categoryFilter !== 'all') {
        const eventTypes = parseEventTypes(event.event_type)
        if (getEffectiveCategory(event.category, eventTypes) !== categoryFilter) return false
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
  }, [events, selectedType, selectedRegion, timeFilter, myEventsOnly, user, categoryFilter])

  return (
    <Layout>
      {user ? (
        <Link to="/events/new" className="fab" aria-label={t('events.createEvent')}>
          <Icon href="/nav-icons.svg" name="nav-create" size={24} />
        </Link>
      ) : null}

      <section className="card">
        <div className="events-toolbar">
          <div>
            <p className="eyebrow">{t('events.title')}</p>
            <h1>{t('events.exploreTitle')}</h1>
          </div>
          <Link to="/events/new" className="create-event-link desktop-only"><Icon href="/nav-icons.svg" name="nav-create" size={16} /> {t('events.createEvent')}</Link>
        </div>

        <div className="category-tabs">
          <button
            type="button"
            className={`category-tab${categoryFilter === 'all' ? ' category-tab-active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            {t('events.categoryAll')}
          </button>
          <button
            type="button"
            className={`category-tab category-tab-social${categoryFilter === 'Social' ? ' category-tab-active' : ''}`}
            onClick={() => setCategoryFilter('Social')}
          >
            {t('events.categorySocial')}
          </button>
          <button
            type="button"
            className={`category-tab category-tab-practice${categoryFilter === 'Practice' ? ' category-tab-active' : ''}`}
            onClick={() => setCategoryFilter('Practice')}
          >
            {t('events.categoryPractice')}
          </button>
        </div>

        <label className="search-field" htmlFor="search-activities">
          <span className="search-icon" aria-hidden="true">⌕</span>
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
        </label>

        <details className="filter-details" open={moreFiltersOpen} onToggle={(e) => setMoreFiltersOpen(e.currentTarget.open)}>
          <summary>
            <span>{t('events.moreFilters')}</span>
            {activeFilterCount > 0 ? <span className="filter-count">{activeFilterCount}</span> : null}
          </summary>
          <div className="filter-panel">
            {eventTypes.length > 0 && (
              <div className="filter-section">
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
                  {t(getEventTypeI18nKey(type))}
                </button>
              ))}
            </div>
              </div>
            )}

            <div className="filter-section">
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
              {t(`events.region${region}`)}
            </button>
          ))}
              </div>
            </div>

            <div className="filter-section">
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
            </div>

            {user && (
              <div className="filter-section">
            <button
              type="button"
              className={`chip${myEventsOnly ? ' chip-active' : ''}`}
              onClick={() => setMyEventsOnly((v) => !v)}
            >
              {t('events.myEvents')}
            </button>
              </div>
            )}
            {activeFilterCount > 0 ? <button type="button" className="clear-filters" onClick={clearFilters}>{t('events.clearFilters')}</button> : null}
          </div>
        </details>

        {message ? <p className="message">{message}</p> : null}

        {eventsLoading && events.length === 0 ? (
          <p className="empty-state" role="status">{t('common.loading')}</p>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <img src="/illustration-empty-events.svg" alt="" width={480} height={320} className="illustration" />
            <p>{t('events.noDescription')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="empty-state">{t('events.noResults')}</p>
        ) : (
          <ul className="event-grid">
            {filtered.map((event) => {
              const eventTypes = parseEventTypes(event.event_type)
              const effectiveCat = getEffectiveCategory(event.category, eventTypes)
              return (
              <li key={event.id} className="event-list-item">
                <article className="event-card">
                <div className="event-card-heading">
                  <Link to={`/events/${event.id}`} className="event-card-title">{event.title}</Link>
                  <EventBookmarkButton
                    eventId={event.id}
                    isBookmarked={bookmarkedEventIds.includes(event.id)}
                    onChange={(bookmarked) => setBookmarkedEventIds((current) => bookmarked ? [...new Set([...current, event.id])] : current.filter((id) => id !== event.id))}
                  />
                </div>
                {eventTypes.length > 0 && (
                  <div className="chip-group" style={{ marginTop: '0.25rem' }}>
                    {eventTypes.map((type) => {
                      const isPractice = hasPracticeTag([type]) || effectiveCat === 'Practice'
                      return (
                        <span key={type} className={`chip${isPractice ? ' chip-practice' : ' chip-social'}`}>
                          {isPractice && <Icon href="/action-icons.svg" name="action-shield" size={12} />}
                          {t(getEventTypeI18nKey(type))}
                        </span>
                      )
                    })}
                  </div>
                )}
                <p className="event-card-description">{event.description ?? t('events.noDescription')}</p>
                <p className="event-card-meta"><Icon href="/form-icons.svg" name="form-edit" size={16} /> <span>{t('events.attendanceFeeLabel')}: {getAttendanceFeeLabel(event.attendance_fee_type ?? 'free', event.attendance_fee_amount, locale)}</span></p>
                <p className="event-card-meta"><Icon href="/form-icons.svg" name="form-calendar" size={16} /> <span>{new Date(event.start_time).toLocaleString()}</span></p>
                {event.location_region ? (
                  <p className="event-card-meta"><Icon href="/form-icons.svg" name="form-location" size={16} /> <span>{t(`events.region${event.location_region}`)}{event.location_detail ? <> — <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location_detail)}`} target="_blank" rel="noopener noreferrer">{event.location_detail}</a></> : ''}</span></p>
                ) : null}
                </article>
              </li>
              )
            })}
          </ul>
        )}
        {hasMoreEvents ? (
          <button type="button" onClick={() => void loadMoreEvents()} disabled={eventsLoading}>
            {eventsLoading ? t('common.loading') : t('events.loadMore')}
          </button>
        ) : null}
      </section>
    </Layout>
  )
}
