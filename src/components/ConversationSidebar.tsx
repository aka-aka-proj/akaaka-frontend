import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { getAvatarPath } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { DirectConversation, DirectMessage, Profile } from '../types'
import { getProfilesForViewer } from '../lib/profile-access'

interface ConversationSidebarProps {
  activeConversationId?: string
}

export function ConversationSidebar({ activeConversationId }: ConversationSidebarProps) {
  const { user } = useAuth()
  const { t } = useT()
  const [conversations, setConversations] = useState<DirectConversation[]>([])
  const [query, setQuery] = useState('')
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
      const [{ data: profiles, error: profilesError }, { data: messages }] = await Promise.all([
        otherIds.length ? getProfilesForViewer(otherIds) : Promise.resolve({ data: [], error: null }),
        rows.length ? supabase.from('direct_messages').select('*').in('conversation_id', rows.map((row) => row.id)).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ])
      if (profilesError) {
        if (!cancelled) setError(profilesError.message)
        setLoading(false)
        return
      }
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

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return conversations
    return conversations.filter((conversation) => {
      const profile = conversation.other_profile
      return `${profile?.display_name ?? ''} ${profile?.id ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
    })
  }, [conversations, query])

  const formatListTime = (createdAt?: string) => createdAt
    ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(createdAt))
    : ''

  return (
    <aside className="conversation-sidebar" aria-label={t('messages.title')}>
      <div className="conversation-sidebar-header">
        <div className="conversation-sidebar-title-row">
          <h2>{t('messages.title')}</h2>
          <Link to="/messages/new" className="conversation-new-button" aria-label={t('messages.startConversation')}>＋</Link>
        </div>
        <label className="conversation-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('messages.searchPlaceholder')} aria-label={t('messages.searchLabel')} />
        </label>
      </div>
      {error ? <p className="message conversation-sidebar-error">{error}</p> : null}
      {loading ? <p className="conversation-sidebar-state">{t('common.loading')}</p> : filteredConversations.length === 0 ? (
        <div className="conversation-sidebar-state">
          <p>{query ? t('messages.noSearchResults') : t('messages.empty')}</p>
          {!query ? <Link to="/messages/new" className="primary-action">{t('messages.startConversation')}</Link> : null}
        </div>
      ) : (
        <ul className="conversation-sidebar-list">
          {filteredConversations.map((conversation) => {
            const profile = conversation.other_profile
            const displayName = profile?.display_name || t('messages.unnamed')
            const lastMessage = conversation.latest_message
            return (
              <li key={conversation.id} className={`conversation-sidebar-item${conversation.id === activeConversationId ? ' active' : ''}`}>
                <Link to={`/messages/${conversation.id}`} className="conversation-sidebar-chat-link">
                  <img src={getAvatarPath(profile)} alt="" className="conversation-avatar" />
                  <span className="conversation-sidebar-copy">
                    <strong>{displayName}</strong>
                    <span>{lastMessage?.sender_id === user?.id ? `${t('messages.you')}: ` : ''}{lastMessage?.content || t('messages.noMessages')}</span>
                  </span>
                  <time dateTime={lastMessage?.created_at || conversation.created_at}>{formatListTime(lastMessage?.created_at || conversation.created_at)}</time>
                </Link>
                {profile?.id ? <Link to={`/profile/${profile.id}`} className="conversation-sidebar-profile-link">{t('messages.viewProfile')}</Link> : null}
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
