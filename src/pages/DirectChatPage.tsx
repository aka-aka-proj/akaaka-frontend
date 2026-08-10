import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { DirectMessage, Profile } from '../types'

export function DirectChatPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const targetUserId = searchParams.get('user')
  const { user } = useAuth()
  const { t } = useT()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    if (!conversationId && targetUserId) {
      void supabase.rpc('create_direct_conversation', { p_other_profile_id: targetUserId }).then(({ data, error: rpcError }) => {
        if (cancelled) return
        if (rpcError || !data) {
          setError(rpcError?.message ?? t('messages.unavailable'))
          setLoading(false)
          return
        }
        const createdId = (data as { id: string }[])[0]?.id
        if (createdId) navigate(`/messages/${createdId}`, { replace: true })
      })
      return () => { cancelled = true }
    }
    if (!conversationId) return () => { cancelled = true }
    const load = async () => {
      const { data: conversation, error: conversationError } = await supabase.from('direct_conversations').select('*').eq('id', conversationId).maybeSingle()
      if (conversationError || !conversation) {
        if (!cancelled) setError(conversationError?.message ?? t('messages.unavailable'))
        setLoading(false)
        return
      }
      const otherId = conversation.participant_one_id === user.id ? conversation.participant_two_id : conversation.participant_one_id
      const [{ data: profile }, { data: rows, error: messageError }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, metadata').eq('id', otherId).maybeSingle(),
        supabase.from('direct_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
      ])
      if (!cancelled) {
        setOtherProfile((profile as Profile | null) ?? null)
        setMessages((rows ?? []) as DirectMessage[])
        setError(messageError?.message ?? '')
        setLoading(false)
      }
    }
    void load()
    const channel = supabase.channel(`direct-conversation:${conversationId}`, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        const incoming = payload.new as DirectMessage
        const { data } = await supabase.from('direct_messages').select('*').eq('id', incoming.id).maybeSingle()
        if (data && !cancelled) setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as DirectMessage])
      })
      .subscribe((status) => { if (status === 'CHANNEL_ERROR' && !cancelled) setError(t('messages.realtimeError')) })
    return () => { cancelled = true; void supabase.removeChannel(channel) }
  }, [conversationId, targetUserId, user, navigate, t])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = content.trim()
    if (!conversationId || !user || !trimmed || trimmed.length > 4000) return
    setSending(true)
    const { data, error: sendError } = await supabase.from('direct_messages').insert({ conversation_id: conversationId, sender_id: user.id, content: trimmed }).select('*').single()
    if (sendError) setError(sendError.message)
    else { setContent(''); if (data) setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as DirectMessage]) }
    setSending(false)
  }

  return <Layout>
    <section className="card direct-chat-page">
      <p><Link to="/messages">← {t('messages.back')}</Link></p>
      <h2>{otherProfile?.display_name || t('messages.title')}</h2>
      {error ? <p className="message">{error}</p> : null}
      {loading ? <p>{t('common.loading')}</p> : <>
        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 ? <p>{t('messages.noMessages')}</p> : messages.map((message) => <div key={message.id} className={`chat-message ${message.sender_id === user?.id ? 'mine' : ''}`}><span>{message.content}</span><small>{new Date(message.created_at).toLocaleString()}</small></div>)}
          <div ref={endRef} />
        </div>
        <form className="chat-form" onSubmit={send}>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={4000} placeholder={t('messages.placeholder')} aria-label={t('messages.placeholder')} />
          <button type="submit" disabled={sending || !content.trim()}>{sending ? t('messages.sending') : t('messages.send')}</button>
        </form>
      </>}
    </section>
  </Layout>
}
