import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

interface IssueComment {
  id: string
  content: string
  created_at: string
  profile_id: string
}

interface IssueDetail {
  id: string
  title: string
  description: string
  log_url: string | null
  status: string
  created_at: string
  reporter_id: string
  comments: IssueComment[]
}

export function IssueDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useT()
  const [issue, setIssue] = useState<IssueDetail | null>(null)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState('')

  const loadIssue = async () => {
    if (!id) {
      return
    }

    const { data: issueData, error: issueError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (issueError) {
      setMessage(issueError.message)
      return
    }

    if (!issueData) {
      setMessage(t('issues.notFound'))
      return
    }

    const { data: commentsData } = await supabase
      .from('issue_comments')
      .select('*')
      .eq('issue_id', id)
      .order('created_at', { ascending: true })

    setIssue({
      ...(issueData as Omit<IssueDetail, 'comments'>),
      comments: (commentsData as IssueComment[]) ?? [],
    })
  }

  useEffect(() => {
    void loadIssue()
  }, [id, user?.id])

  const postComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !user || !comment.trim()) {
      return
    }

    const { error } = await supabase.functions.invoke('add-issue-comment', {
      body: { issue_id: id, content: comment.trim() },
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setComment('')
    await loadIssue()
  }

  return (
    <Layout>
      <section className="card">
        {issue ? (
          <>
            <h2>{issue.title}</h2>
            <span className={`status status-${issue.status}`}>{t(`issues.status${issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}` as any)}</span>
            <p>{issue.description}</p>
            {issue.log_url ? (
              <p>
                <Icon href="/nav-icons.svg" name="nav-reports" size={14} />{' '}
                <a href={issue.log_url} target="_blank" rel="noopener noreferrer">{t('issues.viewLogs')}</a>
              </p>
            ) : null}
            <small>{new Date(issue.created_at).toLocaleString()}</small>
          </>
        ) : (
          <p>{message || t('common.loading')}</p>
        )}
      </section>

      {issue ? (
        <section className="card">
          <h3>{t('issues.comments')}</h3>
          {issue.comments.length === 0 ? (
            <div className="empty-state">
              <p>{t('issues.noComments')}</p>
            </div>
          ) : (
            <ul>
              {issue.comments.map((c) => (
                <li key={c.id} className="thread-item">
                  <div className="thread-header">
                    <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                    <div>
                      <p>{c.content}</p>
                      <small>{c.profile_id} — {new Date(c.created_at).toLocaleString()}</small>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {issue.status !== 'closed' ? (
            <form onSubmit={postComment}>
              <div className="form-field">
                <span>
                  {t('issues.commentLabel')}{' '}
                  <PrivacyDisclosure label={t('privacyDisclosure.label')} description={t('privacyDisclosure.issueDetails')} learnMore={t('privacyDisclosure.learnMore')} />
                </span>
                <label htmlFor="issue-comment" className="sr-only">{t('issues.commentLabel')}</label>
              <textarea
                id="issue-comment"
                aria-label={t('issues.commentLabel')}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={t('issues.commentPlaceholder')}
              />
              </div>
              <button type="submit">
                <Icon href="/action-icons.svg" name="action-reply" size={16} /> {t('issues.postComment')}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {message && issue ? <p className="message">{message}</p> : null}
    </Layout>
  )
}
