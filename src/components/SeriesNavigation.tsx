import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useT } from '../hooks/useT'
import { useSeriesMembersEvents, useCurrentSeriesEventPosition } from '../hooks/useEventSeries'
import type { EventItem } from '../types'

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
  const { t } = useT()
  const navigate = useNavigate()
  const members = useSeriesMembersEvents(seriesId)
  const currentIndex = useCurrentSeriesEventPosition(seriesId, currentEventId)

  const sortedMemberEvents = useMemo(() => {
    return [...memberEvents].sort((a, b) => {
      const aPos = members.find((m) => m.event_id === a.id)?.position ?? 0
      const bPos = members.find((m) => m.event_id === b.id)?.position ?? 0
      return aPos - bPos
    })
  }, [memberEvents, members])

  if (loading) return null
  if (!seriesId || members.length === 0) return null
  if (currentIndex === -1) return null

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < members.length - 1

  return (
    <section className="card event-detail-series-nav" aria-label={t('eventSeries.navigationLabel')}>
      <div className="series-nav-header">
        <Icon href="/nav-icons.svg" name="nav-schedule" size={18} />
        <span className="eyebrow">{t('eventSeries.navigationLabel')}</span>
      </div>

      <div className="series-event-list">
        {sortedMemberEvents.map((event, index) => {
          const isActive = index === currentIndex
          return (
            <button
              key={event.id}
              type="button"
              className={`series-event-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(`/events/${event.id}`)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="series-event-index">{index + 1}</span>
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

      {members.length > 1 && (
        <div className="series-nav-arrows">
          {hasPrev && (
            <button
              type="button"
              className="nav-arrow-btn nav-arrow-prev"
              onClick={() => navigate(`/events/${sortedMemberEvents[currentIndex - 1].id}`)}
            >
              <Icon href="/action-icons.svg" name="action-chevron-left" size={14} />
              {t('eventSeries.prevEvent')}
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              className="nav-arrow-btn nav-arrow-next"
              onClick={() => navigate(`/events/${sortedMemberEvents[currentIndex + 1].id}`)}
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