import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { EVENT_TYPES, SOCIAL_TAGS, PRACTICE_TAGS, getEventTypeI18nKey } from '../lib/event-types'
import { stringifyEventTypes } from '../lib/event-utils'
import { isAllowedExternalRegistrationUrl } from '../lib/external-registration'
import { organizeEventIdea } from '../lib/event-ai-organizer'
import { isAllowedEventSourceUrl } from '../lib/event-source'
import type { EventSourcePreview } from '../lib/event-source'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { TAIWAN_REGIONS } from '../types'
import type { TaiwanRegion, EventCategory, RegistrationFormField, RegistrationMode, AttendanceFeeType, Visibility } from '../types'

const MAX_FORM_FIELDS = 10
const OPTION_FIELD_TYPES: RegistrationFormField['type'][] = ['select', 'radio', 'checkbox']
const FORM_FIELD_TYPES: RegistrationFormField['type'][] = ['text', 'textarea', 'radio', 'checkbox', 'select']

const VISIBILITY_HINT_KEYS: Record<Visibility, string> = {
  public: 'createEvent.visibilityPublicHint',
  connections_only: 'createEvent.visibilityConnectionsOnlyHint',
  private: 'createEvent.visibilityPrivateHint',
}

function newFormField(type: RegistrationFormField['type']): RegistrationFormField {
  return {
    id: crypto.randomUUID(),
    type,
    label: '',
    required: false,
    options: OPTION_FIELD_TYPES.includes(type) ? [''] : undefined,
  }
}

export function CreateEventPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [searchParams] = useSearchParams()
  const fromEventId = searchParams.get('from_event_id')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attendanceFeeType, setAttendanceFeeType] = useState<AttendanceFeeType>('free')
  const [attendanceFeeAmount, setAttendanceFeeAmount] = useState('')
  const [category, setCategory] = useState<EventCategory>('Social')
  const [eventType, setEventType] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [locationRegion, setLocationRegion] = useState<TaiwanRegion | ''>('')
  const [locationDetail, setLocationDetail] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('native')
  const [externalRegistrationUrl, setExternalRegistrationUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourcePreview, setSourcePreview] = useState<EventSourcePreview | null>(null)
  const [isVenueHosted, setIsVenueHosted] = useState(false)
  const [visibilityType, setVisibilityType] = useState<Visibility>('public')
  const [formFields, setFormFields] = useState<RegistrationFormField[]>([])
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)
  const [showFormPreview, setShowFormPreview] = useState(false)
  const [deletedField, setDeletedField] = useState<{ field: RegistrationFormField; index: number } | null>(null)
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null)
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const publishIntentRef = useRef(false)
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false)
  const [recurrenceFreq, setRecurrenceFreq] = useState<'weekly' | 'monthly'>('weekly')
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>([])
  const [recurrenceCount, setRecurrenceCount] = useState(4)
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const createdEventRef = useRef<{ eventId: string; instanceIds: string[] } | null>(null)
  const [idea, setIdea] = useState('')
  const [organizing, setOrganizing] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [showAssistTools, setShowAssistTools] = useState(false)

  const getStartWeekday = () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return dayNames[new Date(startTime).getDay()] ?? 'Mon'
  }

  useEffect(() => {
    if (fromEventId) {
      supabase.from('events').select('*').eq('id', fromEventId).single().then(({ data, error }) => {
        if (!error && data) {
          setTitle(data.title)
          setDescription(data.description ?? '')
          setAttendanceFeeType(data.attendance_fee_type ?? 'free')
          setAttendanceFeeAmount(data.attendance_fee_amount?.toString() ?? '')
          setCategory(data.category || 'Social')
          if (data.event_type) {
            try {
              const parsed = JSON.parse(data.event_type)
              if (Array.isArray(parsed)) setEventType(parsed)
            } catch { /* ignore */ }
          }
          setLocationRegion((data.location_region ?? '') as TaiwanRegion | '')
          setLocationDetail(data.location_detail ?? '')
          setExternalRegistrationUrl(data.external_registration_url ?? '')
          setRegistrationMode(data.external_registration_url ? 'external' : 'native')
          setMaxCapacity(data.external_registration_url ? '' : data.max_capacity?.toString() ?? '')
          setRegistrationDeadline(data.external_registration_url ? '' : data.registration_deadline ? data.registration_deadline.slice(0, 16) : '')
          setSourceUrl(data.source_url ?? '')
          setVisibilityType(data.visibility_settings?.type ?? 'public')
          setIsVenueHosted(data.is_venue_hosted ?? false)
          setFormFields(data.external_registration_url ? [] : data.registration_form_config ?? [])
          setStartTime('')
        }
      })
    }
  }, [fromEventId])

  const organizeIdea = () => {
    setOrganizing(true)
    setAiMessage('')
    const organized = organizeEventIdea(idea)
    if (organized.title) setTitle(organized.title)
    if (organized.description) setDescription(organized.description)
    if (organized.category) setCategory(organized.category)
    if (organized.eventType) setEventType(organized.eventType)
    if (organized.locationRegion) setLocationRegion(organized.locationRegion)
    setAiMessage(t('createEvent.aiOrganizedNotice'))
    setOrganizing(false)
  }

  const importSource = async () => {
    const normalized = sourceUrl.trim()
    if (!isAllowedEventSourceUrl(normalized)) {
      setMessage(t('createEvent.sourceUrlInvalid'))
      return
    }
    setOrganizing(true)
    setMessage('')
    const { data, error } = await supabase.functions.invoke('import-event-source', { body: { source_url: normalized } })
    setOrganizing(false)
    if (error || !data?.preview) {
      setMessage(error?.message ?? t('createEvent.sourceImportFailed'))
      return
    }
    const preview = data as EventSourcePreview
    setSourcePreview(preview)
    if (preview.preview.title) setTitle(preview.preview.title)
    if (preview.preview.description) setDescription(preview.preview.description)
    if (preview.provider === 'docs.google.com') {
      setRegistrationMode('external')
      setExternalRegistrationUrl(normalized)
      setFormFields([])
      setMaxCapacity('')
      setRegistrationDeadline('')
    }
    setAiMessage(t('createEvent.sourceImportPreview'))
  }

  const addType = (type: string) => {
    if (type && !eventType.includes(type) && EVENT_TYPES.includes(type as any)) {
      setEventType([...eventType, type])
    }
  }

  const updateFormField = (id: string, updates: Partial<RegistrationFormField>) => {
    setFormFields((fields) => fields.map((field) => field.id === id ? { ...field, ...updates } : field))
  }

  const addFormField = (type: RegistrationFormField['type']) => {
    if (formFields.length >= MAX_FORM_FIELDS) return
    const field = newFormField(type)
    setFormFields((fields) => [...fields, field])
    setExpandedFieldId(field.id)
  }

  const removeFormField = (id: string) => {
    const index = formFields.findIndex((field) => field.id === id)
    const field = formFields[index]
    if (!field) return
    setFormFields((fields) => fields.filter((item) => item.id !== id))
    setExpandedFieldId(null)
    setDeletedField({ field, index })
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
    undoTimeout.current = setTimeout(() => setDeletedField(null), 6000)
  }

  const undoRemoveFormField = () => {
    if (!deletedField) return
    setFormFields((fields) => {
      const next = [...fields]
      next.splice(Math.min(deletedField.index, next.length), 0, deletedField.field)
      return next
    })
    setExpandedFieldId(deletedField.field.id)
    setDeletedField(null)
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
  }

  const moveFormField = (id: string, direction: -1 | 1) => {
    setFormFields((fields) => {
      const index = fields.findIndex((field) => field.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= fields.length) return fields
      const next = [...fields]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const dropFormField = (targetId: string) => {
    if (!draggedFieldId || draggedFieldId === targetId) return
    setFormFields((fields) => {
      const sourceIndex = fields.findIndex((field) => field.id === draggedFieldId)
      const targetIndex = fields.findIndex((field) => field.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return fields
      const next = [...fields]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
    setDraggedFieldId(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const shouldPublish = publishIntentRef.current
    publishIntentRef.current = false
    if (!user) {
      setMessage(t('createEvent.signInFirst'))
      return
    }

    if (!title.trim() || !startTime || !locationRegion) {
      setMessage(t('createEvent.titleRequired'))
      return
    }

    if (registrationMode === 'external' && (!externalRegistrationUrl.trim() || !isAllowedExternalRegistrationUrl(externalRegistrationUrl))) {
      setMessage(t('createEvent.externalRegistrationUrlInvalid'))
      return
    }

    if (sourceUrl.trim() && !isAllowedEventSourceUrl(sourceUrl)) {
      setMessage(t('createEvent.sourceUrlInvalid'))
      return
    }

    const parsedFee = attendanceFeeAmount ? Number.parseInt(attendanceFeeAmount, 10) : null
    if (attendanceFeeType === 'fixed' && (!parsedFee || parsedFee <= 0 || !Number.isInteger(parsedFee))) {
      setMessage(t('createEvent.attendanceFeeInvalid'))
      return
    }

    setSubmitting(true)
    const selectedRecurrenceDays = recurrenceDays.length > 0 ? recurrenceDays : [getStartWeekday()]
    const recurrenceRule = recurrenceEnabled ? {
      frequency: recurrenceFreq,
      interval: recurrenceInterval,
      days: recurrenceFreq === 'weekly' ? selectedRecurrenceDays : undefined,
      count: recurrenceCount,
      until: recurrenceEndDate ? new Date(`${recurrenceEndDate}T23:59:59`).toISOString() : undefined,
    } : null

    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          creator_id: user.id,
          lifecycle_status: 'draft',
          title: title.trim(),
          description: description.trim() || null,
          attendance_fee_type: attendanceFeeType,
          attendance_fee_amount: attendanceFeeType === 'fixed' ? parsedFee : null,
          category,
          event_type: eventType.length > 0 ? stringifyEventTypes(eventType) : '[]',
          start_time: new Date(startTime).toISOString(),
          location_region: locationRegion,
          location_detail: locationRegion !== 'Online' ? (locationDetail.trim() || null) : null,
          is_venue_hosted: isVenueHosted,
          visibility_settings: { type: visibilityType },
          max_capacity: registrationMode === 'native' && maxCapacity ? parseInt(maxCapacity, 10) : null,
          registration_deadline: registrationMode === 'native' && registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
          registration_form_config: registrationMode === 'native' && formFields.length > 0 ? formFields : null,
          external_registration_url: registrationMode === 'external' ? externalRegistrationUrl.trim() : null,
          source_url: sourceUrl.trim() || null,
          recurrence_rule: recurrenceRule,
        },
      ])
      .select('id')
      .single()
    try {
      if (error) {
        setMessage(error.message)
        return
      }

      const existing = createdEventRef.current
      let publishInstanceIds: string[] = []

      if (existing) {
        publishInstanceIds = existing.instanceIds
      } else if (recurrenceEnabled && data && recurrenceRule) {
        const { error: recurrenceError, data: recurrenceResult } = await supabase.functions.invoke('create-recurring-events', {
          body: {
            parent_event_id: data.id,
            recurrence_rule: recurrenceRule,
            start_time: new Date(startTime).toISOString(),
          },
        })
        if (recurrenceError) {
          setMessage(`活動已建立，但週期場次建立失敗：${recurrenceError.message}`)
          return
        }
        if (recurrenceResult && recurrenceResult.success === false) {
          setMessage(`活動已建立，但有 ${recurrenceResult.failed_instance_count} 個週期場次建立失敗。`)
          return
        }
        if (recurrenceResult && Array.isArray(recurrenceResult.instance_ids)) {
          publishInstanceIds = recurrenceResult.instance_ids as string[]
        }
      }

      const currentEventId = existing ? existing.eventId : data?.id
      if (!currentEventId) {
        setMessage('活動建立失敗：缺少活動 ID')
        return
      }
      if (!existing) {
        createdEventRef.current = { eventId: currentEventId, instanceIds: publishInstanceIds }
      }

      if (shouldPublish) {
        const targetIds = publishInstanceIds.length > 0 ? publishInstanceIds : [currentEventId]
        const publicationResults = await Promise.allSettled(
          targetIds.map((eventId) =>
            supabase.rpc('set_event_publication', {
              p_event_id: eventId,
              p_publication_status: 'published',
              p_publish_at: null,
              p_unpublish_at: null,
            }),
          ),
        )
        const failedCount = publicationResults.filter(
          (result) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error),
        ).length
        if (failedCount > 0) {
          setMessage(t('createEvent.publishPartialFailed', { count: failedCount }))
          return
        }
      }

      createdEventRef.current = null
      navigate(`/events/${currentEventId}`, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <form className="card create-event-form" onSubmit={submit}>
        <div className="create-event-header">
          <div>
            <h1>{t('createEvent.title')}</h1>
            <p>{t('createEvent.formIntro')}</p>
          </div>
          <button type="button" className="secondary-button assist-toggle" aria-expanded={showAssistTools} onClick={() => setShowAssistTools((visible) => !visible)}>
            {showAssistTools ? t('createEvent.hideAssistTools') : t('createEvent.showAssistTools')}
          </button>
        </div>
        {showAssistTools ? <div className="assist-tools">
          <section className="assist-card" aria-labelledby="ai-organizer-title">
            <h2 id="ai-organizer-title">{t('createEvent.aiOrganizerTitle')}</h2>
            <p>{t('createEvent.aiOrganizerDescription')}</p>
            <textarea
              aria-label={t('createEvent.aiIdeaLabel')}
              placeholder={t('createEvent.aiIdeaPlaceholder')}
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              rows={4}
            />
            <button type="button" className="primary-cta" onClick={organizeIdea} disabled={!idea.trim() || organizing}>
              {organizing ? t('createEvent.aiOrganizing') : t('createEvent.aiOrganize')}
            </button>
            {aiMessage ? <p className="message">{aiMessage}</p> : null}
          </section>
          <section className="assist-card assist-card--info" aria-labelledby="event-source-import-title">
            <h2 id="event-source-import-title">{t('createEvent.sourceImportTitle')}</h2>
            <p>{t('createEvent.sourceImportDescription')}</p>
            <input
              type="url"
              aria-label={t('createEvent.sourceUrlLabel')}
              placeholder={t('createEvent.sourceUrlPlaceholder')}
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
            />
            <button type="button" className="secondary-button" onClick={() => void importSource()} disabled={!sourceUrl.trim() || organizing}>
              {organizing ? t('createEvent.sourceImporting') : t('createEvent.sourceImportButton')}
            </button>
            {sourcePreview ? <p className="message" role="status">{t('createEvent.sourcePreviewNotice', { provider: sourcePreview.provider })}</p> : null}
          </section>
        </div> : null}
        {fromEventId && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('createEvent.copyFrom')}</p>
        )}
        <section className="form-section" aria-labelledby="basic-info-title">
          <div className="form-section-heading"><h2 id="basic-info-title">{t('createEvent.basicInfoSection')}</h2><span>1</span></div>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.titleLabel')}
          </span>
          <input aria-label={t('createEvent.titleLabel')} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.descriptionLabel')}
          </span>
          <MarkdownEditor
            aria-label={t('createEvent.descriptionLabel')}
            value={description}
            onChange={setDescription}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.categoryLabel')}
          </span>
          <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
            <option value="Social">{t('createEvent.categorySocial')}</option>
            <option value="Practice">{t('createEvent.categoryPractice')}</option>
          </select>
        </label>
        {category === 'Practice' && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', background: 'var(--color-warning-surface)', padding: '0.5rem 0.75rem', borderRadius: '0.375rem' }}>
            {t('eventDetail.safetyProtocolDesc')}
          </p>
        )}
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('createEvent.eventTypeLabel')}
          </span>
          <select 
            onChange={(e) => addType(e.target.value)}
            defaultValue=""
            style={{ marginBottom: '8px', width: '100%' }}
          >
            <option value="" disabled>{t('createEvent.selectEventType')}</option>
            <optgroup label={t('createEvent.categorySocial')}>
              {SOCIAL_TAGS.map((type) => (
                <option key={type} value={type}>{t(getEventTypeI18nKey(type))}</option>
              ))}
            </optgroup>
            <optgroup label={t('createEvent.categoryPractice')}>
              {PRACTICE_TAGS.map((type) => (
                <option key={type} value={type}>{t(getEventTypeI18nKey(type))}</option>
              ))}
            </optgroup>
          </select>
          <div className="tags-input-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)' }}>
            {eventType.map(type => (
              <span key={type} className="tag" style={{ background: 'var(--color-surface-muted)', padding: '4px 8px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                {t(getEventTypeI18nKey(type))}
                <button 
                  type="button" 
                  onClick={() => setEventType(eventType.filter(t => t !== type))} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px', lineHeight: '1', color: 'var(--color-text-muted)' }}
                  aria-label={t('createEvent.removeType')}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </label>
        </section>
        <section className="form-section" aria-labelledby="time-location-title">
          <div className="form-section-heading"><h2 id="time-location-title">{t('createEvent.timeLocationSection')}</h2><span>2</span></div>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('createEvent.startTimeLabel')}
          </span>
          <input
            aria-label={t('createEvent.startTimeLabel')}
            type="datetime-local"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={recurrenceEnabled} onChange={(e) => setRecurrenceEnabled(e.target.checked)} />
          {t('createEvent.recurrenceLabel')}
        </label>
        {recurrenceEnabled && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '0.375rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label>
              {t('createEvent.recurrenceEvery')}
              <input type="number" min={1} value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)} style={{ width: '60px', marginLeft: '0.5rem' }} />
              <select value={recurrenceFreq} onChange={(e) => setRecurrenceFreq(e.target.value as 'weekly' | 'monthly')} style={{ marginLeft: '0.5rem' }}>
                <option value="weekly">{t('createEvent.recurrenceWeeks')}</option>
                <option value="monthly">{t('createEvent.recurrenceMonths')}</option>
              </select>
            </label>
            {recurrenceFreq === 'weekly' && (
              <div className="chip-group">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => (
                  <button key={day} type="button"
                    className={`chip${recurrenceDays.includes(day) ? ' chip-active' : ''}`}
                    onClick={() => setRecurrenceDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day])}>
                    {t(`createEvent.recurrence${day}`)}
                  </button>
                ))}
              </div>
            )}
            <label>
              {t('createEvent.recurrenceCount')}: <input type="number" min={1} max={52} value={recurrenceCount} onChange={(e) => setRecurrenceCount(parseInt(e.target.value) || 1)} style={{ width: '60px' }} />
            </label>
            <label>
              {t('createEvent.recurrenceEndDate')}: <input type="date" value={recurrenceEndDate} min={startTime ? startTime.slice(0, 10) : undefined} onChange={(e) => setRecurrenceEndDate(e.target.value)} />
            </label>
          </div>
        )}
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-location" size={16} /> {t('createEvent.locationRegionLabel')}
          </span>
          <select
            aria-label={t('createEvent.locationRegionLabel')}
            value={locationRegion}
            onChange={(event) => setLocationRegion(event.target.value as TaiwanRegion | '')}
          >
            <option value="" disabled>{t('createEvent.locationRegionPlaceholder')}</option>
            {TAIWAN_REGIONS.map((region) => (
              <option key={region} value={region}>
                {t(`events.region${region}` as any)}
              </option>
            ))}
          </select>
        </label>
        {locationRegion && locationRegion !== 'Online' && (
          <label className="form-field">
            <span className="form-label-row">
              <Icon href="/form-icons.svg" name="form-location" size={16} /> {t('createEvent.locationDetailLabel')}
            </span>
            <input
              aria-label={t('createEvent.locationDetailLabel')}
              placeholder={t('createEvent.locationDetailPlaceholder')}
              value={locationDetail}
              onChange={(event) => setLocationDetail(event.target.value)}
            />
            <small>{t('createEvent.locationDetailHint')}</small>
          </label>
        )}
        {locationDetail.trim() ? (
          <p className="form-field-hint">
            <Icon href="/form-icons.svg" name="form-location" size={14} /> {t('eventDetail.openInGoogleMaps')}:{' '}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationDetail.trim())}`} target="_blank" rel="noopener noreferrer">
              {locationDetail.trim()}
            </a>
          </p>
        ) : null}
        </section>
        <section className="form-section" aria-labelledby="registration-section-title">
          <div className="form-section-heading"><h2 id="registration-section-title">{t('createEvent.registrationSection')}</h2><span>3</span></div>
        <label className="form-field">
          <span className="form-label-row"><Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.attendanceFeeLabel')}</span>
          <div className="segmented-control" aria-label={t('createEvent.attendanceFeeLabel')}>
            {([['free', t('createEvent.attendanceFeeFree')], ['fixed', t('createEvent.attendanceFeeFixed')], ['see_description', t('createEvent.attendanceFeeDescription')]] as const).map(([value, label]) => (
              <label key={value} className={attendanceFeeType === value ? 'is-selected' : ''}>
                <input type="radio" name="attendance-fee" value={value} checked={attendanceFeeType === value} onChange={() => { setAttendanceFeeType(value); if (value !== 'fixed') setAttendanceFeeAmount('') }} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {attendanceFeeType === 'fixed' ? <input aria-label={t('createEvent.attendanceFeeAmountLabel')} type="number" min="1" step="1" placeholder={t('createEvent.attendanceFeeAmountPlaceholder')} value={attendanceFeeAmount} onChange={(event) => setAttendanceFeeAmount(event.target.value)} /> : null}
          <small>{t('createEvent.attendanceFeeHint')}</small>
        </label>
        <fieldset className="form-field">
          <legend>{t('createEvent.registrationModeLabel')}</legend>
          <div className="segmented-control registration-mode-control">
            <label className={registrationMode === 'native' ? 'is-selected' : ''}>
              <input type="radio" name="registration-mode" value="native" checked={registrationMode === 'native'} onChange={() => { setRegistrationMode('native'); setExternalRegistrationUrl('') }} />
              <span>{t('createEvent.registrationModeNative')}</span>
            </label>
            <label className={registrationMode === 'external' ? 'is-selected' : ''}>
              <input type="radio" name="registration-mode" value="external" checked={registrationMode === 'external'} onChange={() => { setRegistrationMode('external'); setFormFields([]); setMaxCapacity(''); setRegistrationDeadline('') }} />
              <span>{t('createEvent.registrationModeExternal')}</span>
            </label>
          </div>
          <small>{registrationMode === 'native' ? t('createEvent.registrationModeNativeHint') : t('createEvent.registrationModeExternalHint')}</small>
        </fieldset>
        {registrationMode === 'external' ? <label className="form-field">
          <span className="form-label-row">{t('createEvent.externalRegistrationUrlLabel')}</span>
          <input
            type="url"
            inputMode="url"
            aria-label={t('createEvent.externalRegistrationUrlLabel')}
            placeholder={t('createEvent.externalRegistrationUrlPlaceholder')}
            value={externalRegistrationUrl}
            onChange={(event) => setExternalRegistrationUrl(event.target.value)}
          />
          <small>{t('createEvent.externalRegistrationUrlHint')}</small>
        </label> : null}
        {registrationMode === 'native' ? <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.maxCapacityLabel')}
          </span>
          <input
            aria-label={t('createEvent.maxCapacityLabel')}
            type="number"
            min="1"
            placeholder={t('createEvent.maxCapacityPlaceholder')}
            value={maxCapacity}
            onChange={(event) => setMaxCapacity(event.target.value)}
          />
        </label> : null}
        {registrationMode === 'native' ? <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('createEvent.registrationDeadlineLabel')}
          </span>
          <input
            aria-label={t('createEvent.registrationDeadlineLabel')}
            type="datetime-local"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </label> : null}
        {profile?.role_status === 'venue_approved' && (
          <label className="checkbox">
            <input
              aria-label={t('createEvent.venueHostedLabel')}
              type="checkbox"
              checked={isVenueHosted}
              onChange={(event) => setIsVenueHosted(event.target.checked)}
            />
            <Icon href="/form-icons.svg" name="form-location" size={16} />
            {t('createEvent.venueHostedLabel')}
          </label>
        )}
        <div className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-eye" size={16} /> {t('createEvent.visibilityLabel')}
            <PrivacyDisclosure label={t('privacyDisclosure.label')} description={t('privacyDisclosure.eventVisibility')} learnMore={t('privacyDisclosure.learnMore')} />
          </span>
          <div className="segmented-control" aria-label={t('createEvent.visibilityLabel')}>
            {([['public', t('createEvent.public')], ['connections_only', t('createEvent.connectionsOnly')], ['private', t('createEvent.private')]] as const).map(([value, label]) => (
              <label key={value} className={visibilityType === value ? 'is-selected' : ''}>
                <input type="radio" name="visibility" value={value} checked={visibilityType === value} onChange={() => setVisibilityType(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p className="form-field-hint">{t(VISIBILITY_HINT_KEYS[visibilityType])}</p>
        </div>

        {registrationMode === 'native' ? <fieldset className="card form-builder">
          <div className="form-builder-heading">
            <div>
              <legend>{t('createEvent.formBuilderLabel')} ({formFields.length}/{MAX_FORM_FIELDS})</legend>
              <p>{t('createEvent.formBuilderHint')}</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setShowFormPreview((visible) => !visible)}>
              {showFormPreview ? t('createEvent.formBuilderEdit') : `◉ ${t('createEvent.formBuilderPreview')}`}
            </button>
          </div>
          {!showFormPreview && formFields.map((field, idx) => {
            const isExpanded = expandedFieldId === field.id
            const typeLabel = t(`createEvent.formBuilder${field.type.charAt(0).toUpperCase() + field.type.slice(1)}` as any)
            return (
              <div
                key={field.id}
                className={`form-builder-field${draggedFieldId === field.id ? ' is-dragging' : ''}`}
                draggable
                onDragStart={() => setDraggedFieldId(field.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropFormField(field.id)}
                onDragEnd={() => setDraggedFieldId(null)}
              >
                <div className="form-builder-field-header">
                  <button type="button" className="drag-handle" aria-label={t('createEvent.formBuilderDrag')} title={t('createEvent.formBuilderDrag')}>⋮⋮</button>
                  <button type="button" className="form-builder-expand" onClick={() => setExpandedFieldId(isExpanded ? null : field.id)} aria-expanded={isExpanded}>
                    <strong>{field.label || t('createEvent.formBuilderUntitled')}</strong>
                    <span>{typeLabel}{field.required ? ` · ${t('createEvent.formBuilderFieldRequired')}` : ''}</span>
                  </button>
                  <div className="form-builder-actions">
                    <button type="button" onClick={() => moveFormField(field.id, -1)} disabled={idx === 0} aria-label={t('createEvent.formBuilderMoveUp')}>↑</button>
                    <button type="button" onClick={() => moveFormField(field.id, 1)} disabled={idx === formFields.length - 1} aria-label={t('createEvent.formBuilderMoveDown')}>↓</button>
                    <button type="button" className="danger-icon-button" onClick={() => removeFormField(field.id)} aria-label={t('createEvent.formBuilderDelete')} title={t('createEvent.formBuilderDelete')}>🗑</button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="form-builder-field-editor">
                    <label>
                      <span>{t('createEvent.formBuilderFieldLabel')}</span>
                      <input autoFocus={!field.label} aria-label={t('createEvent.formBuilderFieldLabel')} placeholder={t('createEvent.formBuilderFieldLabelPlaceholder')} value={field.label} onChange={(event) => updateFormField(field.id, { label: event.target.value })} />
                    </label>
                    <label>
                      <span>{t('createEvent.formBuilderFieldType')}</span>
                      <select aria-label={t('createEvent.formBuilderFieldType')} value={field.type} onChange={(event) => {
                        const type = event.target.value as RegistrationFormField['type']
                        updateFormField(field.id, { type, options: OPTION_FIELD_TYPES.includes(type) ? (field.options?.length ? field.options : ['']) : undefined })
                      }}>
                        {FORM_FIELD_TYPES.map((type) => <option key={type} value={type}>{t(`createEvent.formBuilder${type.charAt(0).toUpperCase() + type.slice(1)}` as any)}</option>)}
                      </select>
                    </label>
                    <label className="form-builder-toggle">
                      <input type="checkbox" checked={field.required} onChange={(event) => updateFormField(field.id, { required: event.target.checked })} />
                      <span>{t('createEvent.formBuilderFieldRequired')}</span>
                    </label>
                    {field.options && (
                      <div className="form-builder-options">
                        <span className="form-label">{t('createEvent.formBuilderFieldOptions')}</span>
                        {field.options.map((option, optionIndex) => (
                          <div className="form-builder-option" key={`${field.id}-${optionIndex}`}>
                            <input aria-label={`${t('createEvent.formBuilderOption')} ${optionIndex + 1}`} value={option} placeholder={`${t('createEvent.formBuilderOption')} ${optionIndex + 1}`} onChange={(event) => updateFormField(field.id, { options: field.options?.map((item, index) => index === optionIndex ? event.target.value : item) })} />
                            <button type="button" onClick={() => updateFormField(field.id, { options: field.options?.filter((_, index) => index !== optionIndex) })} disabled={(field.options?.length ?? 0) <= 1} aria-label={t('createEvent.formBuilderDeleteOption')}>×</button>
                          </div>
                        ))}
                        <button type="button" className="text-button" onClick={() => updateFormField(field.id, { options: [...(field.options ?? []), ''] })}>+ {t('createEvent.formBuilderAddOption')}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {showFormPreview ? (
            <div className="form-builder-preview" aria-label={t('createEvent.formBuilderPreview')}>
              {formFields.length === 0 ? <p>{t('createEvent.formBuilderEmpty')}</p> : formFields.map((field) => <label key={field.id}><span>{field.label || t('createEvent.formBuilderUntitled')}{field.required ? ' *' : ''}</span>{field.type === 'textarea' ? <textarea disabled /> : field.type === 'select' ? <select disabled><option>{t('createEvent.formBuilderSelectPlaceholder')}</option></select> : field.type === 'radio' || field.type === 'checkbox' ? <span className="form-builder-preview-options">{field.options?.map((option, index) => <label key={index}><input type={field.type === 'radio' ? 'radio' : 'checkbox'} disabled /> {option || `${t('createEvent.formBuilderOption')} ${index + 1}`}</label>)}</span> : <input disabled />}</label>)}
            </div>
          ) : null}
          {!showFormPreview && (
            <div className="form-builder-add-row">
              <select aria-label={t('createEvent.formBuilderAddField')} defaultValue="" onChange={(event) => { if (event.target.value) { addFormField(event.target.value as RegistrationFormField['type']); event.target.value = '' } }} disabled={formFields.length >= MAX_FORM_FIELDS}>
                <option value="">+ {t('createEvent.formBuilderAddField')}</option>
                {FORM_FIELD_TYPES.map((type) => <option key={type} value={type}>{t(`createEvent.formBuilderAdd${type.charAt(0).toUpperCase() + type.slice(1)}` as any)}</option>)}
              </select>
              {formFields.length >= MAX_FORM_FIELDS ? <span className="form-builder-limit">{t('createEvent.formBuilderLimit')}</span> : null}
            </div>
          )}
          {deletedField ? <div className="form-builder-toast" role="status">{t('createEvent.formBuilderDeleted')} <button type="button" onClick={undoRemoveFormField}>{t('createEvent.formBuilderUndo')}</button></div> : null}
        </fieldset> : null}
        </section>

        <div className="sticky-action-bar">
          <span>{t('createEvent.draftNotice')}</span>
          <div className="sticky-action-buttons">
            <button type="submit" className="secondary-button" onClick={() => { publishIntentRef.current = false }} disabled={submitting}>
              {t('createEvent.saveDraft')}
            </button>
            <button type="submit" className="primary-cta" onClick={() => { publishIntentRef.current = true }} disabled={submitting}>
              <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('createEvent.saveAndPublish')}
            </button>
          </div>
        </div>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
