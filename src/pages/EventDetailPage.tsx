import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { ShareButton } from '../components/ShareButton'
import { ShareToXModal } from '../components/ShareToXModal'
import { ReportForm } from '../components/ReportForm'
import { useAuth } from '../context/AuthContext'
import { useError } from '../context/ErrorContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { downloadIcs, getGoogleCalendarUrl } from '../lib/ics'
import { parseEventTypes } from '../lib/event-utils'
import { hasPracticeTag, getEventTypeI18nKey } from '../lib/event-types'
import { getAvatarPath } from '../lib/profile'
import type { EventItem, EventThread, Registration, RegistrationFormField, RegistrationResponse } from '../types'

interface Attendee {
  profile_id: string
  display_name: string | null
  joined_at: string
}

function getCompatibleFormData(
  fields: RegistrationFormField[],
  responses: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = responses[field.id]
      const compatible = field.type === 'checkbox'
        ? typeof value === 'boolean'
        : (field.type === 'select' || field.type === 'radio')
          ? typeof value === 'string' && (!field.options || field.options.includes(value))
          : typeof value === 'string'
      return value !== undefined && compatible ? [[field.id, value]] : []
    }),
  )
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
  const [previousFormData, setPreviousFormData] = useState<Record<string, unknown>>({})
  const [shareOpen, setShareOpen] = useState(false)
  const [attendeeShareOpen, setAttendeeShareOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [publicationConfirmOpen, setPublicationConfirmOpen] = useState(false)

  const isHost = user && eventItem && user.id === eventItem.creator_id
  const isRegistrationClosed = eventItem?.registration_deadline
    ? new Date(eventItem.registration_deadline).getTime() <= Date.now()
    : false
  const isAtCapacity = Boolean(eventItem?.max_capacity && attendees.length >= eventItem.max_capacity)

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
        supabase.from('events').select('*, creator:profiles(display_name, reputation_score, metadata)').eq('id', id).maybeSingle(),
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
    setPreviousFormData({})

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

      const currentEvent = eventData as EventItem | null
      if (currentEvent?.registration_form_config) {
        const { data: pastRegistrations } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('event_id', id)
          .eq('profile_id', user.id)
          .eq('status', 'cancelled')
          .order('created_at', { ascending: false })

        const pastIds = ((pastRegistrations as { id: string }[] | null) ?? []).map((registration) => registration.id)
        if (pastIds.length > 0) {
          const { data: pastResponses } = await supabase
            .from('event_registration_responses')
            .select('responses, created_at')
            .in('registration_id', pastIds)
            .order('created_at', { ascending: false })
            .limit(1)

          const latestResponses = (pastResponses?.[0] as { responses?: Record<string, unknown> } | undefined)?.responses
          if (latestResponses) {
            setPreviousFormData(getCompatibleFormData(currentEvent.registration_form_config, latestResponses))
          }
        }
      }
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

  const handlePublicationChange = async (status: 'published' | 'closed') => {
    if (!eventItem || !user || !isHost) return
    const { data, error } = await supabase.rpc('set_event_publication', {
      p_event_id: eventItem.id,
      p_publication_status: status,
      p_publish_at: null,
      p_unpublish_at: null,
    })
    if (error) {
      showError(error.message, error)
      return
    }
    setEventItem(data as EventItem)
    setPublicationConfirmOpen(false)
  }

  const handleCheckIn = async (registrationId: string) => {
    setSubmitting(true)

    const { error } = await supabase
      .from('event_registrations')
      .update({ checked_in_at: new Date().toISOString() })
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
      <div className="event-detail-layout">
      <section className="card event-detail-hero">
        {eventItem ? (
          <>
            <h2>{eventItem.title}</h2>
            {eventItem.lifecycle_status === 'draft' ? (
              <p className="message">{t('eventDetail.draftNotice')}</p>
            ) : null}
            {eventItem.lifecycle_status !== 'draft' && eventItem.publication_status === 'closed' ? (
              <p className="message">{t('eventDetail.closedNotice')}</p>
            ) : null}
            {isHost && (eventItem.publish_at || eventItem.unpublish_at) ? (
              <p className="event-meta">
                {eventItem.publish_at ? `${t('eventDetail.publishAtLabel')}: ${new Date(eventItem.publish_at).toLocaleString()}` : null}
                {eventItem.publish_at && eventItem.unpublish_at ? ' · ' : null}
                {eventItem.unpublish_at ? `${t('eventDetail.unpublishAtLabel')}: ${new Date(eventItem.unpublish_at).toLocaleString()}` : null}
              </p>
            ) : null}
            {eventItem.event_type && (
              <div className="chip-group" style={{ marginBottom: '1rem' }}>
                {parseEventTypes(eventItem.event_type).map((type) => (
                  <span key={type} className="chip">
                    {t(getEventTypeI18nKey(type))}
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
                <details className="safety-guidelines">
                  <summary>{t('eventDetail.safetyGuidelinesTitle')}</summary>
                  <ul>
                    <li>{t('eventDetail.safetyGuidelineConsent')}</li>
                    <li>{t('eventDetail.safetyGuidelineBoundaries')}</li>
                    <li>{t('eventDetail.safetyGuidelinePhotos')}</li>
                    <li>{t('eventDetail.safetyGuidelineAlcohol')}</li>
                  </ul>
                </details>
              </div>
            )}
            <p className="event-meta">
              <img src={getAvatarPath(eventItem.creator)} alt="" width={24} height={24} className="avatar avatar-sm" />
              {t('eventDetail.createdBy')} <Link to={`/profile/${eventItem.creator_id}`}>{eventItem.creator?.display_name || eventItem.creator_id}</Link>
            </p>
            <div className="event-creator-stats">
              <span className="creator-stat">
                <Icon href="/badge-icons.svg" name="reputation-star" size={14} />
                {eventItem.creator?.reputation_score ?? 0}
              </span>
              <span className="creator-stat">
                <Icon href="/report-icons.svg" name="report-safety-risk" size={14} />
                {creatorReportCount} {t('eventDetail.reports')}
              </span>
            </div>
            <div className="event-summary-grid" aria-label={t('eventDetail.summaryLabel')}>
              {eventItem.location_region ? (
                <div className="event-summary-item">
                  <Icon href="/form-icons.svg" name="form-location" size={18} />
                  <span><strong>{t('eventDetail.locationLabel')}</strong>{t(`events.region${eventItem.location_region}` as any)}{eventItem.location_detail ? ` — ${eventItem.location_detail}` : ''}</span>
                </div>
              ) : null}
              <div className="event-summary-item">
                <Icon href="/form-icons.svg" name="form-calendar" size={18} />
                <span><strong>{t('eventDetail.startTimeLabel')}</strong>{new Date(eventItem.start_time).toLocaleString()}</span>
              </div>
              {eventItem.max_capacity ? (
                <div className={`event-summary-item${isAtCapacity ? ' event-summary-item-warning' : ''}`}>
                  <Icon href="/form-icons.svg" name="form-user" size={18} />
                  <span><strong>{t('eventDetail.capacityLabel')}</strong>{isAtCapacity ? t('eventDetail.full') : t('eventDetail.capacity', {max: eventItem.max_capacity, current: attendees.length })}</span>
                </div>
              ) : null}
              {eventItem.registration_deadline ? (
                <div className={`event-summary-item${isRegistrationClosed ? ' event-summary-item-warning' : ''}`}>
                  <Icon href="/form-icons.svg" name="form-calendar" size={18} />
                  <span><strong>{t('eventDetail.registrationDeadlineLabel')}</strong>{new Date(eventItem.registration_deadline).toLocaleString()}</span>
                </div>
              ) : null}
            </div>
            {eventItem.lifecycle_status !== 'draft' && eventItem.publication_status !== 'closed' ? <div className="calendar-actions" aria-label={t('eventDetail.eventTools')}>
              <details className="calendar-menu">
                <summary className="calendar-btn">{t('events.addToCalendar')} <span aria-hidden="true">⌄</span></summary>
                <div className="calendar-menu-items">
                  <button type="button" className="calendar-btn" onClick={() => downloadIcs(eventItem)}>
                    {t('events.downloadIcs')}
                  </button>
                  <a href={getGoogleCalendarUrl(eventItem)} target="_blank" rel="noopener noreferrer" className="calendar-btn">
                    {t('events.googleCalendar')}
                  </a>
                </div>
              </details>
              <ShareButton
                title={eventItem.title}
                text={eventItem.description ?? ''}
                url={window.location.href}
              />
              {isHost ? (
                <button type="button" className="calendar-btn" onClick={() => setShareOpen(true)}>
                  {t('shareModal.broadcastToX')}
                </button>
              ) : null}
            </div> : null}
          </>
        ) : (
          <p>{t('eventDetail.notFound')}</p>
        )}
      </section>

      {/* Registration Section */}
      {eventItem && eventItem.lifecycle_status !== 'draft' && eventItem.publication_status !== 'closed' && user && !isHost ? (
        <section className="card event-registration-section">
          <h3>{t('eventDetail.registration')}</h3>
          {!myRegistration && isAtCapacity ? (
            <p className="registration-hint">{t('eventDetail.waitlistHint')}</p>
          ) : null}
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

            {myRegistration.status === 'approved' ? (
              <button type="button" onClick={() => setAttendeeShareOpen(true)} style={{ marginLeft: '0.5rem' }}>
                {t('shareModal.attendeeAnnounce')}
              </button>
            ) : null}

            </div>
          ) : eventItem.registration_deadline && isRegistrationClosed ? (
            <p className="message">{t('eventDetail.registrationClosed')}</p>
          ) : eventItem.registration_form_config ? (
            showForm ? (
              <div>
                {Object.keys(previousFormData).length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFormData(previousFormData)}
                    disabled={submitting}
                    style={{ marginBottom: '0.75rem' }}
                  >
                    {t('eventDetail.copyPreviousAnswers')}
                  </button>
                ) : null}
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
                <button type="button" className="primary-cta" disabled={submitting} onClick={async () => {
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
                  {isAtCapacity ? t('eventDetail.waitlistRegister') : t('eventDetail.register')}
                </button>
                <button type="button" onClick={() => setShowForm(false)}>{t('common.cancelReply')}</button>
              </div>
            ) : (
                <button type="button" className="primary-cta" onClick={() => setShowForm(true)} disabled={submitting}>
                {isAtCapacity ? t('eventDetail.waitlistRegister') : t('eventDetail.register')}
              </button>
            )
          ) : eventItem.max_capacity && isAtCapacity ? (
            <button type="button" className="primary-cta" onClick={() => void handleRegister()} disabled={submitting}>
              {t('eventDetail.waitlistRegister')}
            </button>
          ) : (
            <button type="button" className="primary-cta" onClick={() => void handleRegister()} disabled={submitting}>
              {t('eventDetail.register')}
            </button>
          )}
        </section>
      ) : null}

      {isHost && eventItem ? (
        <section className="card event-admin-section" aria-labelledby="event-management-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">{t('eventDetail.hostTools')}</p>
              <h3 id="event-management-title">{t('eventDetail.managementConsole')}</h3>
            </div>
            <span className="chip chip-neutral">
              {eventItem.publication_status === 'published' ? t('eventDetail.statusPublished') : t('eventDetail.statusClosed')}
            </span>
          </div>
          <div className="event-admin-actions">
            {eventItem.lifecycle_status !== 'draft' && eventItem.publication_status === 'published' ? (
              <button type="button" className="danger-action" onClick={() => setPublicationConfirmOpen(true)}>
                {t('eventDetail.unpublishNow')}
              </button>
            ) : (
              <button type="button" className="secondary-action" onClick={() => void handlePublicationChange('published')}>
                {t('eventDetail.publishNow')}
              </button>
            )}
            <Link to={`/events/${eventItem.id}/edit`} className="secondary-action">
              <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.editEvent')}
            </Link>
            <button type="button" className="secondary-action" onClick={() => navigate(`/events/new?from_event_id=${eventItem.id}`)}>
              <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.copyEvent')}
            </button>
            {eventItem.registration_form_config ? (
              <button type="button" className="secondary-action" onClick={async () => {
                const { data } = await supabase
                  .from('event_registration_responses')
                  .select('*, registration:event_registrations!inner(profile_id)')
                  .in('registration.event_id', [eventItem.id])
                if (data) setFormResponses(data as any)
              }}>
                <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.viewFormResponses')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Host Review Section - All Registrations */}
      {isHost && registrations.length > 0 ? (
        <section className="card event-admin-section event-admin-section--wide">
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
                          <>
                            {reg.checked_in_at ? (
                              <span className="chip chip-checked-in">{t('eventDetail.checkedIn')}</span>
                            ) : (
                              <button type="button" onClick={() => void handleCheckIn(reg.id)} disabled={submitting}>
                                {t('eventDetail.checkIn')}
                              </button>
                            )}
                            <button type="button" onClick={() => void handleForceCancel(reg.id)} disabled={submitting}>
                              {t('eventDetail.forceCancel')}
                            </button>
                          </>
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
        <section className="card event-admin-section event-admin-section--wide">
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
        <section className="card event-admin-section event-admin-section--wide">
          <h3>{t('eventDetail.formResponsesTitle')}</h3>
          {formResponses.map((fr) => (
            <div key={fr.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.75rem', marginBottom: '0.5rem' }}>
              <pre style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(fr.responses, null, 2)}</pre>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card event-discussion-section">
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
      </div>

      {id ? (
        <section className="event-report-section" aria-label={t('report.title')}>
          <button type="button" className="report-trigger" onClick={() => setReportOpen(true)}>
            <Icon href="/report-icons.svg" name="report-safety-risk" size={16} />
            {t('eventDetail.reportEvent')}
          </button>
        </section>
      ) : null}

      {id && reportOpen ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setReportOpen(false)
        }}>
          <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="event-report-title">
            <div className="report-modal-header">
              <h3 id="event-report-title">{t('eventDetail.reportEvent')}</h3>
              <button type="button" className="modal-close" onClick={() => setReportOpen(false)} aria-label={t('common.close')}>×</button>
            </div>
            <ReportForm targetEventId={id} />
          </div>
        </div>
      ) : null}

      {eventItem && publicationConfirmOpen ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPublicationConfirmOpen(false)
        }}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="unpublish-dialog-title">
            <h3 id="unpublish-dialog-title">{t('eventDetail.unpublishConfirmTitle')}</h3>
            <p>{t('eventDetail.unpublishWarning')}</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-action" onClick={() => setPublicationConfirmOpen(false)}>
                {t('common.cancelReply')}
              </button>
              <button type="button" className="danger-action" onClick={() => void handlePublicationChange('closed')}>
                {t('eventDetail.unpublishNow')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {eventItem ? (
        <ShareToXModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          templateType="host_broadcast"
          data={{
            event: {
              title: eventItem.title,
              startTime: new Date(eventItem.start_time).toLocaleString(),
              region: eventItem.location_region ?? '線上',
              eventUrl: window.location.href,
            },
          }}
        />
      ) : null}

      {eventItem && eventItem.creator ? (
        <ShareToXModal
          open={attendeeShareOpen}
          onClose={() => setAttendeeShareOpen(false)}
          templateType="attendee_announcement"
          data={{
            event: {
              title: eventItem.title,
              startTime: '',
              hostName: eventItem.creator.metadata?.twitter_handle
                ? `@${eventItem.creator.metadata.twitter_handle}`
                : (eventItem.creator.display_name ?? ''),
              eventUrl: window.location.href,
            },
          }}
        />
      ) : null}
    </Layout>
  )
}
