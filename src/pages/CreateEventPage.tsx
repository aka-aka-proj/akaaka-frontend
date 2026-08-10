import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { EVENT_TYPES } from '../lib/event-types'
import { stringifyEventTypes } from '../lib/event-utils'
import { organizeEventIdea } from '../lib/event-ai-organizer'
import { TAIWAN_REGIONS } from '../types'
import type { TaiwanRegion, EventCategory, RegistrationFormField } from '../types'

export function CreateEventPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [searchParams] = useSearchParams()
  const fromEventId = searchParams.get('from_event_id')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<EventCategory>('Social')
  const [eventType, setEventType] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [locationRegion, setLocationRegion] = useState<TaiwanRegion | ''>('')
  const [locationDetail, setLocationDetail] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [isVenueHosted, setIsVenueHosted] = useState(false)
  const [visibilityType, setVisibilityType] = useState('public')
  const [formFields, setFormFields] = useState<RegistrationFormField[]>([])
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false)
  const [recurrenceFreq, setRecurrenceFreq] = useState<'weekly' | 'monthly'>('weekly')
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>([])
  const [recurrenceCount, setRecurrenceCount] = useState(4)
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [idea, setIdea] = useState('')
  const [organizing, setOrganizing] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

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
          setCategory(data.category || 'Social')
          if (data.event_type) {
            try {
              const parsed = JSON.parse(data.event_type)
              if (Array.isArray(parsed)) setEventType(parsed)
            } catch { /* ignore */ }
          }
          setLocationRegion((data.location_region ?? '') as TaiwanRegion | '')
          setLocationDetail(data.location_detail ?? '')
          setMaxCapacity(data.max_capacity?.toString() ?? '')
          setRegistrationDeadline(data.registration_deadline ? data.registration_deadline.slice(0, 16) : '')
          setVisibilityType(data.visibility_settings?.type ?? 'public')
          setIsVenueHosted(data.is_venue_hosted ?? false)
          if (data.registration_form_config) setFormFields(data.registration_form_config)
          setStartTime('')
          setRegistrationDeadline('')
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

  const addType = (type: string) => {
    if (type && !eventType.includes(type) && EVENT_TYPES.includes(type as any)) {
      setEventType([...eventType, type])
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setMessage(t('createEvent.signInFirst'))
      return
    }

    if (!title.trim() || !startTime || !locationRegion) {
      setMessage(t('createEvent.titleRequired'))
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
          category,
          event_type: eventType.length > 0 ? stringifyEventTypes(eventType) : '[]',
          start_time: new Date(startTime).toISOString(),
          location_region: locationRegion,
          location_detail: locationRegion !== 'Online' ? (locationDetail.trim() || null) : null,
          is_venue_hosted: isVenueHosted,
          visibility_settings: { type: visibilityType },
          max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
          registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
          registration_form_config: formFields.length > 0 ? formFields : null,
          recurrence_rule: recurrenceRule,
        },
      ])
      .select('id')
      .single()
    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    if (recurrenceEnabled && data && recurrenceRule) {
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
    }

    navigate(`/events/${data.id}`, { replace: true })
  }

  return (
    <Layout>
      <form className="card" onSubmit={submit}>
        <section className="card" aria-labelledby="ai-organizer-title" style={{ background: '#fff8f5' }}>
          <h2 id="ai-organizer-title">{t('createEvent.aiOrganizerTitle')}</h2>
          <p>{t('createEvent.aiOrganizerDescription')}</p>
          <textarea
            aria-label={t('createEvent.aiIdeaLabel')}
            placeholder={t('createEvent.aiIdeaPlaceholder')}
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            rows={4}
          />
          <button type="button" onClick={organizeIdea} disabled={!idea.trim() || organizing}>
            {organizing ? t('createEvent.aiOrganizing') : t('createEvent.aiOrganize')}
          </button>
          {aiMessage ? <p className="message">{aiMessage}</p> : null}
        </section>
        {fromEventId && (
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t('createEvent.copyFrom')}</p>
        )}
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.titleLabel')}
          </span>
          <input
            aria-label={t('createEvent.titleLabel')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.descriptionLabel')}
          </span>
          <textarea
            aria-label={t('createEvent.descriptionLabel')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
          <p style={{ fontSize: '0.875rem', color: '#92400e', background: '#fffbeb', padding: '0.5rem 0.75rem', borderRadius: '0.375rem' }}>
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
            {EVENT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="tags-input-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid var(--border-color, #ccc)', borderRadius: '4px', background: 'var(--bg-primary, #fff)' }}>
            {eventType.map(type => (
              <span key={type} className="tag" style={{ background: 'var(--bg-secondary, #eee)', padding: '4px 8px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                {type}
                <button 
                  type="button" 
                  onClick={() => setEventType(eventType.filter(t => t !== type))} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px', lineHeight: '1', color: 'var(--text-secondary, #666)' }}
                  aria-label={t('createEvent.removeType')}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </label>
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
          </label>
        )}
        <label className="form-field">
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
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('createEvent.registrationDeadlineLabel')}
          </span>
          <input
            aria-label={t('createEvent.registrationDeadlineLabel')}
            type="datetime-local"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </label>
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
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-eye" size={16} /> {t('createEvent.visibilityLabel')}
          </span>
          <select
            aria-label={t('createEvent.visibilityLabel')}
            value={visibilityType}
            onChange={(event) => setVisibilityType(event.target.value)}
          >
            <option value="public">{t('createEvent.public')}</option>
            <option value="connections_only">{t('createEvent.connectionsOnly')}</option>
            <option value="private">{t('createEvent.private')}</option>
          </select>
        </label>

        {/* FormBuilder */}
        <fieldset className="card" style={{ border: '1px solid #d0d7de' }}>
          <legend>{t('createEvent.formBuilderLabel')}</legend>
          {formFields.map((field, idx) => (
            <div key={field.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{field.label}</strong>
                <button type="button" onClick={() => setFormFields(formFields.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>&times;</button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0' }}>
                {t(`createEvent.formBuilder${field.type.charAt(0).toUpperCase() + field.type.slice(1)}`)}{field.required ? ` (${t('createEvent.formBuilderFieldRequired')})` : ''}
              </p>
            </div>
          ))}
          <button type="button" onClick={() => {
            const label = prompt(t('createEvent.formBuilderFieldLabel'))
            if (!label) return
            const typeInput = prompt(t('createEvent.formBuilderFieldType') + ' (text/textarea/select/checkbox/radio)') || 'text'
            const type = typeInput as RegistrationFormField['type']
            const required = confirm(t('createEvent.formBuilderFieldRequired'))
            let options: string[] | undefined
            if (type === 'select' || type === 'radio') {
              const opts = prompt(t('createEvent.formBuilderFieldOptions'))
              if (opts) options = opts.split(',').map(s => s.trim())
            }
            setFormFields([...formFields, { id: crypto.randomUUID(), type, label, required, options }])
          }}>
            + {t('createEvent.formBuilderAddField')}
          </button>
        </fieldset>

        {/* Recurrence */}
        <label className="checkbox">
          <input type="checkbox" checked={recurrenceEnabled} onChange={(e) => setRecurrenceEnabled(e.target.checked)} />
          {t('createEvent.recurrenceLabel')}
        </label>
        {recurrenceEnabled && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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

        <button type="submit" disabled={submitting}>
          <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('createEvent.saveDraft')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
