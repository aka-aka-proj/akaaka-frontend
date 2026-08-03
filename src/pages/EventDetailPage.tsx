import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { ShareButton } from '../components/ShareButton'
import { ReportForm } from '../components/ReportForm'
import { useAuth } from '../context/AuthContext'
import { useError } from '../context/ErrorContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { downloadIcs, getGoogleCalendarUrl } from '../lib/ics'
import { parseEventTypes } from '../lib/event-utils'
import { hasPracticeTag } from '../lib/event-types'
import type { EventItem, EventThread, Registration, RegistrationFormField, RegistrationResponse } from '../types'

interface Attendee {
  profile_id: string
  display_name: string | null
  joined_at: string
}

export function EventDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useT()
  const { showError } = useError()
  const navigate = useNavigate()
  const [eventItem, setEventItem] = useState<EventItem | null>(null)
  const [threads, setThreads] = useState<EventThread[]>([])
  const [content, setContent] = useState('')
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])
  const [creatorReportCount, setCreatorReportCount] = useState<number>(0)
  const [myRegistration, setMyRegistration] = useState<Registration | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [profileNameMap, setProfileNameMap] = useState<Map<string, string | null>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [formResponses, setFormResponses] = useState<RegistrationResponse[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>({})

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
      showError(eventError?.message ?? threadError?.message ?? t('eventDetail.unableToLoad'), eventError || threadError)
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
        showError(blocksError.message, blocksError)
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
    let tempMap = new Map<string, string | null>()
    if (allRegs && allRegs.length > 0) {
      const profileIds = [...new Set(((allRegs as Registration[]) ?? []).map((r) => r.profile_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', profileIds)

      tempMap = new Map(((profiles as { id: string; display_name: string | null }[]) ?? []).map((p) => [p.id, p.display_name]))
      setProfileNameMap(tempMap)
    } else {
      setProfileNameMap(new Map())
    }

    // Load attendees (approved or cancellation_rejected)
    const approvedRegs = ((allRegs as Registration[]) ?? []).filter((r) => r.status === 'approved' || r.status === 'cancellation_rejected')
    if (approvedRegs.length > 0) {
      setAttendees(
        approvedRegs.map((r) => ({
          profile_id: r.profile_id,
          display_name: tempMap.get(r.profile_id) ?? null,
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

    const { error } = await supabase.functions.invoke('create-registration', {
      body: { event_id: id },
    })

    setSubmitting(false)

    if (error) {
      const errorMessage = (error as any).context?.message || error.message
      showError(errorMessage, error)
      return
    }

    await load()
  }

  const handleCancelRegistration = async () => {
    if (!id || !user) {
      return
    }
    setSubmitting(true)

    const { error } = await supabase.functions.invoke('cancel-registration', {
      body: { event_id: id },
    })

    setSubmitting(false)

    if (error) {
      showError(error.message, error)
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

    const { error } = await supabase
      .from('event_registrations')
      .update({ status: 'cancelled' })
      .eq('id', registrationId)

    setSubmitting(false)

    if (error) {
      showError(error.message, error)
      return
    }

    await load()
  }

  const handleReview = async (registrationId: string, action: 'approve' | 'reject' | 'reopen') => {
    if (!id || !user) {
      return
    }
    setSubmitting(true)

    const { error } = await supabase.functions.invoke('review-registration', {
      body: { event_id: id, registration_id: registrationId, action },
    })

    setSubmitting(false)

    if (error) {
      showError(error.message, error)
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
      showError(error.message, error)
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
      case 'cancellation_pending': return t('eventDetail.regCancellationPending')
      case 'cancellation_rejected': return t('eventDetail.regCancellationRejected')
      default: return status
    }
  }

  return (
    <Layout>
      <section className="card">
        {eventItem ? (
          <>
            <h2>{eventItem.title}</h2>
            {eventItem.event_type && (
              <div className="chip-group" style={{ marginBottom: '1rem' }}>
                {parseEventTypes(eventItem.event_type).map((type) => (
                  <span key={type} className="chip">
                    {type}
                  </span>
                ))}
              </div>
            )}
            <p>{eventItem.description ?? t('eventDetail.noDescription')}</p>
            {eventItem && hasPracticeTag(parseEventTypes(eventItem.event_type)) && (
              <div className="safety-banner">
                <div className="safety-banner-title">
                  <Icon href="/action-icons.svg" name="action-shield" size={16} /> {t('eventDetail.safetyProtocolTitle')}
                </div>
                <div className="safety-banner-body">
                  <p>{t('eventDetail.safetyProtocolDesc')}</p>
                </div>
                <div className="safety-banner-protocol">
                  <span className="safety-banner-tag">SSC</span>
                  <span className="safety-banner-tag">RACK</span>
                </div>
              </div>
            )}
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
            <p><Icon href="/form-icons.svg" name="form-calendar" size={14} /> {t('eventDetail.startTimeLabel')}: {new Date(eventItem.start_time).toLocaleString()}</p>
            {eventItem.location_region ? (
              <p><Icon href="/form-icons.svg" name="form-location" size={14} /> {t(`events.region${eventItem.location_region}` as any)}{eventItem.location_detail ? ` — ${eventItem.location_detail}` : ''}</p>
            ) : null}
            {eventItem.max_capacity ? (
              <p>{t('eventDetail.capacity', {max: eventItem.max_capacity, current: attendees.length })}</p>
            ) : null}
            {eventItem.registration_deadline ? (
              <p><Icon href="/form-icons.svg" name="form-calendar" size={14} /> {t('eventDetail.registrationDeadlineLabel')}: {new Date(eventItem.registration_deadline).toLocaleString()}</p>
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
              <ShareButton
                title={eventItem.title}
                text={eventItem.description ?? ''}
                url={window.location.href}
              />
            </div>
            {isHost ? (
              <p>
                <Link to={`/events/${eventItem.id}/edit`} className="edit-event-link">
                  <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.editEvent')}
                </Link>
                {' | '}
                <button type="button" className="edit-event-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: '#0d6efd', padding: 0 }} onClick={() => navigate(`/events/new?from_event_id=${eventItem.id}`)}>
                  <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.copyEvent')}
                </button>
                {eventItem.registration_form_config && (
                  <>
                    {' | '}
                    <button type="button" className="edit-event-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: '#0d6efd', padding: 0 }}
                      onClick={async () => {
                        const { data } = await supabase
                          .from('event_registration_responses')
                          .select('*, registration:event_registrations!inner(profile_id)')
                          .in('registration.event_id', [eventItem.id])
                        if (data) setFormResponses(data as any)
                      }}>
                      <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.viewFormResponses')}
                    </button>
                  </>
                )}
              </p>
            ) : null}
          </>
        ) : (
          <p>{t('eventDetail.notFound')}</p>
        )}
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
            {myRegistration.status === 'cancellation_rejected' && (
              <p>{t('eventDetail.regCancellationRejected')}</p>
            )}
            {(myRegistration.status === 'pending' || myRegistration.status === 'approved' || myRegistration.status === 'waitlisted') ? (
              <button type="button" onClick={() => void handleCancelRegistration()} disabled={submitting}>
                {t('eventDetail.cancelRegistration')}
              </button>
            ) : null}

            </div>
          ) : eventItem.registration_form_config ? (
            showForm ? (
              <div>
                {(eventItem.registration_form_config as RegistrationFormField[]).map((field) => (
                  <label key={field.id} className="form-field" style={{ marginBottom: '0.5rem' }}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    {field.type === 'text' && (
                      <input value={(formData[field.id] as string) ?? ''} onChange={(e) => setFormData({...formData, [field.id]: e.target.value})} placeholder={field.placeholder} />
                    )}
                    {field.type === 'textarea' && (
                      <textarea value={(formData[field.id] as string) ?? ''} onChange={(e) => setFormData({...formData, [field.id]: e.target.value})} placeholder={field.placeholder} />
                    )}
                    {field.type === 'select' && field.options && (
                      <select value={(formData[field.id] as string) ?? ''} onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}>
                        <option value="">--</option>
                        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {field.type === 'checkbox' && (
                      <label className="checkbox">
                        <input type="checkbox" checked={!!formData[field.id]} onChange={(e) => setFormData({...formData, [field.id]: e.target.checked})} />
                        {field.label}
                      </label>
                    )}
                    {field.type === 'radio' && field.options?.map(o => (
                      <label key={o} className="checkbox">
                        <input type="radio" name={field.id} value={o} checked={formData[field.id] === o} onChange={(e) => setFormData({...formData, [field.id]: e.target.value})} />
                        {o}
                      </label>
                    ))}
                  </label>
                ))}
                <button type="button" disabled={submitting} onClick={async () => {
                  const fields = eventItem.registration_form_config as RegistrationFormField[]
                  for (const f of fields) {
                    if (f.required) {
                      const val = formData[f.id]
                      if (val === undefined || val === null || val === '' || val === false) {
                        showError(`"${f.label}" ${t('eventDetail.fillFormBeforeRegister')}`, null)
                        return
                      }
                    }
                  }
                  setSubmitting(true)
                  const { error } = await supabase.functions.invoke('create-registration', {
                    body: { event_id: id, form_responses: formData },
                  })
                  setSubmitting(false)
                  if (error) {
                    showError((error as any).context?.message || error.message, error)
                    return
                  }
                  setShowForm(false)
                  await load()
                }}>
                  {t('eventDetail.register')}
                </button>
                <button type="button" onClick={() => setShowForm(false)}>{t('common.cancelReply')}</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowForm(true)} disabled={submitting}>
                {t('eventDetail.register')}
              </button>
            )
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
          {(['pending', 'approved', 'waitlisted', 'rejected', 'cancellation_pending', 'cancellation_rejected'] as const).map((status) => {
            const filtered = registrations.filter((r) => r.status === status)
            if (filtered.length === 0) {
              return null
            }
            const sectionTitle =
              status === 'pending' ? t('eventDetail.sectionPending')
              : status === 'approved' ? t('eventDetail.sectionApproved')
              : status === 'waitlisted' ? t('eventDetail.sectionWaitlisted')
              : status === 'cancellation_pending' ? t('eventDetail.sectionCancellationPending')
              : status === 'cancellation_rejected' ? t('eventDetail.sectionCancellationRejected')
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
                        {status === 'cancellation_pending' ? (
                          <>
                            <button type="button" onClick={() => void handleReview(reg.id, 'approve')} disabled={submitting}>
                              {t('eventDetail.confirmCancellation')}
                            </button>
                            <button type="button" onClick={() => void handleReview(reg.id, 'reject')} disabled={submitting}>
                              {t('eventDetail.rejectCancellation')}
                            </button>
                          </>
                        ) : status === 'pending' ? (
                          <>
                            <button type="button" onClick={() => void handleReview(reg.id, 'approve')} disabled={submitting}>
                              {t('eventDetail.approveRegistration')}
                            </button>
                            <button type="button" onClick={() => void handleReview(reg.id, 'reject')} disabled={submitting}>
                              {t('eventDetail.rejectRegistration')}
                            </button>
                          </>
                        ) : null}
                        {status === 'cancellation_rejected' ? (
                          <button type="button" onClick={() => void handleReview(reg.id, 'reopen')} disabled={submitting}>
                            {t('eventDetail.reopen')}
                          </button>
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
      {isHost && attendees.length > 0 ? (
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

      {isHost && formResponses.length > 0 ? (
        <section className="card">
          <h3>{t('eventDetail.formResponsesTitle')}</h3>
          {formResponses.map((fr) => (
            <div key={fr.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.75rem', marginBottom: '0.5rem' }}>
              <pre style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(fr.responses, null, 2)}</pre>
            </div>
          ))}
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
