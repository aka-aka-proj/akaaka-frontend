import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { ReportForm } from '../components/ReportForm'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { downloadIcs, getGoogleCalendarUrl } from '../lib/ics'
import type { EventItem, EventThread, Registration } from '../types'

interface Attendee {
  profile_id: string
  display_name: string | null
  joined_at: string
}

export function EventDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useT()
  const [eventItem, setEventItem] = useState<EventItem | null>(null)
  const [threads, setThreads] = useState<EventThread[]>([])
  const [content, setContent] = useState('')
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])
  const [creatorReportCount, setCreatorReportCount] = useState<number>(0)
  const [myRegistration, setMyRegistration] = useState<Registration | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [profileNameMap, setProfileNameMap] = useState<Map<string, string | null>>(new Map())
  const [submitting, setSubmitting] = useState(false)

  const isHost = user && eventItem && user.id === eventItem.creator_id

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !blockedUserIds.includes(thread.profile_id)),
    [threads, blockedUserIds],
  )

  const load = async () => {
    if (!id) {
      return
    }

    const [{ data: eventData, error: eventError }, { data: threadData, error: threadError }] =
      await Promise.all([
        supabase.from('events').select('*, creator:profiles(display_name, reputation_score)').eq('id', id).maybeSingle(),
        supabase
          .from('event_threads')
          .select('*, profile:profiles(display_name)')
          .eq('event_id', id)
          .order('created_at', { ascending: true }),
      ])

    if (eventError || threadError) {
      setMessage(eventError?.message ?? threadError?.message ?? t('eventDetail.unableToLoad'))
      return
    }

    setEventItem((eventData as EventItem | null) ?? null)
    setThreads((threadData as EventThread[]) ?? [])

    if (eventData) {
      const { data: reportStats } = await supabase
        .from('profile_report_stats')
        .select('report_count')
        .eq('profile_id', (eventData as EventItem).creator_id)
        .maybeSingle()
      setCreatorReportCount(Number(reportStats?.report_count ?? 0))
    }

    if (user) {
      const { data: blocksData, error: blocksError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)

      if (blocksError) {
        setMessage(blocksError.message)
      } else {
        setBlockedUserIds(((blocksData as { blocked_id: string }[] | null) ?? []).map((item) => item.blocked_id))
      }

      // Load my registration
      const { data: myReg } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', id)
        .eq('profile_id', user.id)
        .neq('status', 'cancelled')
        .maybeSingle()

      setMyRegistration((myReg as Registration | null) ?? null)
    }

    // Load registrations (host can see all, others see count)
    const { data: allRegs } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })

    setRegistrations((allRegs as Registration[]) ?? [])

    // Load profile names for all registrants
    if (allRegs && allRegs.length > 0) {
      const profileIds = [...new Set(((allRegs as Registration[]) ?? []).map((r) => r.profile_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', profileIds)

      setProfileNameMap(new Map(((profiles as { id: string; display_name: string | null }[]) ?? []).map((p) => [p.id, p.display_name])))
    } else {
      setProfileNameMap(new Map())
    }

    // Load attendees (approved only)
    const approvedRegs = ((allRegs as Registration[]) ?? []).filter((r) => r.status === 'approved')
    if (approvedRegs.length > 0) {
      setAttendees(
        approvedRegs.map((r) => ({
          profile_id: r.profile_id,
          display_name: profileNameMap.get(r.profile_id) ?? null,
          joined_at: r.created_at,
        })),
      )
    } else {
      setAttendees([])
    }
  }

  useEffect(() => {
    void load()
  }, [id, user?.id])

  const handleRegister = async () => {
    if (!id || !user) {
      return
    }
    setSubmitting(true)
    setMessage('')

    const { error } = await supabase.functions.invoke('create-registration', {
      body: { event_id: id },
    })

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    await load()
  }

  const handleCancelRegistration = async () => {
    if (!id || !user) {
      return
    }
    setSubmitting(true)
    setMessage('')

    const { error } = await supabase.functions.invoke('cancel-registration', {
      body: { event_id: id },
    })

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMyRegistration(null)
    await load()
  }

  const handleForceCancel = async (registrationId: string) => {
    if (!confirm(t('eventDetail.forceCancelConfirm'))) {
      return
    }
    setSubmitting(true)
    setMessage('')

    const { error } = await supabase
      .from('event_registrations')
      .update({ status: 'cancelled' })
      .eq('id', registrationId)

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    await load()
  }
    if (!id || !user) {
      return
    }
    setSubmitting(true)
    setMessage('')

    const { error } = await supabase.functions.invoke('review-registration', {
      body: { event_id: id, registration_id: registrationId, action },
    })

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    await load()
  }

  const postThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !user || !content.trim()) {
      return
    }

    const { error } = await supabase.from('event_threads').insert([
      {
        event_id: id,
        profile_id: user.id,
        content: content.trim(),
        parent_id: replyParentId,
      },
    ])

    if (error) {
      setMessage(error.message)
      return
    }

    setContent('')
    setReplyParentId(null)
    await load()
  }

  const registrationStatus = (status: string) => {
    switch (status) {
      case 'pending': return t('eventDetail.regPending')
      case 'approved': return t('eventDetail.regApproved')
      case 'rejected': return t('eventDetail.regRejected')
      case 'waitlisted': return t('eventDetail.regWaitlisted')
      default: return status
    }
  }

  const pendingRegistrations = registrations.filter((r) => r.status === 'pending')

  return (
    <Layout title={t('eventDetail.title')}>
      <section className="card">
        {eventItem ? (
          <>
            <h2>{eventItem.title}</h2>
            <p>{eventItem.description ?? t('eventDetail.noDescription')}</p>
            <p className="event-meta">
              <img src="/default-avatar.svg" alt="" width={24} height={24} className="avatar avatar-sm" />
              {t('eventDetail.createdBy')} <Link to={`/profile/${eventItem.creator_id}`}>{eventItem.creator?.display_name || eventItem.creator_id}</Link>
            </p>
            <p className="event-creator-stats">
              <span className="creator-stat">
                <Icon href="/badge-icons.svg" name="reputation-star" size={14} />
                {eventItem.creator?.reputation_score ?? 0}
              </span>
              <span className="creator-stat">
                <Icon href="/report-icons.svg" name="report-safety-risk" size={14} />
                {creatorReportCount} {t('eventDetail.reports')}
              </span>
            </p>
            <p><Icon href="/form-icons.svg" name="form-calendar" size={14} /> {new Date(eventItem.start_time).toLocaleString()}</p>
            {eventItem.max_capacity ? (
              <p>{t('eventDetail.capacity', { count: eventItem.max_capacity, current: attendees.length })}</p>
            ) : null}
            {eventItem.registration_deadline ? (
              <p>{t('eventDetail.registrationDeadline', { time: new Date(eventItem.registration_deadline).toLocaleString() })}</p>
            ) : null}
            <div className="calendar-actions">
              <button
                type="button"
                className="calendar-btn"
                onClick={() => downloadIcs(eventItem)}
              >
                {t('events.downloadIcs')}
              </button>
              <a
                href={getGoogleCalendarUrl(eventItem)}
                target="_blank"
                rel="noopener noreferrer"
                className="calendar-btn"
              >
                {t('events.googleCalendar')}
              </a>
            </div>
            {isHost ? (
              <p>
                <Link to={`/events/${eventItem.id}/edit`} className="edit-event-link">
                  <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.editEvent')}
                </Link>
              </p>
            ) : null}
          </>
        ) : (
          <p>{t('eventDetail.notFound')}</p>
        )}
        {message ? <p className="message">{message}</p> : null}
      </section>

      {/* Registration Section */}
      {eventItem && user && !isHost ? (
        <section className="card">
          <h3>{t('eventDetail.registration')}</h3>
          {myRegistration ? (
            <div>
              <p>{t('eventDetail.myRegistrationStatus')}: <strong>{registrationStatus(myRegistration.status)}</strong></p>
              {myRegistration.status === 'waitlisted' && myRegistration.waitlist_position ? (
                <p>{t('eventDetail.waitlistPosition', { position: myRegistration.waitlist_position })}</p>
              ) : null}
              {(myRegistration.status === 'pending' || myRegistration.status === 'approved' || myRegistration.status === 'waitlisted') ? (
                <button type="button" onClick={() => void handleCancelRegistration()} disabled={submitting}>
                  {t('eventDetail.cancelRegistration')}
                </button>
              ) : null}
            </div>
          ) : (
            <button type="button" onClick={() => void handleRegister()} disabled={submitting}>
              {t('eventDetail.register')}
            </button>
          )}
        </section>
      ) : null}

      {/* Host Review Section - All Registrations */}
      {isHost && registrations.length > 0 ? (
        <section className="card">
          <h3>{t('eventDetail.allRegistrations')} ({registrations.length})</h3>
          {(['pending', 'approved', 'waitlisted', 'rejected'] as const).map((status) => {
            const filtered = registrations.filter((r) => r.status === status)
            if (filtered.length === 0) {
              return null
            }
            const sectionTitle =
              status === 'pending' ? t('eventDetail.sectionPending')
              : status === 'approved' ? t('eventDetail.sectionApproved')
              : status === 'waitlisted' ? t('eventDetail.sectionWaitlisted')
              : t('eventDetail.sectionRejected')
            return (
              <div key={status} className="registration-section">
                <h4>{sectionTitle} ({filtered.length})</h4>
                <ul>
                  {filtered.map((reg) => (
                    <li key={reg.id} className="thread-item">
                      <div className="thread-header">
                        <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                        <div>
                          <p><Link to={`/profile/${reg.profile_id}`}>{profileNameMap.get(reg.profile_id) || reg.profile_id}</Link></p>
                          <small>{new Date(reg.created_at).toLocaleString()}</small>
                          {status === 'waitlisted' && reg.waitlist_position ? (
                            <small> — {t('eventDetail.waitlistPosition', { position: reg.waitlist_position })}</small>
                          ) : null}
                          {reg.reviewed_at ? (
                            <small> — {new Date(reg.reviewed_at).toLocaleString()}</small>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        {status === 'pending' ? (
                          <>
                            <button type="button" onClick={() => void handleReview(reg.id, 'approve')} disabled={submitting}>
                              {t('eventDetail.approve')}
                            </button>
                            <button type="button" onClick={() => void handleReview(reg.id, 'reject')} disabled={submitting}>
                              {t('eventDetail.reject')}
                            </button>
                          </>
                        ) : null}
                        {status === 'approved' ? (
                          <button type="button" onClick={() => void handleForceCancel(reg.id)} disabled={submitting}>
                            {t('eventDetail.forceCancel')}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      ) : null}

      {/* Attendees Section */}
      {attendees.length > 0 ? (
        <section className="card">
          <h3>{t('eventDetail.attendees')} ({attendees.length})</h3>
          <ul>
            {attendees.map((a) => (
              <li key={a.profile_id} className="thread-item">
                <div className="thread-header">
                  <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                  <div>
                    <p><Link to={`/profile/${a.profile_id}`}>{a.display_name || a.profile_id}</Link></p>
                    <small>{new Date(a.joined_at).toLocaleString()}</small>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <h3>{t('eventDetail.discussion')}</h3>
        <form onSubmit={postThread}>
          <textarea
            aria-label={t('eventDetail.discussion')}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={replyParentId ? t('eventDetail.replyingTo', { id: replyParentId }) : t('eventDetail.postComment')}
          />
          <button type="submit"><Icon href="/action-icons.svg" name="action-reply" size={16} /> {t('eventDetail.post')}</button>
          {replyParentId ? (
            <button type="button" onClick={() => setReplyParentId(null)}>
              {t('common.cancelReply')}
            </button>
          ) : null}
        </form>
        {visibleThreads.length === 0 ? (
          <div className="empty-state">
            <img src="/illustration-empty-discussion.svg" alt="" width={480} height={280} className="illustration" />
            <p>{t('eventDetail.postComment')}</p>
          </div>
        ) : (
          <ul>
            {visibleThreads.map((thread) => (
              <li key={thread.id} className="thread-item">
                <div className="thread-header">
                  <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                  <div>
                    <p>{thread.content}</p>
                    <small>
                      <Link to={`/profile/${thread.profile_id}`}>{thread.profile?.display_name || thread.profile_id}</Link>{' '}
                      {thread.parent_id ? t('eventDetail.replyTo', { id: thread.parent_id }) : ''}
                    </small>
                  </div>
                </div>
                <div>
                  <button type="button" onClick={() => setReplyParentId(thread.id)}>
                    <Icon href="/action-icons.svg" name="action-reply" size={14} /> {t('eventDetail.reply')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {id ? <ReportForm targetEventId={id} /> : null}
    </Layout>
  )
}
