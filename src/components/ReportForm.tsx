import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from './Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

interface ReportFormProps {
  targetProfileId?: string
  targetEventId?: string
  collapsible?: boolean
}

const REPORT_CATEGORIES = ['harassment', 'impersonation', 'spam', 'safety_risk', 'other'] as const

const CATEGORY_KEYS = ['harassment', 'impersonation', 'spam', 'safetyRisk', 'other'] as const

export function ReportForm({ targetProfileId, targetEventId, collapsible = false }: ReportFormProps) {
  const { user } = useAuth()
  const { t } = useT()
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(!collapsible)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setMessage(t('report.signInRequired'))
      return
    }

    if (!category || details.trim().length === 0) {
      setMessage(t('report.categoryRequired'))
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('reports').insert([
      {
        reporter_id: user.id,
        target_profile_id: targetProfileId ?? null,
        target_event_id: targetEventId ?? null,
        category,
        details: details.trim(),
      },
    ])
    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setCategory('')
    setDetails('')
    setMessage(t('report.submittedSuccess'))
  }

  const form = (
    <form className="card report-form" onSubmit={submit}>
      <h3><Icon href="/report-icons.svg" name="report-safety-risk" size={20} /> {t('report.title')}</h3>
      <label>
        {t('report.categoryLabel')}
        <select
          aria-label={t('report.categoryLabel')}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">{t('report.selectCategory')}</option>
          {REPORT_CATEGORIES.map((item, index) => (
            <option key={item} value={item}>
              {t(`report.${CATEGORY_KEYS[index]}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('report.detailsLabel')}
        <textarea
          aria-label={t('report.detailsLabel')}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder={t('report.detailsPlaceholder')}
        />
      </label>
      <button type="submit" disabled={submitting}>
        <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('report.submitReport')}
      </button>
      {message ? <p className="message">{message}</p> : null}
    </form>
  )

  if (!collapsible) return form

  return (
    <section className="report-collapsible">
      <button
        type="button"
        className="report-collapsible-trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Icon href="/report-icons.svg" name="report-safety-risk" size={18} />
        {t('report.reportProfile')}
        <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen ? form : null}
    </section>
  )
}
