import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { SeriesDraftNotice } from '../components/SeriesDraftNotice'
import { useSeriesDraftRecovery } from '../hooks/useSeriesDraftRecovery'
import type { SeriesDraftFields } from '../lib/series-draft-storage'
import { supabase } from '../supabaseClient'

export function CreateEventSeriesPage() {
  const { user } = useAuth()
  return user ? <CreateSeriesForm key={user.id} /> : null
}
function CreateSeriesForm() {
  const { user } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isWholeSeriesRequired, setIsWholeSeriesRequired] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const dirty = Boolean(title || description || isWholeSeriesRequired)
  const recovery = useSeriesDraftRecovery(`${user!.id}:new`, dirty)
  const changeFields = (fields: SeriesDraftFields) => {
    setTitle(fields.title); setDescription(fields.description); setIsWholeSeriesRequired(fields.isWholeSeriesRequired)
    recovery.persist(fields)
  }


  const handleCreate = async () => {
    if (!user || !title.trim()) return
    setSubmitting(true)
    setMessage('')

    const { data, error } = await supabase
      .from('event_series')
      .insert({
        creator_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        is_whole_series_required: isWholeSeriesRequired,
        lifecycle_status: 'draft',
      })
      .select('id')
      .single()

    setSubmitting(false)
    if (error || !data) {
      setMessage(error?.message ?? t('eventSeries.createFailed'))
      return
    }

    recovery.saved()
    navigate(`/events/series/${data.id}/manage`)
  }

  return (
    <Layout>
      <div className="card">
        <div className="create-event-header">
          <div>
            <h1>{t('eventSeries.createSeriesTitle')}</h1>
            <p>{t('eventSeries.createSeriesIntro')}</p>
          </div>
        </div>

        <SeriesDraftNotice recovery={recovery} dirty={dirty} saving={submitting} onRestore={() => {
          const fields = recovery.restore(); if (fields) changeFields(fields)
        }} />
        <div className="form-section" aria-labelledby="series-basic-title">
          <h2 id="series-basic-title">{t('eventSeries.basicInfo')}</h2>

          <label className="form-field">
            <span>{t('eventSeries.seriesName')} *</span>
            <input
              value={title}
              disabled={submitting || Boolean(recovery.pending)}
              onChange={(event) => changeFields({ title: event.target.value, description, isWholeSeriesRequired })}
              placeholder={t('eventSeries.seriesNamePlaceholder')}
              required
            />
          </label>

          <label className="form-field">
            <span>{t('eventSeries.seriesDescription')}</span>
            <textarea
              value={description}
              disabled={submitting || Boolean(recovery.pending)}
              onChange={(event) => changeFields({ title, description: event.target.value, isWholeSeriesRequired })}
              placeholder={t('eventSeries.seriesDescriptionPlaceholder')}
              rows={4}
            />
          </label>

          <label className="checkbox" style={{ marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={isWholeSeriesRequired}
              disabled={submitting || Boolean(recovery.pending)}
              onChange={(event) => changeFields({ title, description, isWholeSeriesRequired: event.target.checked })}
            />
            <div>
              <strong>{t('eventSeries.requiredBadge')}</strong>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                {t('eventSeries.wholeSeriesHint')}
              </p>
            </div>
          </label>
        </div>

        {message ? <p className="message" role="alert">{message}</p> : null}

        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="secondary-action" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="primary-cta"
            disabled={!title.trim() || submitting || Boolean(recovery.pending)}
            onClick={() => void handleCreate()}
          >
            {submitting ? t('common.processing') : t('eventSeries.createSeries')}
          </button>
        </div>
      </div>
    </Layout>
  )
}
