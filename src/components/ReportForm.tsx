import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

interface ReportFormProps {
  targetProfileId?: string
  targetEventId?: string
}

const REPORT_CATEGORIES = ['harassment', 'impersonation', 'spam', 'safety_risk', 'other'] as const

export function ReportForm({ targetProfileId, targetEventId }: ReportFormProps) {
  const { user } = useAuth()
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setMessage('Please sign in to submit a report.')
      return
    }

    if (!category || details.trim().length === 0) {
      setMessage('Category and details are required.')
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
    setMessage('Report submitted successfully.')
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Report</h3>
      <label>
        Category
        <select
          aria-label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">Select category</option>
          {REPORT_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Details
        <textarea
          aria-label="Details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Describe what happened"
        />
      </label>
      <button type="submit" disabled={submitting}>
        Submit report
      </button>
      {message ? <p className="message">{message}</p> : null}
    </form>
  )
}
