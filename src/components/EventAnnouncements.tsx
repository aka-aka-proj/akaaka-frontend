import { useCallback, useEffect, useState } from 'react'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownRenderer } from './MarkdownRenderer'
import { supabase } from '../supabaseClient'
import { useT } from '../hooks/useT'
import type { EventAnnouncement } from '../types'

interface EventAnnouncementsProps {
  eventId: string
  isHost: boolean
  nativeRegistration: boolean
  isAuthenticated: boolean
}

type PublishMode = 'draft' | 'scheduled' | 'now'

const invalidMarkdown = /<[^>]+>|!\[[^]]*\]\([^)]*\)|\[[^]]+\]\([^)]*\)|https?:\/\/|www\./i

function localDateTimeToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isoToLocalDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export function EventAnnouncements({ eventId, isHost, nativeRegistration, isAuthenticated }: EventAnnouncementsProps) {
  const { t } = useT()
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [publishMode, setPublishMode] = useState<PublishMode>('draft')
  const [publishAt, setPublishAt] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openForm, setOpenForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('event_announcements')
      .select('id, event_id, title, body_markdown, status, publish_at, published_at, created_at, updated_at')
      .eq('event_id', eventId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) {
      setLoadError(true)
      return
    }
    setLoadError(false)
    setAnnouncements((data ?? []) as EventAnnouncement[])
  }, [eventId])

  useEffect(() => {
    if (nativeRegistration && isAuthenticated) void load()
  }, [load, nativeRegistration, isAuthenticated])

  const resetForm = () => {
    setTitle('')
    setBody('')
    setPublishMode('draft')
    setPublishAt('')
    setEditingId(null)
    setOpenForm(false)
  }

  const startNew = () => {
    setTitle('')
    setBody('')
    setPublishMode('draft')
    setPublishAt('')
    setEditingId(null)
    setMessage('')
    setOpenForm(true)
  }

  const edit = (announcement: EventAnnouncement) => {
    setEditingId(announcement.id)
    setTitle(announcement.title)
    setBody(announcement.body_markdown)
    setPublishMode(announcement.status === 'scheduled' ? 'scheduled' : 'draft')
    setPublishAt(isoToLocalDateTime(announcement.publish_at))
    setMessage('')
    setOpenForm(true)
  }

  const validate = (): string | null => {
    const titleLength = Array.from(title.trim()).length
    const bodyLength = Array.from(body).length
    if (titleLength < 1 || titleLength > 50) return t('eventAnnouncements.titleLengthError')
    if (bodyLength < 1 || bodyLength > 1000 || !body.trim()) return t('eventAnnouncements.bodyLengthError')
    if (invalidMarkdown.test(body)) return t('eventAnnouncements.markdownError')
    if (publishMode === 'scheduled' && !localDateTimeToIso(publishAt)) return t('eventAnnouncements.scheduleRequired')
    return null
  }

  const save = async () => {
    if (!isHost || !nativeRegistration || busy) return
    const validationError = validate()
    if (validationError) {
      setMessage(validationError)
      return
    }
    setBusy(true)
    setMessage('')
    const scheduledAt = publishMode === 'scheduled' ? localDateTimeToIso(publishAt) : null
    let error: { message: string } | null = null
    if (editingId && publishMode === 'now') {
      // Spec 007 forbids the two-call path here: edit + publish-now is one
      // atomic RPC so a failure never downgrades a scheduled row to a draft.
      const { error: atomicError } = await supabase.rpc('update_and_publish_announcement', {
        p_announcement_id: editingId,
        p_title: title.trim(),
        p_body_markdown: body,
      })
      error = atomicError
    } else if (editingId) {
      const { error: updateError } = await supabase.rpc('update_event_announcement', {
        p_announcement_id: editingId,
        p_title: title.trim(),
        p_body_markdown: body,
        p_status: publishMode === 'scheduled' ? 'scheduled' : 'draft',
        p_publish_at: scheduledAt,
      })
      error = updateError
    } else {
      const { error: createError } = await supabase.rpc('create_event_announcement', {
        p_event_id: eventId,
        p_title: title.trim(),
        p_body_markdown: body,
        p_publish_at: scheduledAt,
        p_publish_now: publishMode === 'now',
      })
      error = createError
    }
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    resetForm()
    await load()
  }

  const publish = async (announcement: EventAnnouncement) => {
    if (!isHost || busy) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('publish_event_announcement', { p_announcement_id: announcement.id })
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    await load()
  }

  // RLS limits `event_announcements` reads to authenticated users, so a logged-out
  // visitor can never read them; hide the block instead of showing a misleading
  // "load failed" error for a permission-based condition.
  if (!nativeRegistration || !isAuthenticated) return null

  return (
    <section className="card event-announcements-section" aria-labelledby="event-announcements-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">{t('eventAnnouncements.eyebrow')}</p>
          <h3 id="event-announcements-title">{t('eventAnnouncements.title')}</h3>
        </div>
        {isHost && !loadError && announcements.length < 5 ? (
          <button type="button" className="secondary-action" onClick={startNew}>
            {t('eventAnnouncements.newAnnouncement')}
          </button>
        ) : null}
      </div>
      {isHost ? <p className="form-hint">{t('eventAnnouncements.limits')}</p> : null}
      {message ? <p className="error-message" role="alert">{message}</p> : null}
      {loadError ? (
        <p className="error-message" role="alert">
          {t('eventAnnouncements.loadError')}{' '}
          <button type="button" className="secondary-action" onClick={() => void load()}>
            {t('eventAnnouncements.retry')}
          </button>
        </p>
      ) : null}
      {isHost && openForm ? (
        <div className="event-announcement-editor card">
          <label className="form-field">
            <span>{t('eventAnnouncements.headline')} ({Array.from(title).length}/50)</span>
            <input value={title} maxLength={50} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="form-field">
            <span>{t('eventAnnouncements.body')} ({Array.from(body).length}/1000)</span>
            <MarkdownEditor key={editingId ?? 'new'} value={body} onChange={setBody} allowLinks={false} aria-label={t('eventAnnouncements.body')} />
          </div>
          <label className="form-field">
            <span>{t('eventAnnouncements.publishMode')}</span>
            <select value={publishMode} onChange={(event) => setPublishMode(event.target.value as PublishMode)}>
              <option value="draft">{t('eventAnnouncements.saveDraft')}</option>
              <option value="scheduled">{t('eventAnnouncements.schedule')}</option>
              <option value="now">{t('eventAnnouncements.publishNow')}</option>
            </select>
          </label>
          {publishMode === 'scheduled' ? (
            <label className="form-field">
              <span>{t('eventAnnouncements.publishAt')}</span>
              <input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
            </label>
          ) : null}
          <div className="discussion-form-actions">
            <button type="button" className="secondary-action" onClick={resetForm}>{t('common.cancelReply')}</button>
            <button type="button" className="primary-cta" disabled={busy} onClick={() => void save()}>
              {busy ? t('common.loading') : editingId ? t('eventAnnouncements.saveChanges') : t('eventAnnouncements.save')}
            </button>
          </div>
        </div>
      ) : null}
      {!loadError && announcements.length === 0 ? <p className="empty-state">{t('eventAnnouncements.empty')}</p> : null}
      <div className="event-announcement-list">
        {announcements.map((announcement) => (
          <article key={announcement.id} className="event-announcement-card">
            <div className="section-heading-row">
              <div>
                <h4>{announcement.title}</h4>
                <time dateTime={announcement.published_at ?? announcement.created_at}>
                  {announcement.status === 'published'
                    ? new Date(announcement.published_at ?? announcement.created_at).toLocaleString()
                    : t(`eventAnnouncements.status.${announcement.status}` as 'eventAnnouncements.status.draft')}
                </time>
              </div>
              {isHost && announcement.status !== 'published' ? (
                <div className="event-admin-actions">
                  <button type="button" className="secondary-action" onClick={() => edit(announcement)}>{t('eventAnnouncements.edit')}</button>
                  <button type="button" className="primary-cta" disabled={busy} onClick={() => void publish(announcement)}>{t('eventAnnouncements.publishNow')}</button>
                </div>
              ) : null}
            </div>
            <MarkdownRenderer content={announcement.body_markdown} allowLinks={false} />
          </article>
        ))}
      </div>
    </section>
  )
}
