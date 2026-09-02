import { Link } from 'react-router-dom'
import { useT } from '../hooks/useT'
import type { RegistrationStatus } from '../types'
import styles from './SeriesRegistrationProgress.module.css'

export interface SeriesProgressMember {
  event_id: string
  position: number
  title: string | null
  start_time: string | null
  status: RegistrationStatus | null
}

export interface SeriesProgressItem {
  id: string
  title: string
  registrationStatus: RegistrationStatus
  members: SeriesProgressMember[]
}

interface SeriesRegistrationProgressProps {
  series: SeriesProgressItem[]
}

function registrationStatus(status: RegistrationStatus, t: (key: string, variables?: Record<string, string | number>) => string) {
  switch (status) {
    case 'pending': return t('eventDetail.regPending')
    case 'approved': return t('eventDetail.regApproved')
    case 'rejected': return t('eventDetail.regRejected')
    case 'waitlisted': return t('eventDetail.regWaitlisted')
    case 'cancellation_pending': return t('eventDetail.regCancellationPending')
    case 'cancellation_rejected': return t('eventDetail.regCancellationRejected')
    default: return status
  }
}

export function SeriesRegistrationProgress({ series }: SeriesRegistrationProgressProps) {
  const { t } = useT()

  if (series.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="my-series-progress-title">
      <h2 id="my-series-progress-title">{t('myRegistrations.seriesProgressTitle')}</h2>
      {series.map((item) => {
        const registeredCount = item.members.filter((member) => member.status !== null && member.status !== 'cancelled').length
        return (
          <article key={item.id} className={`card ${styles.seriesCard}`}>
            <div className={styles.seriesHeader}>
              <h3 className={styles.seriesTitle}>{item.title}</h3>
              <span className="chip">{registrationStatus(item.registrationStatus, t)}</span>
            </div>
            <p className={styles.summary}>
              {t('myRegistrations.seriesProgressSummary', { registered: registeredCount, total: item.members.length })}
            </p>
            <ol className={styles.memberList}>
              {item.members.map((member) => (
                <li key={member.event_id} className={styles.member}>
                  <div className={styles.memberInfo}>
                    <Link to={`/events/${member.event_id}`}>
                      {t('eventSeries.sessionNumber', { number: member.position })}：{member.title ?? member.event_id}
                    </Link>
                    {member.start_time ? (
                      <time className={styles.memberMeta} dateTime={member.start_time}>
                        {new Date(member.start_time).toLocaleString()}
                      </time>
                    ) : null}
                  </div>
                  <span className={`chip ${styles.memberStatus}`}>
                    {member.status ? registrationStatus(member.status, t) : t('myRegistrations.notRegistered')}
                  </span>
                </li>
              ))}
            </ol>
          </article>
        )
      })}
    </section>
  )
}
