import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { useT } from '../hooks/useT'
import { useEventSeries, useSeriesMembersEvents } from '../hooks/useEventSeries'
import type { EventItem } from '../types'

interface SeriesCardProps {
  seriesId: string
  memberEvents: EventItem[]
}

export function SeriesCard({ seriesId, memberEvents }: SeriesCardProps) {
  const { t } = useT()
  const series = useEventSeries(seriesId)
  const members = useSeriesMembersEvents(seriesId)

  const sortedMemberEvents = useMemo(() => {
    return [...memberEvents].sort((a, b) => {
      const aPos = members.find((m) => m.event_id === a.id)?.position ?? 0
      const bPos = members.find((m) => m.event_id === b.id)?.position ?? 0
      return aPos - bPos
    })
  }, [memberEvents, members])

  if (!series) return null

  const previewEvents = sortedMemberEvents.slice(0, 3)
  const remainingCount = sortedMemberEvents.length - 3

  return (
    <article className="series-card card">
      <header className="series-card-header">
        <h3 className="series-card-title">{series.title}</h3>
        {series.is_whole_series_required && (
          <span className="chip chip-warning" title={t('eventSeries.requiredBadge')}>
            <Icon href="/action-icons.svg" name="action-shield" size={12} />
            {t('eventSeries.requiredBadge')}
          </span>
        )}
      </header>

      {series.description && (
        <p className="series-card-description">{series.description}</p>
      )}

      <div className="series-events-preview">
        {previewEvents.map((event, idx) => {
          const position = members.find((m) => m.event_id === event.id)?.position ?? idx + 1
          return (
            <div key={event.id} className="series-event-chip">
              <span className="chip">{t('eventSeries.sessionNumber', { number: position })}</span>
              <span className="event-name">{event.title}</span>
              <time className="event-time" dateTime={event.start_time}>
                {new Date(event.start_time).toLocaleString()}
              </time>
            </div>
          )
        })}
        {remainingCount > 0 && (
          <span className="more-events-count">
            +{remainingCount} {t('common.more')}
          </span>
        )}
      </div>

      <div className="series-card-actions">
        <Link to={`/events/${sortedMemberEvents[0]?.id}`} className="link-button">
          {t('eventSeries.viewDetails')}
          <Icon href="/action-icons.svg" name="action-chevron-right" size={12} />
        </Link>
        <Link
          to={`/events/${sortedMemberEvents[0]?.id}`}
          className="primary-cta primary-cta--small"
        >
          {t('eventSeries.registerWholeSeries', { count: sortedMemberEvents.length })}
        </Link>
      </div>
    </article>
  )
}