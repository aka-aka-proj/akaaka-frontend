import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { RegistrationFormBuilder } from '../components/RegistrationFormBuilder'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { Icon } from '../components/Icon'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { EventItem, EventCategory, TaiwanRegion, PublicationStatus, RegistrationFormField, RegistrationMode, AttendanceFeeType } from '../types'
import { TAIWAN_REGIONS } from '../types'
import { EVENT_TYPES, getEventTypeI18nKey } from '../lib/event-types'
import { parseEventTypes, stringifyEventTypes, isEventEditLocked } from '../lib/event-utils'
import { isAllowedExternalRegistrationUrl } from '../lib/external-registration'

export function EditEventPage() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attendanceFeeType, setAttendanceFeeType] = useState<AttendanceFeeType>('free')
  const [attendanceFeeAmount, setAttendanceFeeAmount] = useState('')
  const [eventType, setEventType] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [locationRegion, setLocationRegion] = useState<TaiwanRegion | ''>('')
  const [locationDetail, setLocationDetail] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('native')
  const [externalRegistrationUrl, setExternalRegistrationUrl] = useState('')
  const [isVenueHosted, setIsVenueHosted] = useState(false)
  const [visibilityType, setVisibilityType] = useState('public')
  const [category, setCategory] = useState<EventCategory>('Social')
  const [formFields, setFormFields] = useState<RegistrationFormField[]>([])
  const [publicationStatus, setPublicationStatus] = useState<PublicationStatus>('closed')
  const [publishAt, setPublishAt] = useState('')
  const [unpublishAt, setUnpublishAt] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null)
  const [approvedCount, setApprovedCount] = useState(0)
  const [editLocked, setEditLocked] = useState(false)
  const [eventLifecycle, setEventLifecycle] = useState<{ lifecycle_status: string; start_time: string } | null>(null)
  const [seriesMembers, setSeriesMembers] = useState<{ id: string; start_time: string; lifecycle_status: string; title?: string }[]>([])
  const [editScope, setEditScope] = useState<'single' | 'rest_of_series' | 'entire_series'>('single')
  const [deadlineAction, setDeadlineAction] = useState<'keep' | 'reapply_offset' | 'set_absolute'>('keep')
  const [batchOffsetMinutes, setBatchOffsetMinutes] = useState('')
  const [batchAbsoluteDeadline, setBatchAbsoluteDeadline] = useState('')

  const isDraft = eventLifecycle?.lifecycle_status === 'draft'
  const isSeriesMember = seriesMembers.length > 1

  const isMemberLocked = (member: { lifecycle_status: string; start_time: string }) =>
    member.lifecycle_status !== 'draft'
    && (['completed', 'archived', 'cancelled'].includes(member.lifecycle_status)
      || member.start_time <= new Date().toISOString())

  const scopedMembers = useMemo(() => {
    if (!isSeriesMember || editScope === 'single') return []
    if (editScope === 'entire_series') return seriesMembers
    if (eventLifecycle?.start_time) {
      return seriesMembers.filter((member) => member.start_time >= eventLifecycle.start_time)
    }
    return []
  }, [isSeriesMember, editScope, seriesMembers, eventLifecycle?.start_time])
  const lockedCount = scopedMembers.filter(isMemberLocked).length

  const addType = (type: string) => {
    if (type && !eventType.includes(type) && EVENT_TYPES.includes(type as any)) {
      setEventType([...eventType, type])
    }
  }

  // Latest-ref pattern: reload must key on data identity only (id/userId),
  // so locale changes or navigation identity churn never wipe draft edits.
  const userId = user?.id ?? null
  const tRef = useRef(t)
  const navigateRef = useRef(navigate)
  useEffect(() => {
    tRef.current = t
    navigateRef.current = navigate
  }, [t, navigate])

  useEffect(() => {
    if (!id) {
      return
    }

    const loadEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        setMessage(tRef.current('editEvent.notFound'))
        setLoading(false)
        return
      }

      const event = data as EventItem

      if (userId && event.creator_id !== userId) {
        navigateRef.current(`/events/${id}`, { replace: true })
        return
      }

      if (isEventEditLocked(event)) {
        setEditLocked(true)
        setLoading(false)
        return
      }

      setEventLifecycle({ lifecycle_status: event.lifecycle_status, start_time: event.start_time })

      setTitle(event.title)
      setDescription(event.description ?? '')
      setAttendanceFeeType(event.attendance_fee_type ?? 'free')
      setAttendanceFeeAmount(event.attendance_fee_amount?.toString() ?? '')
      
      setEventType(parseEventTypes(event.event_type))

      setStartTime(event.start_time ? toLocalDatetime(event.start_time) : '')
      setLocationRegion((event.location_region ?? '') as TaiwanRegion | '')
      setLocationDetail(event.location_detail ?? '')
      setExternalRegistrationUrl(event.external_registration_url ?? '')
      setRegistrationMode(event.external_registration_url ? 'external' : 'native')
      setMaxCapacity(event.external_registration_url ? '' : event.max_capacity?.toString() ?? '')
      setRegistrationDeadline(event.external_registration_url ? '' : event.registration_deadline ? toLocalDatetime(event.registration_deadline) : '')
      setIsVenueHosted(event.is_venue_hosted)
      setVisibilityType(event.visibility_settings?.type ?? 'public')
      setCategory(event.category || 'Social')
      setFormFields(event.external_registration_url ? [] : event.registration_form_config ?? [])
      setPublicationStatus(event.publication_status ?? (event.lifecycle_status === 'draft' ? 'closed' : 'published'))
      setPublishAt(event.publish_at ? toLocalDatetime(event.publish_at) : '')
      setUnpublishAt(event.unpublish_at ? toLocalDatetime(event.unpublish_at) : '')

      // Series context: load sibling instances when this event belongs to a recurring series.
      const parentId = event.series_id ?? event.id
      const { data: childRows } = await supabase
        .from('events')
        .select('id, start_time, lifecycle_status, title')
        .eq('series_id', parentId)
      const childList = ((childRows as { id: string; start_time: string; lifecycle_status: string; title?: string }[] | null) ?? [])
      if (event.series_id) {
        const { data: parentRow } = await supabase
          .from('events')
          .select('id, start_time, lifecycle_status, title')
          .eq('id', parentId)
          .maybeSingle()
        const members = [...(parentRow ? [parentRow as { id: string; start_time: string; lifecycle_status: string; title?: string }] : []), ...childList]
        if (members.length > 1) {
          setSeriesMembers(members)
        }
      } else if (childList.length > 0) {
        setSeriesMembers([
          { id: event.id, start_time: event.start_time, lifecycle_status: event.lifecycle_status, title: event.title },
          ...childList,
        ])
      }

      const { data: regs } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', id)
        .eq('status', 'approved')

      setApprovedCount(((regs as unknown[]) ?? []).length)
      setLoading(false)
    }

    void loadEvent()
  }, [id, userId])

  useEffect(() => {
    if (!submitting) {
      return
    }
    const cap = maxCapacity ? parseInt(maxCapacity, 10) : null
    if (cap !== null && cap < approvedCount) {
      setCapacityWarning(
        t('editEvent.capacityWarning', { max: cap, approved: approvedCount }),
      )
    } else {
      setCapacityWarning(null)
    }
  }, [maxCapacity, approvedCount, submitting, t])

  useEffect(() => {
    if (!eventLifecycle || editLocked) {
      return
    }
    const timer = window.setInterval(() => {
      if (isEventEditLocked(eventLifecycle)) {
        setEditLocked(true)
      }
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [eventLifecycle, editLocked])

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso)
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60_000)
    return local.toISOString().slice(0, 16)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !id) {
      setMessage(t('editEvent.signInFirst'))
      return
    }

    if (eventLifecycle && isEventEditLocked(eventLifecycle)) {
      setEditLocked(true)
      setMessage(t('editEvent.eventLockedTitle'))
      return
    }

    if (!title.trim() || !startTime || !locationRegion) {
      setMessage(t('editEvent.titleRequired'))
      return
    }

    if (registrationMode === 'external' && (!externalRegistrationUrl.trim() || !isAllowedExternalRegistrationUrl(externalRegistrationUrl))) {
      setMessage(t('editEvent.externalRegistrationUrlInvalid'))
      return
    }

    if (isVenueHosted && profile?.role_status !== 'venue_approved') {
      setMessage(t('editEvent.venueApprovalRequired'))
      return
    }

    const parsedFee = attendanceFeeAmount ? Number.parseInt(attendanceFeeAmount, 10) : null
    if (attendanceFeeType === 'fixed' && (!parsedFee || parsedFee <= 0 || !Number.isInteger(parsedFee))) {
      setMessage(t('editEvent.attendanceFeeInvalid'))
      return
    }

    if (editScope !== 'single' && isSeriesMember) {
      if (deadlineAction === 'reapply_offset') {
        const offsetValue = Number.parseInt(batchOffsetMinutes, 10)
        if (!Number.isInteger(offsetValue) || offsetValue < 1 || offsetValue > 525600) {
          setMessage('請輸入有效的相對截止分鐘數（1–525600）')
          return
        }
      }
      if (deadlineAction === 'set_absolute' && (!batchAbsoluteDeadline || Number.isNaN(new Date(batchAbsoluteDeadline).getTime()))) {
        setMessage('請提供有效的固定報名截止時間')
        return
      }

      setSubmitting(true)
      setMessage('')
      try {
        const payload: Record<string, unknown> = {
          target_event_id: id,
          scope: editScope,
          fields: {
            title: title.trim(),
            description: description.trim() || null,
            attendance_fee_type: attendanceFeeType,
            attendance_fee_amount: attendanceFeeType === 'fixed' ? parsedFee : null,
            category,
            event_type: stringifyEventTypes(eventType),
            location_region: locationRegion,
            location_detail: locationRegion !== 'Online' ? (locationDetail.trim() || null) : null,
            visibility_settings: { type: visibilityType },
            max_capacity: registrationMode === 'native' && maxCapacity ? parseInt(maxCapacity, 10) : null,
            registration_form_config: registrationMode === 'native' && formFields.length > 0 ? formFields : null,
            external_registration_url: registrationMode === 'external' ? externalRegistrationUrl.trim() : null,
          },
        }
        if (deadlineAction === 'reapply_offset') {
          payload.deadline = { action: 'reapply_offset', offset_minutes: Number.parseInt(batchOffsetMinutes, 10) }
        } else if (deadlineAction === 'set_absolute') {
          payload.deadline = { action: 'set_absolute', absolute: new Date(batchAbsoluteDeadline).toISOString() }
        }

        interface BatchResult {
          success?: boolean
          updated_count?: number
          skipped_locked_count?: number
          failed_count?: number
        }
        const { data: batchResult, error: batchError } = await supabase.functions.invoke('update-recurring-series', { body: payload })
        if (batchError) {
          setMessage(batchError.message)
          return
        }
        const result = batchResult as BatchResult | null
        if ((result?.failed_count ?? 0) > 0 || result?.success === false) {
          setMessage(`批次更新部分失敗：已更新 ${result?.updated_count ?? 0} 場、略過 ${result?.skipped_locked_count ?? 0} 場（已開始或已結束）、失敗 ${result?.failed_count ?? 0} 場。`)
          return
        }

        // Publication control stays per-event; apply only to the edited instance.
        const batchPublishIso = !isDraft && publishAt ? new Date(publishAt).toISOString() : null
        const batchUnpublishIso = !isDraft && unpublishAt ? new Date(unpublishAt).toISOString() : null
        if (batchPublishIso && batchUnpublishIso && batchPublishIso >= batchUnpublishIso) {
          setMessage(t('editEvent.publicationScheduleInvalid'))
          return
        }
        const { error: publicationError } = await supabase.rpc('set_event_publication', {
          p_event_id: id,
          p_publication_status: publicationStatus,
          p_publish_at: batchPublishIso,
          p_unpublish_at: batchUnpublishIso,
        })
        if (publicationError) {
          setMessage(publicationError.message)
          return
        }

        setMessage(t('editEvent.eventUpdated'))
        navigate(`/events/${id}`, { replace: true })
        return
      } finally {
        setSubmitting(false)
      }
    }

    setSubmitting(true)
    setMessage('')

    const publishIso = !isDraft && publishAt ? new Date(publishAt).toISOString() : null
    const unpublishIso = !isDraft && unpublishAt ? new Date(unpublishAt).toISOString() : null
    if (publishIso && unpublishIso && publishIso >= unpublishIso) {
      setSubmitting(false)
      setMessage(t('editEvent.publicationScheduleInvalid'))
      return
    }

    const { error } = await supabase
      .from('events')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        attendance_fee_type: attendanceFeeType,
        attendance_fee_amount: attendanceFeeType === 'fixed' ? parsedFee : null,
        category,
        event_type: stringifyEventTypes(eventType),
        ...(isSeriesMember ? {} : { start_time: new Date(startTime).toISOString() }),
        location_region: locationRegion,
        location_detail: locationRegion !== 'Online' ? (locationDetail.trim() || null) : null,
        is_venue_hosted: isVenueHosted,
        visibility_settings: { type: visibilityType },
        max_capacity: registrationMode === 'native' && maxCapacity ? parseInt(maxCapacity, 10) : null,
        registration_deadline: registrationMode === 'native' && registrationDeadline
          ? new Date(registrationDeadline).toISOString()
          : null,
        registration_form_config: registrationMode === 'native' && formFields.length > 0 ? formFields : null,
        external_registration_url: registrationMode === 'external' ? externalRegistrationUrl.trim() : null,
      })
      .eq('id', id)

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    const { error: publicationError } = await supabase.rpc('set_event_publication', {
      p_event_id: id,
      p_publication_status: publicationStatus,
      p_publish_at: publishIso,
      p_unpublish_at: unpublishIso,
    })

    if (publicationError) {
      setSubmitting(false)
      setMessage(publicationError.message)
      return
    }

    setMessage(t('editEvent.eventUpdated'))
    navigate(`/events/${id}`, { replace: true })
  }

  if (loading) {
    return (
<Layout>
        <section className="card">
          <p>{t('editEvent.loading')}</p>
        </section>
      </Layout>
    )
  }

  if (editLocked) {
    return (
      <Layout>
        <section className="card">
          <h1>{t('editEvent.title')}</h1>
          <p className="message warning">{t('editEvent.eventLockedTitle')}</p>
          <p>{t('editEvent.eventLockedHint')}</p>
          <Link to={`/events/${id}`} className="secondary-action">{t('editEvent.backToEvent')}</Link>
        </section>
      </Layout>
    )
  }

  return (
    <Layout>
      <form className="card" onSubmit={submit}>
        {isSeriesMember ? (
          <fieldset className="form-field">
            <legend>{t('editEvent.seriesScopeLabel')}</legend>
            <label className="checkbox"><input type="radio" name="edit-scope" value="single" checked={editScope === 'single'} onChange={() => { setEditScope('single'); setDeadlineAction('keep') }} /> 僅此場</label>
            <label className="checkbox"><input type="radio" name="edit-scope" value="rest_of_series" checked={editScope === 'rest_of_series'} onChange={() => setEditScope('rest_of_series')} /> 此場與後續場次</label>
            <label className="checkbox"><input type="radio" name="edit-scope" value="entire_series" checked={editScope === 'entire_series'} onChange={() => setEditScope('entire_series')} /> 整個系列</label>
            {editScope !== 'single' ? (
              <>
                <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  將更新 {scopedMembers.length - lockedCount} 場{lockedCount > 0 ? `（略過 ${lockedCount} 場已開始或已結束）` : ''}；系列排程不可透過批次編輯變更
                </small>
                <fieldset className="form-field" style={{ marginTop: '0.5rem' }}>
                  <legend>報名截止（批次）</legend>
                  <label className="checkbox"><input type="radio" name="deadline-action" value="keep" checked={deadlineAction === 'keep'} onChange={() => setDeadlineAction('keep')} /> 不變更（保留各場目前設定）</label>
                  <label className="checkbox">
                    <input type="radio" name="deadline-action" value="reapply_offset" checked={deadlineAction === 'reapply_offset'} onChange={() => setDeadlineAction('reapply_offset')} />
                    重套相對模板：每場開始前
                    <input aria-label="每場開始前的分鐘數" type="number" min="1" step="1" style={{ width: '6rem', margin: '0 0.35rem' }} value={batchOffsetMinutes} onChange={(event) => setBatchOffsetMinutes(event.target.value)} /> 分鐘
                  </label>
                  <label className="checkbox">
                    <input type="radio" name="deadline-action" value="set_absolute" checked={deadlineAction === 'set_absolute'} onChange={() => setDeadlineAction('set_absolute')} />
                    全部設為固定日期：
                    <input aria-label="固定報名截止時間" type="datetime-local" style={{ margin: '0 0.35rem' }} value={batchAbsoluteDeadline} onChange={(event) => setBatchAbsoluteDeadline(event.target.value)} />
                  </label>
                  {deadlineAction === 'set_absolute' ? <small style={{ color: 'var(--color-text-muted)' }}>警告：所有場次將共用同一報名截止時間</small> : null}
                </fieldset>
              </>
            ) : null}
          </fieldset>
        ) : null}
        <label className="form-field">
          <span className="form-label-row"><Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.titleLabel')}</span>
          <input aria-label={t('editEvent.titleLabel')} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="form-field">
          <span className="form-label-row"><Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.attendanceFeeLabel')}</span>
          <select aria-label={t('editEvent.attendanceFeeLabel')} value={attendanceFeeType} onChange={(event) => { setAttendanceFeeType(event.target.value as AttendanceFeeType); if (event.target.value !== 'fixed') setAttendanceFeeAmount('') }}>
            <option value="free">{t('editEvent.attendanceFeeFree')}</option>
            <option value="fixed">{t('editEvent.attendanceFeeFixed')}</option>
            <option value="see_description">{t('editEvent.attendanceFeeDescription')}</option>
          </select>
          {attendanceFeeType === 'fixed' ? <input aria-label={t('editEvent.attendanceFeeAmountLabel')} type="number" min="1" step="1" placeholder={t('editEvent.attendanceFeeAmountPlaceholder')} value={attendanceFeeAmount} onChange={(event) => setAttendanceFeeAmount(event.target.value)} /> : null}
          <small>{t('editEvent.attendanceFeeHint')}</small>
        </label>
        <fieldset className="form-field">
          <legend>{t('editEvent.registrationModeLabel')}</legend>
          <label className="checkbox"><input type="radio" name="registration-mode" value="native" checked={registrationMode === 'native'} onChange={() => { setRegistrationMode('native'); setExternalRegistrationUrl('') }} /> {t('editEvent.registrationModeNative')}</label>
          <small>{t('editEvent.registrationModeNativeHint')}</small>
          <label className="checkbox"><input type="radio" name="registration-mode" value="external" checked={registrationMode === 'external'} onChange={() => { setRegistrationMode('external'); setFormFields([]); setMaxCapacity(''); setRegistrationDeadline('') }} /> {t('editEvent.registrationModeExternal')}</label>
          <small>{t('editEvent.registrationModeExternalHint')}</small>
        </fieldset>
        {registrationMode === 'external' ? <label className="form-field">
          <span className="form-label-row">{t('editEvent.externalRegistrationUrlLabel')}</span>
          <input type="url" inputMode="url" aria-label={t('editEvent.externalRegistrationUrlLabel')} placeholder={t('editEvent.externalRegistrationUrlPlaceholder')} value={externalRegistrationUrl} onChange={(event) => setExternalRegistrationUrl(event.target.value)} />
          <small>{t('editEvent.externalRegistrationUrlHint')}</small>
        </label> : null}
        <label className="form-field">
          <span className="form-label-row"><Icon href="/form-icons.svg" name="form-eye" size={16} /> {t('editEvent.publicationStatusLabel')}</span>
          <select
            aria-label={t('editEvent.publicationStatusLabel')}
            value={publicationStatus}
            onChange={(event) => setPublicationStatus(event.target.value as PublicationStatus)}
          >
            <option value="published">{t('editEvent.publicationPublished')}</option>
            <option value="closed">{t('editEvent.publicationClosed')}</option>
          </select>
          <small>{t('editEvent.publicationStatusHint')}</small>
        </label>
        {!isDraft ? (
          <>
            <label className="form-field">
              <span className="form-label-row"><Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.publishAtLabel')}</span>
              <input aria-label={t('editEvent.publishAtLabel')} type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-label-row"><Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.unpublishAtLabel')}</span>
              <input aria-label={t('editEvent.unpublishAtLabel')} type="datetime-local" value={unpublishAt} onChange={(event) => setUnpublishAt(event.target.value)} />
            </label>
          </>
        ) : null}
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.descriptionLabel')}
          </span>
          <MarkdownEditor
            aria-label={t('editEvent.descriptionLabel')}
            value={description}
            onChange={setDescription}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.eventTypeLabel')}
          </span>
          <select 
            onChange={(e) => addType(e.target.value)}
            defaultValue=""
            style={{ marginBottom: '8px', width: '100%' }}
          >
            <option value="" disabled>{t('editEvent.selectEventType')}</option>
            {EVENT_TYPES.map(type => (
              <option key={type} value={type}>{t(getEventTypeI18nKey(type))}</option>
            ))}
          </select>
          <div className="tags-input-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)' }}>
            {eventType.map(type => (
              <span key={type} className="tag" style={{ background: 'var(--color-surface-muted)', padding: '4px 8px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                {t(getEventTypeI18nKey(type))}
                <button 
                  type="button" 
                  onClick={() => setEventType(eventType.filter(t => t !== type))} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px', lineHeight: '1', color: 'var(--color-text-muted)' }}
                  aria-label={t('editEvent.removeType')}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.startTimeLabel')}
          </span>
          <input
            aria-label={t('editEvent.startTimeLabel')}
            type="datetime-local"
            value={startTime}
            disabled={isSeriesMember}
            onChange={(event) => setStartTime(event.target.value)}
          />
          {isSeriesMember ? <small style={{ color: 'var(--color-text-muted)' }}>系列成員的開始時間不可個別變更</small> : null}
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-location" size={16} /> {t('editEvent.locationRegionLabel')}
          </span>
          <select
            aria-label={t('editEvent.locationRegionLabel')}
            value={locationRegion}
            onChange={(event) => setLocationRegion(event.target.value as TaiwanRegion | '')}
          >
            <option value="" disabled>{t('editEvent.locationRegionPlaceholder')}</option>
            {TAIWAN_REGIONS.map((region) => (
              <option key={region} value={region}>
                {t(`events.region${region}` as any)}
              </option>
            ))}
</select>
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.categoryLabel')}
          </span>
          <select
            aria-label={t('editEvent.categoryLabel')}
            value={category}
            onChange={(event) => setCategory(event.target.value as EventCategory)}
          >
            <option value="Social">{t('createEvent.categorySocial')}</option>
            <option value="Practice">{t('createEvent.categoryPractice')}</option>
          </select>
        </label>
        {locationRegion && locationRegion !== 'Online' && (
        <label className="form-field">
            <span className="form-label-row">
              <Icon href="/form-icons.svg" name="form-location" size={16} /> {t('editEvent.locationDetailLabel')}
            </span>
            <input
              aria-label={t('editEvent.locationDetailLabel')}
              placeholder={t('editEvent.locationDetailPlaceholder')}
              value={locationDetail}
              onChange={(event) => setLocationDetail(event.target.value)}
            />
          </label>
        )}
        {registrationMode === 'native' ? <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.maxCapacityLabel')}
          </span>
          <input
            aria-label={t('editEvent.maxCapacityLabel')}
            type="number"
            min="1"
            placeholder={t('editEvent.maxCapacityPlaceholder')}
            value={maxCapacity}
            onChange={(event) => setMaxCapacity(event.target.value)}
          />
        </label> : null}
        {capacityWarning ? (
          <p className="message warning">{capacityWarning}</p>
        ) : null}
        {registrationMode === 'native' ? <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.registrationDeadlineLabel')}
          </span>
          <input
            aria-label={t('editEvent.registrationDeadlineLabel')}
            type="datetime-local"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </label> : null}
        {profile?.role_status === 'venue_approved' && (
          <label className="checkbox">
            <input
              aria-label={t('editEvent.venueHostedLabel')}
              type="checkbox"
              checked={isVenueHosted}
              onChange={(event) => setIsVenueHosted(event.target.checked)}
            />
            <Icon href="/form-icons.svg" name="form-location" size={16} />
            {t('editEvent.venueHostedLabel')}
          </label>
        )}
        <div className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-eye" size={16} /> {t('editEvent.visibilityLabel')}
            <PrivacyDisclosure label={t('privacyDisclosure.label')} description={t('privacyDisclosure.eventVisibility')} learnMore={t('privacyDisclosure.learnMore')} />
          </span>
          <select
            id="edit-event-visibility"
            aria-label={t('editEvent.visibilityLabel')}
            value={visibilityType}
            onChange={(event) => setVisibilityType(event.target.value)}
          >
            <option value="public">{t('editEvent.public')}</option>
            <option value="connections_only">{t('editEvent.connectionsOnly')}</option>
            <option value="private">{t('editEvent.private')}</option>
          </select>
        </div>
        {registrationMode === 'native' ? <RegistrationFormBuilder fields={formFields} setFields={setFormFields} /> : null}
        <button type="submit" disabled={submitting}>
          <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('editEvent.saveEvent')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
