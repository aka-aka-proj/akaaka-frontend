import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { RegistrationFormBuilder } from '../components/RegistrationFormBuilder'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { EventItem, EventCategory, TaiwanRegion, PublicationStatus, RegistrationFormField } from '../types'
import { TAIWAN_REGIONS } from '../types'
import { EVENT_TYPES, getEventTypeI18nKey } from '../lib/event-types'
import { parseEventTypes, stringifyEventTypes } from '../lib/event-utils'
import { isAllowedExternalRegistrationUrl } from '../lib/external-registration'

export function EditEventPage() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [locationRegion, setLocationRegion] = useState<TaiwanRegion | ''>('')
  const [locationDetail, setLocationDetail] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
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

  const addType = (type: string) => {
    if (type && !eventType.includes(type) && EVENT_TYPES.includes(type as any)) {
      setEventType([...eventType, type])
    }
  }

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
        setMessage(t('editEvent.notFound'))
        setLoading(false)
        return
      }

      const event = data as EventItem

      if (user && event.creator_id !== user.id) {
        navigate(`/events/${id}`, { replace: true })
        return
      }

      setTitle(event.title)
      setDescription(event.description ?? '')
      
      setEventType(parseEventTypes(event.event_type))

      setStartTime(event.start_time ? toLocalDatetime(event.start_time) : '')
      setLocationRegion((event.location_region ?? '') as TaiwanRegion | '')
      setLocationDetail(event.location_detail ?? '')
      setMaxCapacity(event.max_capacity?.toString() ?? '')
      setRegistrationDeadline(event.registration_deadline ? toLocalDatetime(event.registration_deadline) : '')
      setExternalRegistrationUrl(event.external_registration_url ?? '')
      setIsVenueHosted(event.is_venue_hosted)
      setVisibilityType(event.visibility_settings?.type ?? 'public')
      setCategory(event.category || 'Social')
      setFormFields(event.registration_form_config ?? [])
      setPublicationStatus(event.publication_status ?? (event.lifecycle_status === 'draft' ? 'closed' : 'published'))
      setPublishAt(event.publish_at ? toLocalDatetime(event.publish_at) : '')
      setUnpublishAt(event.unpublish_at ? toLocalDatetime(event.unpublish_at) : '')

      const { data: regs } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', id)
        .eq('status', 'approved')

      setApprovedCount(((regs as unknown[]) ?? []).length)
      setLoading(false)
    }

    void loadEvent()
  }, [id, user?.id])

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

    if (!title.trim() || !startTime || !locationRegion) {
      setMessage(t('editEvent.titleRequired'))
      return
    }

    if (!isAllowedExternalRegistrationUrl(externalRegistrationUrl)) {
      setMessage(t('editEvent.externalRegistrationUrlInvalid'))
      return
    }

    if (isVenueHosted && profile?.role_status !== 'venue_approved') {
      setMessage(t('editEvent.venueApprovalRequired'))
      return
    }

    setSubmitting(true)
    setMessage('')

    const publishIso = publishAt ? new Date(publishAt).toISOString() : null
    const unpublishIso = unpublishAt ? new Date(unpublishAt).toISOString() : null
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
        category,
        event_type: stringifyEventTypes(eventType),
        start_time: new Date(startTime).toISOString(),
        location_region: locationRegion,
        location_detail: locationRegion !== 'Online' ? (locationDetail.trim() || null) : null,
        is_venue_hosted: isVenueHosted,
        visibility_settings: { type: visibilityType },
        max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
        registration_deadline: registrationDeadline
          ? new Date(registrationDeadline).toISOString()
          : null,
        registration_form_config: formFields.length > 0 ? formFields : null,
        external_registration_url: externalRegistrationUrl.trim() || null,
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

  return (
    <Layout>
      <form className="card" onSubmit={submit}>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.titleLabel')}
          </span>
          <input
            aria-label={t('editEvent.titleLabel')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">{t('editEvent.externalRegistrationUrlLabel')}</span>
          <input type="url" inputMode="url" aria-label={t('editEvent.externalRegistrationUrlLabel')} placeholder={t('editEvent.externalRegistrationUrlPlaceholder')} value={externalRegistrationUrl} onChange={(event) => setExternalRegistrationUrl(event.target.value)} />
          <small>{t('editEvent.externalRegistrationUrlHint')}</small>
        </label>
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
        <label className="form-field">
          <span className="form-label-row"><Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.publishAtLabel')}</span>
          <input aria-label={t('editEvent.publishAtLabel')} type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
        </label>
        <label className="form-field">
          <span className="form-label-row"><Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.unpublishAtLabel')}</span>
          <input aria-label={t('editEvent.unpublishAtLabel')} type="datetime-local" value={unpublishAt} onChange={(event) => setUnpublishAt(event.target.value)} />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('editEvent.descriptionLabel')}
          </span>
          <textarea
            aria-label={t('editEvent.descriptionLabel')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
          <div className="tags-input-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid var(--border-color, #ccc)', borderRadius: '4px', background: 'var(--bg-primary, #fff)' }}>
            {eventType.map(type => (
              <span key={type} className="tag" style={{ background: 'var(--bg-secondary, #eee)', padding: '4px 8px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                {t(getEventTypeI18nKey(type))}
                <button 
                  type="button" 
                  onClick={() => setEventType(eventType.filter(t => t !== type))} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px', lineHeight: '1', color: 'var(--text-secondary, #666)' }}
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
            onChange={(event) => setStartTime(event.target.value)}
          />
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
        <label className="form-field">
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
        </label>
        {capacityWarning ? (
          <p className="message warning">{capacityWarning}</p>
        ) : null}
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('editEvent.registrationDeadlineLabel')}
          </span>
          <input
            aria-label={t('editEvent.registrationDeadlineLabel')}
            type="datetime-local"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </label>
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
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-eye" size={16} /> {t('editEvent.visibilityLabel')}
          </span>
          <select
            aria-label={t('editEvent.visibilityLabel')}
            value={visibilityType}
            onChange={(event) => setVisibilityType(event.target.value)}
          >
            <option value="public">{t('editEvent.public')}</option>
            <option value="connections_only">{t('editEvent.connectionsOnly')}</option>
            <option value="private">{t('editEvent.private')}</option>
          </select>
        </label>
        <RegistrationFormBuilder fields={formFields} setFields={setFormFields} />
        <button type="submit" disabled={submitting}>
          <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('editEvent.saveEvent')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
