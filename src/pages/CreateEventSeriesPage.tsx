import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

export function CreateEventSeriesPage() {
  const { user } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isWholeSeriesRequired, setIsWholeSeriesRequired] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

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

        <div className="form-section" aria-labelledby="series-basic-title">
          <h2 id="series-basic-title">{t('eventSeries.basicInfo')}</h2>

          <label className="form-field">
            <span>{t('eventSeries.seriesName')} *</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('eventSeries.seriesNamePlaceholder')}
              required
            />
          </label>

          <label className="form-field">
            <span>{t('eventSeries.seriesDescription')}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('eventSeries.seriesDescriptionPlaceholder')}
              rows={4}
            />
          </label>

          <label className="checkbox" style={{ marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={isWholeSeriesRequired}
              onChange={(event) => setIsWholeSeriesRequired(event.target.checked)}
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
            disabled={!title.trim() || submitting}
            onClick={() => void handleCreate()}
          >
            {submitting ? t('common.processing') : t('eventSeries.createSeries')}
          </button>
        </div>
      </div>
    </Layout>
  )
}
