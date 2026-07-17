import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import type { ReportItem } from '../types'

type ActionType = 'warn' | 'suspend' | 'ban' | 'role_upgrade' | 'role_revoke' | 'note'

interface ActionFormState {
  action_type: ActionType
  payload: string
}

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'warn', label: 'Warn' },
  { value: 'suspend', label: 'Suspend' },
  { value: 'ban', label: 'Ban' },
  { value: 'role_upgrade', label: 'Role Upgrade' },
  { value: 'role_revoke', label: 'Role Revoke' },
  { value: 'note', label: 'Note' },
]

const DEFAULT_FORM: ActionFormState = { action_type: 'warn', payload: '{}' }

export function AdminModerationPanel() {
  const { user, session, loading } = useAuth()
  const [reports, setReports] = useState<ReportItem[]>([])
  const [forms, setForms] = useState<Record<string, ActionFormState>>({})
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [pageMessage, setPageMessage] = useState('')
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  const isAdmin = (user?.app_metadata as Record<string, unknown> | undefined)?.role === 'admin'

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .in('status', ['open', 'triaging'])
      .order('created_at', { ascending: false })

    if (error) {
      setPageMessage(error.message)
      return
    }

    const loaded = (data as ReportItem[]) ?? []
    setReports(loaded)

    // Initialise form state for any new reports
    setForms((prev) => {
      const next = { ...prev }
      for (const r of loaded) {
        if (!next[r.id]) next[r.id] = { ...DEFAULT_FORM }
      }
      return next
    })
  }

  useEffect(() => {
    if (!loading && isAdmin) {
      void loadReports()
    }
  }, [loading, isAdmin])

  if (loading) {
    return <p>Loading...</p>
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (!isAdmin) {
    return (
      <Layout title="Admin Moderation">
        <section className="card">
          <p className="message">Access denied: admin role required.</p>
        </section>
      </Layout>
    )
  }

  const updateForm = (reportId: string, patch: Partial<ActionFormState>) => {
    setForms((prev) => ({ ...prev, [reportId]: { ...(prev[reportId] ?? DEFAULT_FORM), ...patch } }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>, report: ReportItem) => {
    event.preventDefault()
    const form = forms[report.id] ?? DEFAULT_FORM

    let parsedPayload: Record<string, unknown>
    try {
      parsedPayload = JSON.parse(form.payload) as Record<string, unknown>
    } catch {
      setMessages((prev) => ({ ...prev, [report.id]: 'Payload must be valid JSON.' }))
      return
    }

    setSubmitting((prev) => ({ ...prev, [report.id]: true }))
    setMessages((prev) => ({ ...prev, [report.id]: '' }))

    const { data, error } = await supabase.functions.invoke('admin-moderation', {
      body: {
        action_type: form.action_type,
        target_profile_id: report.target_profile_id,
        report_id: report.id,
        payload: parsedPayload,
      },
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
    })

    setSubmitting((prev) => ({ ...prev, [report.id]: false }))

    if (error) {
      setMessages((prev) => ({ ...prev, [report.id]: error.message }))
      return
    }

    const result = data as { success?: boolean; moderation_action_id?: string; error?: string }
    if (result.error) {
      setMessages((prev) => ({ ...prev, [report.id]: result.error! }))
      return
    }

    setMessages((prev) => ({
      ...prev,
      [report.id]: `Action recorded. ID: ${result.moderation_action_id ?? 'unknown'}`,
    }))

    // Refresh the list so acted-upon reports disappear when resolved
    await loadReports()
  }

  return (
    <Layout title="Admin Moderation">
      {pageMessage ? <p className="message">{pageMessage}</p> : null}
      {reports.length === 0 ? (
        <section className="card">
          <p>No open or triaging reports.</p>
        </section>
      ) : null}
      {reports.map((report) => {
        const form = forms[report.id] ?? DEFAULT_FORM
        const msg = messages[report.id]
        const isBusy = submitting[report.id] ?? false

        return (
          <section className="card" key={report.id}>
            <div>
              <span className={`status status-${report.status}`}>{report.status}</span>
              &nbsp;
              <strong>{report.category}</strong>
            </div>
            <p>
              <strong>Reporter:</strong> {report.reporter_id}
            </p>
            {report.target_profile_id ? (
              <p>
                <strong>Target:</strong> {report.target_profile_id}
              </p>
            ) : null}
            {report.target_event_id ? (
              <p>
                <strong>Event:</strong> {report.target_event_id}
              </p>
            ) : null}
            <p>
              <strong>Details:</strong> {report.details}
            </p>
            <p>
              <strong>Submitted:</strong> {new Date(report.created_at).toLocaleString()}
            </p>

            <form onSubmit={(e) => void handleSubmit(e, report)}>
              <label>
                Action
                <select
                  aria-label="Action type"
                  value={form.action_type}
                  onChange={(e) => updateForm(report.id, { action_type: e.target.value as ActionType })}
                  disabled={isBusy}
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Payload (JSON)
                <textarea
                  aria-label="Action payload"
                  value={form.payload}
                  onChange={(e) => updateForm(report.id, { payload: e.target.value })}
                  disabled={isBusy}
                  placeholder='{"reason": "..."}'
                />
              </label>
              <button type="submit" disabled={isBusy || !report.target_profile_id}>
                {isBusy ? 'Submitting…' : 'Apply Action'}
              </button>
              {!report.target_profile_id ? (
                <p className="message">No target profile — action cannot be applied.</p>
              ) : null}
            </form>

            {msg ? <p className={msg.startsWith('Action recorded') ? '' : 'message'}>{msg}</p> : null}
          </section>
        )
      })}
    </Layout>
  )
}
