import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { ReportForm } from '../components/ReportForm'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import type { EventItem, EventThread } from '../types'

export function EventDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
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
        supabase.from('events').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('event_threads')
          .select('*')
          .eq('event_id', id)
          .order('created_at', { ascending: true }),
      ])

    if (eventError || threadError) {
      setMessage(eventError?.message ?? threadError?.message ?? 'Unable to load event.')
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
    <Layout title="Event Detail">
      <section className="card">
        {eventItem ? (
          <>
            <h2>{eventItem.title}</h2>
            <p>{eventItem.description ?? 'No description'}</p>
            <p>Created by: <Link to={`/profile/${eventItem.creator_id}`}>{eventItem.creator_id}</Link></p>
            <p>{new Date(eventItem.start_time).toLocaleString()}</p>
          </>
        ) : (
          <p>Event not found.</p>
        )}
        {message ? <p className="message">{message}</p> : null}
      </section>

      <section className="card">
        <h3>Discussion</h3>
        <form onSubmit={postThread}>
          <textarea
            aria-label="Thread content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={replyParentId ? `Replying to ${replyParentId}` : 'Post a comment'}
          />
          <button type="submit">Post</button>
          {replyParentId ? (
            <button type="button" onClick={() => setReplyParentId(null)}>
              Cancel reply
            </button>
          ) : null}
        </form>
        <ul>
          {visibleThreads.map((thread) => (
            <li key={thread.id}>
              <p>{thread.content}</p>
              <small>
                <Link to={`/profile/${thread.profile_id}`}>{thread.profile_id}</Link>{' '}
                {thread.parent_id ? `(reply to ${thread.parent_id})` : ''}
              </small>
              <div>
                <button type="button" onClick={() => setReplyParentId(thread.id)}>
                  Reply
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {id ? <ReportForm targetEventId={id} /> : null}
    </Layout>
  )
}
