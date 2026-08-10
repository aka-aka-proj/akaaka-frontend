import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { DirectConversation, DirectMessage, Profile } from '../types'

export function MessagesPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [conversations, setConversations] = useState<DirectConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user) return
      setLoading(true)
      const { data, error: conversationError } = await supabase
        .from('direct_conversations')
        .select('id, participant_one_id, participant_two_id, created_at')
        .order('created_at', { ascending: false })
      if (conversationError) {
        if (!cancelled) setError(conversationError.message)
        setLoading(false)
        return
      }
      const rows = (data ?? []) as DirectConversation[]
      const otherIds = rows.map((row) => row.participant_one_id === user.id ? row.participant_two_id : row.participant_one_id)
      const [{ data: profiles }, { data: messages }] = await Promise.all([
        otherIds.length ? supabase.from('profiles').select('id, display_name, metadata').in('id', otherIds) : Promise.resolve({ data: [], error: null }),
        rows.length ? supabase.from('direct_messages').select('*').in('conversation_id', rows.map((row) => row.id)).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ])
      const profileMap = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]))
      const latestMap = new Map<string, DirectMessage>()
      for (const message of (messages ?? []) as DirectMessage[]) {
        if (!latestMap.has(message.conversation_id)) latestMap.set(message.conversation_id, message)
      }
      if (!cancelled) {
        setConversations(rows.map((row) => ({
          ...row,
          other_profile: profileMap.get(row.participant_one_id === user.id ? row.participant_two_id : row.participant_one_id) ?? null,
          latest_message: latestMap.get(row.id) ?? null,
        })).sort((a, b) => (b.latest_message?.created_at ?? b.created_at).localeCompare(a.latest_message?.created_at ?? a.created_at)))
        setError('')
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  return <Layout>
    <section className="card messages-page">
      <h2>{t('messages.title')}</h2>
      <p>{t('messages.description')}</p>
      {error ? <p className="message">{error}</p> : null}
      {loading ? <p>{t('common.loading')}</p> : conversations.length === 0 ? <p>{t('messages.empty')}</p> : (
        <ul className="conversation-list">
          {conversations.map((conversation) => <li key={conversation.id} className="conversation-item">
            <Link to={`/messages/${conversation.id}`}>
              <strong>{conversation.other_profile?.display_name || t('messages.unnamed')}</strong>
              <span>{conversation.latest_message?.content || t('messages.noMessages')}</span>
            </Link>
          </li>)}
        </ul>
      )}
    </section>
  </Layout>
}
