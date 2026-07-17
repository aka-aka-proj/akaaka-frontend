import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

export function ReportIssuePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useT()
  const [title, setTitle] = useState(searchParams.get('title') ?? '')
  const [description, setDescription] = useState(searchParams.get('description') ?? '')
  const [logUrl, setLogUrl] = useState(searchParams.get('log_url') ?? '')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setMessage(t('issues.signInRequired'))
      return
    }

    if (!title.trim() || !description.trim()) {
      setMessage(t('issues.titleAndDescriptionRequired'))
      return
    }

    setSubmitting(true)
    const { error } = await supabase.functions.invoke('create-issue', {
      body: {
        title: title.trim(),
        description: description.trim(),
        log_url: logUrl.trim() || undefined,
      },
    })
    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    navigate('/issues', { replace: true })
  }

  return (
    <Layout title={t('issues.reportIssue')}>
      <form className="card" onSubmit={submit}>
        <h3>{t('issues.reportIssue')}</h3>
        <label>
          {t('issues.titleLabel')}
          <input
            aria-label={t('issues.titleLabel')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {t('issues.descriptionLabel')}
          <textarea
            aria-label={t('issues.descriptionLabel')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          {t('issues.logUrlLabel')}
          <input
            aria-label={t('issues.logUrlLabel')}
            value={logUrl}
            placeholder="https://..."
            onChange={(event) => setLogUrl(event.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {t('issues.submitIssue')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
