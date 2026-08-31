import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

interface IssueSummary {
  id: string
  title: string
  status: string
  created_at: string
  log_url: string | null
}

export function IssuesPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [issues, setIssues] = useState<IssueSummary[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadIssues = async () => {
      if (!user) {
        return
      }

      const { data, error } = await supabase.functions.invoke('list-my-issues')

      if (error) {
        setMessage(error.message)
        return
      }

      setIssues(data.issues ?? [])
    }

    void loadIssues()
  }, [user])

  return (
    <Layout>
      <section className="card">
        <div className="row">
          <h3>{t('issues.myIssues')}</h3>
          <Link to="/issues/new">
            <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('issues.reportIssue')}
          </Link>
        </div>
        {message ? <p className="message">{message}</p> : null}
        {issues.length === 0 ? (
          <div className="empty-state">
            <p>{t('issues.noIssues')}</p>
          </div>
        ) : (
          <ul>
            {issues.map((issue) => (
              <li key={issue.id}>
                <Link to={`/issues/${issue.id}`}>
                  <h4>{issue.title}</h4>
                  <span className={`status status-${issue.status}`}>{t(`issues.status${issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}`)}</span>
                  <small>{new Date(issue.created_at).toLocaleDateString()}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  )
}
