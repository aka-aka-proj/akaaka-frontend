import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { ReportForm } from '../components/ReportForm'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { EventItem, EventThread } from '../types'

export function EventDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useT()
  const [eventItem, setEventItem] = useState<EventItem | null>(null)
  const [threads, setThreads] = useState<EventThread[]>([])
  const [content, setContent] = useState('')
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !blockedUserIds.includes(thread.profile_id)),
    [threads, blockedUserIds],
  )

  const load = async () => {
    if (!id) {
      return
    }

    const [{ data: eventData, error: eventError }, { data: threadData, error: threadError }] =
      await Promise.all([
        supabase.from('events').select('*, creator:profiles(display_name)').eq('id', id).maybeSingle(),
        supabase
          .from('event_threads')
          .select('*, profile:profiles(display_name)')
          .eq('event_id', id)
          .order('created_at', { ascending: true }),
      ])

    if (eventError || threadError) {
      setMessage(eventError?.message ?? threadError?.message ?? t('eventDetail.unableToLoad'))
      return
    }

    setEventItem((eventData as EventItem | null) ?? null)
    setThreads((threadData as EventThread[]) ?? [])

    if (user) {
      const { data: blocksData, error: blocksError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)

      if (blocksError) {
        setMessage(blocksError.message)
      } else {
        setBlockedUserIds(((blocksData as { blocked_id: string }[] | null) ?? []).map((item) => item.blocked_id))
      }
    }
  }

  useEffect(() => {
    void load()
  }, [id, user?.id])

  const postThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !user || !content.trim()) {
      return
    }

    const { error } = await supabase.from('event_threads').insert([
      {
        event_id: id,
        profile_id: user.id,
        content: content.trim(),
        parent_id: replyParentId,
      },
    ])

    if (error) {
      setMessage(error.message)
      return
    }

    setContent('')
    setReplyParentId(null)
    await load()
  }

  return (
    <Layout title={t('eventDetail.title')}>
      <section className="card">
        {eventItem ? (
          <>
            <h2>{eventItem.title}</h2>
            <p>{eventItem.description ?? t('eventDetail.noDescription')}</p>
            <p className="event-meta">
              <img src="/default-avatar.svg" alt="" width={24} height={24} className="avatar avatar-sm" />
              {t('eventDetail.createdBy')} <Link to={`/profile/${eventItem.creator_id}`}>{eventItem.creator?.display_name || eventItem.creator_id}</Link>
            </p>
            <p><Icon href="/form-icons.svg" name="form-calendar" size={14} /> {new Date(eventItem.start_time).toLocaleString()}</p>
          </>
        ) : (
          <p>{t('eventDetail.notFound')}</p>
        )}
        {message ? <p className="message">{message}</p> : null}
      </section>

      <section className="card">
        <h3>{t('eventDetail.discussion')}</h3>
        <form onSubmit={postThread}>
          <textarea
            aria-label={t('eventDetail.discussion')}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={replyParentId ? t('eventDetail.replyingTo', { id: replyParentId }) : t('eventDetail.postComment')}
          />
          <button type="submit"><Icon href="/action-icons.svg" name="action-reply" size={16} /> {t('eventDetail.post')}</button>
          {replyParentId ? (
            <button type="button" onClick={() => setReplyParentId(null)}>
              {t('common.cancelReply')}
            </button>
          ) : null}
        </form>
        {visibleThreads.length === 0 ? (
          <div className="empty-state">
            <img src="/illustration-empty-discussion.svg" alt="" width={480} height={280} className="illustration" />
            <p>{t('eventDetail.postComment')}</p>
          </div>
        ) : (
          <ul>
            {visibleThreads.map((thread) => (
              <li key={thread.id} className="thread-item">
                <div className="thread-header">
                  <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                  <div>
                    <p>{thread.content}</p>
                    <small>
                      <Link to={`/profile/${thread.profile_id}`}>{thread.profile?.display_name || thread.profile_id}</Link>{' '}
                      {thread.parent_id ? t('eventDetail.replyTo', { id: thread.parent_id }) : ''}
                    </small>
                  </div>
                </div>
                <div>
                  <button type="button" onClick={() => setReplyParentId(thread.id)}>
                    <Icon href="/action-icons.svg" name="action-reply" size={14} /> {t('eventDetail.reply')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {id ? <ReportForm targetEventId={id} /> : null}
    </Layout>
  )
}
