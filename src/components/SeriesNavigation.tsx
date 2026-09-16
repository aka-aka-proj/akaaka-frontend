import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { useEventSeries, type EventSeriesMember } from '../hooks/useEventSeries'
import type { EventItem } from '../types'
import styles from './SeriesNavigation.module.css'

const EMPTY_MEMBERS: EventSeriesMember[] = []

interface SeriesNavigationProps {
  seriesId: string | null
  currentEventId: string | undefined
  memberEvents: EventItem[]
  loading?: boolean
}

export function SeriesNavigation({
  seriesId,
  currentEventId,
  memberEvents,
  loading,
}: SeriesNavigationProps) {
  const { user } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const series = useEventSeries(seriesId)
  const members = series?.members ?? EMPTY_MEMBERS

  const sortedMemberEvents = useMemo(() => {
    return [...memberEvents].sort((a, b) => {
      const aPos = members.find((m) => m.event_id === a.id)?.position ?? 0
      const bPos = members.find((m) => m.event_id === b.id)?.position ?? 0
      return aPos - bPos
    })
  }, [memberEvents, members])

  const visibleEventIds = useMemo(() => new Set(sortedMemberEvents.map((event) => event.id)), [sortedMemberEvents])
  const visibleMembers = useMemo(
    () => members.filter((member) => visibleEventIds.has(member.event_id)),
    [members, visibleEventIds],
  )
  const currentIndex = visibleMembers.findIndex((member) => member.event_id === currentEventId)

  if (loading || !series) return null

  const isHost = Boolean(user && user.id === series.creator_id)
  const hasCurrentEvent = currentIndex >= 0
  const hasPrev = hasCurrentEvent && currentIndex > 0
  const hasNext = hasCurrentEvent && currentIndex < visibleMembers.length - 1

  return (
    <section className="card event-detail-series-nav" aria-label={t('eventSeries.navigationLabel')}>
      <div className="series-nav-header">
        <div className="series-nav-heading">
          <Icon href="/nav-icons.svg" name="nav-schedule" size={18} />
          <span className="eyebrow">{t('eventSeries.navigationLabel')}</span>
        </div>
        {isHost && seriesId ? (
          <button
            type="button"
            className={`secondary-action ${styles.manageButton}`}
            onClick={() => navigate(`/events/series/${seriesId}/manage`)}
          >
            {t('eventSeries.manageSeriesTitle')}
          </button>
        ) : null}
      </div>

      {sortedMemberEvents.length > 0 ? (
        <div className="series-event-list">
          {sortedMemberEvents.map((event, index) => {
            const isActive = event.id === currentEventId
            return (
              <button
                key={event.id}
                type="button"
                className={`series-event-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(`/events/${event.id}`)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="series-event-index">
                  {members.find((member) => member.event_id === event.id)?.position ?? index + 1}
                </span>
                <div className="series-event-info">
                  <span className="series-event-title">{event.title}</span>
                  <span className="series-event-time">
                    {new Date(event.start_time).toLocaleString()}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}

      {hasCurrentEvent && visibleMembers.length > 1 && (
        <div className="series-nav-arrows">
          {hasPrev && (
            <button
              type="button"
              className="nav-arrow-btn nav-arrow-prev"
              onClick={() => navigate(`/events/${visibleMembers[currentIndex - 1].event_id}`)}
            >
              <Icon href="/action-icons.svg" name="action-chevron-left" size={14} />
              {t('eventSeries.prevEvent')}
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              className="nav-arrow-btn nav-arrow-next"
              onClick={() => navigate(`/events/${visibleMembers[currentIndex + 1].event_id}`)}
            >
              {t('eventSeries.nextEvent')}
              <Icon href="/action-icons.svg" name="action-chevron-right" size={14} />
            </button>
          )}
        </div>
      )}
    </section>
  )
}
