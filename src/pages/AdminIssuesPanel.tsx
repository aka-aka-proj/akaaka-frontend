import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { AdminIssueItem } from '../types'

const STATUS_OPTIONS = ['in_progress', 'resolved', 'closed'] as const

export function AdminIssuesPanel() {
  const { user, loading } = useAuth()
  const { t } = useT()
  const [issues, setIssues] = useState<AdminIssueItem[]>([])
  const [pageMessage, setPageMessage] = useState('')
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  const isAdmin = user?.app_metadata?.role === 'admin'

  const loadIssues = async () => {
    const { data, error } = await supabase.functions.invoke('list-all-issues')

    if (error) {
      setPageMessage(error.message)
      return
    }

    const result = data as { issues?: AdminIssueItem[] }
    setIssues(result.issues ?? [])
  }

  useEffect(() => {
    if (!loading && isAdmin) {
      void loadIssues()
    }
  }, [loading, isAdmin])

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    setSubmitting((prev) => ({ ...prev, [issueId]: true }))
    setActionMessages((prev) => ({ ...prev, [issueId]: '' }))

    const { data, error } = await supabase.functions.invoke('update-issue-status', {
      body: { issue_id: issueId, status: newStatus },
    })

    setSubmitting((prev) => ({ ...prev, [issueId]: false }))

    if (error) {
      setActionMessages((prev) => ({ ...prev, [issueId]: error.message }))
      return
    }

    setActionMessages((prev) => ({
      ...prev,
      [issueId]: t('admin.issues.statusUpdated', { status: newStatus }),
    }))

    await loadIssues()
  }

  if (loading) {
    return <main className="page" role="main"><p>{t('common.loading')}</p></main>
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (!isAdmin) {
    return (
      <Layout>
        <section className="card">
          <p className="message">{t('admin.moderation.accessDenied')}</p>
        </section>
      </Layout>
    )
  }

  return (
    <Layout>
      <section className="card">
        <div className="row">
          <h3>{t('admin.issues.title')}</h3>
          <span className="chip">{issues.length} {t('admin.issues.total')}</span>
        </div>
        {pageMessage ? <p className="message">{pageMessage}</p> : null}
      </section>

      {issues.length === 0 ? (
        <section className="card">
          <p>{t('admin.issues.noIssues')}</p>
        </section>
      ) : (
        issues.map((issue) => {
          const msg = actionMessages[issue.id]
          const isBusy = submitting[issue.id] ?? false

          return (
            <section className="card" key={issue.id}>
              <div className="row">
                <h4>{issue.title}</h4>
                <span className={`status status-${issue.status}`}>
                  {t(`issues.status${issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}` as any)}
                </span>
              </div>
              <p className="event-meta">
                <strong>{t('admin.issues.reportedBy')}:</strong>{' '}
                <Link to={`/profile/${issue.reporter_id}`}>{issue.reporter_id}</Link>
                {' | '}
                <strong>{t('admin.issues.reportedAt')}:</strong>{' '}
                {new Date(issue.created_at).toLocaleString()}
                {issue.updated_at !== issue.created_at ? (
                  <> | <strong>{t('admin.issues.updatedAt')}:</strong> {new Date(issue.updated_at).toLocaleString()}</>
                ) : null}
              </p>
              <p>
                <Link to={`/issues/${issue.id}`} className="secondary-action">
                  {t('admin.issues.viewDetails')}
                </Link>
              </p>

              {issue.status === 'open' || issue.status === 'in_progress' ? (
                <div className="admin-issue-actions">
                  {STATUS_OPTIONS.map((status) => {
                    if (status === issue.status) return null
                    // Skip in_progress if already open
                    if (issue.status === 'open' && status === 'in_progress') {
                      return (
                        <button
                          key={status}
                          type="button"
                          className="secondary-action"
                          disabled={isBusy}
                          onClick={() => void handleStatusChange(issue.id, status)}
                        >
                          {isBusy ? t('common.loading') : t(`admin.issues.markAs${status.charAt(0).toUpperCase() + status.slice(1)}` as any)}
                        </button>
                      )
                    }
                    return (
                      <button
                        key={status}
                        type="button"
                        className={status === 'resolved' || status === 'closed' ? 'primary-cta' : 'secondary-action'}
                        disabled={isBusy}
                        onClick={() => void handleStatusChange(issue.id, status)}
                      >
                        {isBusy ? t('common.loading') : t(`admin.issues.markAs${status.charAt(0).toUpperCase() + status.slice(1)}` as any)}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <span className="chip chip-neutral">{t('admin.issues.closedIssue')}</span>
              )}

              {msg ? <p className={msg.startsWith('Error') ? 'message' : ''}>{msg}</p> : null}
            </section>
          )
        })
      )}
    </Layout>
  )
}