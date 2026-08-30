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
import { parseEventTypes, stringifyEventTypes, isEventEditLocked } from '../lib/event-utils'
import { isAllowedExternalRegistrationUrl } from '../lib/external-registration'
import layoutStyles from '../components/EventFormLayout.module.css'
import { FeeField, EventTypeField } from '../components/EventFormFields'

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
  const loadedSnapshotRef = useRef<Record<string, unknown> | null>(null)

  const isDraft = eventLifecycle?.lifecycle_status === 'draft'
  const isSeriesMember = seriesMembers.length > 0

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

      loadedSnapshotRef.current = {
        title: event.title,
        description: event.description ?? null,
        attendance_fee_type: event.attendance_fee_type ?? 'free',
        attendance_fee_amount: (event.attendance_fee_type === 'fixed' && event.attendance_fee_amount) ? event.attendance_fee_amount : null,
        category: event.category || 'Social',
        event_type: stringifyEventTypes(parseEventTypes(event.event_type)),
        location_region: event.location_region,
        location_detail: event.location_detail ?? null,
        visibility_settings: event.visibility_settings ?? { type: 'public' },
        max_capacity: event.external_registration_url ? null : (event.max_capacity ?? null),
        registration_form_config: (event.external_registration_url || !event.registration_form_config || event.registration_form_config.length === 0) ? null : event.registration_form_config,
        external_registration_url: event.external_registration_url ?? null,
      }

      // Series context (fail-closed): a child stays a locked member even when sibling
      // lookups return nothing; a parent counts only once at least one child exists (spec 007 retry).
      const parentId = event.series_id ?? event.id
      const selfEntry = { id: event.id, start_time: event.start_time, lifecycle_status: event.lifecycle_status, title: event.title }
      const { data: childRows } = await supabase
        .from('events')
        .select('id, start_time, lifecycle_status, title')
        .eq('series_id', parentId)
      const childList = ((childRows as { id: string; start_time: string; lifecycle_status: string; title?: string }[] | null) ?? [])
        .filter((row) => row.id !== event.id)
      if (event.series_id) {
        const { data: parentRow } = await supabase
          .from('events')
          .select('id, start_time, lifecycle_status, title')
          .eq('id', parentId)
          .maybeSingle()
        const parentEntry = parentRow as { id: string; start_time: string; lifecycle_status: string; title?: string } | null
        setSeriesMembers([...(parentEntry ? [parentEntry] : []), selfEntry, ...childList])
      } else if (childList.length > 0) {
        setSeriesMembers([selfEntry, ...childList])
      } else {
        setSeriesMembers([])
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
          setMessage(t('editEvent.batchInvalidOffset'))
          return
        }
      }
      if (deadlineAction === 'set_absolute' && (!batchAbsoluteDeadline || Number.isNaN(new Date(batchAbsoluteDeadline).getTime()))) {
        setMessage(t('editEvent.batchInvalidAbsolute'))
        return
      }

      const desiredFields: Record<string, unknown> = {
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
      }
      // Deadline-only submissions must not push unrelated content onto siblings:
      // diff against the loaded snapshot and send only actual changes.
      const baseline = loadedSnapshotRef.current ?? {}
      const changedFields: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(desiredFields)) {
        if (JSON.stringify(value) !== JSON.stringify(baseline[key])) changedFields[key] = value
      }
      if (Object.keys(changedFields).length === 0 && deadlineAction === 'keep') {
        setMessage(t('editEvent.batchNothingToUpdate'))
        return
      }

      // Validate the publication window before any write: a failed schedule check
      // must not leave the series partially mutated.
      const batchPublishIso = !isDraft && publishAt ? new Date(publishAt).toISOString() : null
      const batchUnpublishIso = !isDraft && unpublishAt ? new Date(unpublishAt).toISOString() : null
      if (batchPublishIso && batchUnpublishIso && batchPublishIso >= batchUnpublishIso) {
        setMessage(t('editEvent.publicationScheduleInvalid'))
        return
      }

      setSubmitting(true)
      setMessage('')
      try {
        const payload: Record<string, unknown> = {
          target_event_id: id,
          scope: editScope,
          fields: changedFields,
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
          setMessage(t('editEvent.batchPartialFailure', {
            updated: result?.updated_count ?? 0,
            skipped: result?.skipped_locked_count ?? 0,
            failed: result?.failed_count ?? 0,
          }))
          return
        }

        // Publication control stays per-event; apply only to the edited instance.
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

        if ((result?.skipped_locked_count ?? 0) > 0) {
          alert(t('editEvent.batchSuccessWithSkipped', {
            updated: result?.updated_count ?? 0,
            skipped: result?.skipped_locked_count ?? 0,
          }))
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
      <form className={`card ${layoutStyles.form}`} onSubmit={submit}>
        <div className={layoutStyles.header}>
          <div>
            <h1>{t('editEvent.title')}</h1>
            <p>{t('editEvent.formIntro')}</p>
          </div>
          <Link to={`/events/${id}`} className="secondary-button">{t('common.cancel')}</Link>
        </div>
        {isSeriesMember ? (
          <>
            <fieldset className={`${layoutStyles.contextPanel} form-field`}>
              <legend>{t('editEvent.seriesScopeLabel')}</legend>
              <small style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>{t('editEvent.seriesScopeHint')}</small>
              <label className="checkbox"><input type="radio" name="edit-scope" value="single" checked={editScope === 'single'} onChange={() => { setEditScope('single'); setDeadlineAction('keep') }} /> {t('editEvent.seriesScopeSingle')}</label>
              <label className="checkbox"><input type="radio" name="edit-scope" value="rest_of_series" checked={editScope === 'rest_of_series'} onChange={() => setEditScope('rest_of_series')} /> {t('editEvent.seriesScopeRest')}</label>
              <label className="checkbox"><input type="radio" name="edit-scope" value="entire_series" checked={editScope === 'entire_series'} onChange={() => setEditScope('entire_series')} /> {t('editEvent.seriesScopeEntire')}</label>
              {editScope !== 'single' ? (
                <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  {t('editEvent.batchAffectedCount', { count: scopedMembers.length - lockedCount })}
                  {lockedCount > 0 ? t('editEvent.batchSkippedLockedSuffix', { count: lockedCount }) : ''}
                  {'　'}
                  {t('editEvent.batchScheduleLockedHint')}
                </small>
              ) : null}
            </fieldset>
            {editScope !== 'single' ? (
              <fieldset className={`${layoutStyles.contextPanel} form-field`}>
                <legend>{t('editEvent.batchDeadlineLabel')}</legend>
                <label className="checkbox"><input type="radio" name="deadline-action" value="keep" checked={deadlineAction === 'keep'} onChange={() => setDeadlineAction('keep')} /> {t('editEvent.batchDeadlineKeep')}</label>
                <label className="checkbox">
                  <input type="radio" name="deadline-action" value="reapply_offset" checked={deadlineAction === 'reapply_offset'} onChange={() => setDeadlineAction('reapply_offset')} />
                  {t('editEvent.batchDeadlineReapplyLabel')}
                  <input aria-label={t('editEvent.batchOffsetMinutesAria')} type="number" min="1" step="1" style={{ width: '6rem', margin: '0 0.35rem' }} value={batchOffsetMinutes} onChange={(event) => setBatchOffsetMinutes(event.target.value)} />
                </label>
                <label className="checkbox">
                  <input type="radio" name="deadline-action" value="set_absolute" checked={deadlineAction === 'set_absolute'} onChange={() => setDeadlineAction('set_absolute')} />
                  {t('editEvent.batchDeadlineAbsoluteLabel')}
                  <input aria-label={t('editEvent.batchAbsoluteDeadlineAria')} type="datetime-local" style={{ margin: '0 0.35rem' }} value={batchAbsoluteDeadline} onChange={(event) => setBatchAbsoluteDeadline(event.target.value)} />
                </label>
                {deadlineAction === 'set_absolute' ? <small style={{ color: 'var(--color-text-muted)' }}>{t('editEvent.batchDeadlineAbsoluteWarning')}</small> : null}
              </fieldset>
            ) : null}
          </>
        ) : null}
        <label className="form-field">
          <span className="form-label-row"><Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.titleLabel')}</span>
          <input aria-label={t('editEvent.titleLabel')} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <FeeField t={t} value={attendanceFeeType} onChange={setAttendanceFeeType} amount={attendanceFeeAmount} onAmountChange={setAttendanceFeeAmount} />
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
        <EventTypeField t={t} values={eventType} onChange={setEventType} />
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
          {isSeriesMember ? <small style={{ color: 'var(--color-text-muted)' }}>{t('editEvent.startTimeSeriesLockedHint')}</small> : null}
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
                {t(`events.region${region}`)}
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
        {profile?.role_status === 'venue_approved' && editScope === 'single' && (
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
        {profile?.role_status === 'venue_approved' && isSeriesMember && editScope !== 'single' ? (
          <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>{t('editEvent.batchVenueAutoDerived')}</small>
        ) : null}
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
        <div className={layoutStyles.actionBar}>
          <span>{t('editEvent.formActionHint')}</span>
          <div className={layoutStyles.actions}>
            <Link to={`/events/${id}`} className="secondary-button">{t('common.cancel')}</Link>
            <button type="submit" className="primary-cta" disabled={submitting}>
              <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('editEvent.saveEvent')}
            </button>
          </div>
        </div>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
