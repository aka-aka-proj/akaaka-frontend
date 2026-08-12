import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { DirectMessage, Profile } from '../types'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'

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
  const [enterToSend, setEnterToSend] = useState(() => localStorage.getItem('akaaka:messages:enter-to-send') !== 'false')
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      const unreadIds = ((rows ?? []) as DirectMessage[])
        .filter((message) => message.sender_id !== user.id && !message.read_at)
        .map((message) => message.id)
      if (unreadIds.length > 0) {
        await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
      }
    }
    void load()
    const channel = supabase.channel(`direct-conversation:${conversationId}`, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        const incoming = payload.new as DirectMessage
        const { data } = await supabase.from('direct_messages').select('*').eq('id', incoming.id).maybeSingle()
        if (data && !cancelled) {
          const message = data as DirectMessage
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
          if (message.sender_id !== user.id && !message.read_at) {
            void supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', message.id)
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const updated = payload.new as DirectMessage
        if (!cancelled) setMessages((current) => current.map((message) => message.id === updated.id ? updated : message))
      })
      .subscribe((status) => { if (status === 'CHANNEL_ERROR' && !cancelled) setError(t('messages.realtimeError')) })
    return () => { cancelled = true; void supabase.removeChannel(channel) }
  }, [conversationId, targetUserId, user, navigate, t])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  useEffect(() => {
    localStorage.setItem('akaaka:messages:enter-to-send', String(enterToSend))
  }, [enterToSend])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`
  }, [content])

  const send = async (event: FormEvent | KeyboardEvent) => {
    event.preventDefault()
    const trimmed = content.trim()
    if (!conversationId || !user || !trimmed || trimmed.length > 4000) return
    setSending(true)
    const { data, error: sendError } = await supabase.from('direct_messages').insert({ conversation_id: conversationId, sender_id: user.id, content: trimmed }).select('*').single()
    if (sendError) setError(sendError.message)
    else { setContent(''); if (data) setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as DirectMessage]) }
    setSending(false)
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || !enterToSend) return
    event.preventDefault()
    if (!sending && content.trim()) void send(event)
  }

  const formatMessageTime = (createdAt: string) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(createdAt))

  return <Layout showPageBack={false}>
    <section className="card direct-chat-page">
      <header className="chat-header">
        <Link to="/messages" className="chat-back-link" aria-label={t('messages.back')}>&larr;</Link>
        <div>
          <h2>{otherProfile?.display_name || t('messages.title')}</h2>
          <p>{t('messages.privateChat')}</p>
        </div>
        <span className="chat-header-spacer" aria-hidden="true" />
      </header>
      {error ? <p className="message">{error}</p> : null}
      {loading ? <p>{t('common.loading')}</p> : <>
        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 ? <p>{t('messages.noMessages')}</p> : messages.map((message) => {
            const isMine = message.sender_id === user?.id
            return <div key={message.id} className={`chat-message ${isMine ? 'mine' : ''}`}>
              {!isMine ? <small className="chat-message-sender">{otherProfile?.display_name || t('messages.title')}</small> : null}
              <span>{message.content}</span>
              <small className="chat-message-meta"><time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time>{isMine ? <span aria-label={message.read_at ? t('messages.readStatus') : t('messages.sentStatus')}> {message.read_at ? '✓✓' : '✓'}</span> : null}</small>
            </div>
          })}
          <div ref={endRef} />
        </div>
        <form className="chat-form" onSubmit={send}>
          <PrivacyDisclosure label={t('privacyDisclosure.label')} description={t('privacyDisclosure.directMessage')} learnMore={t('privacyDisclosure.learnMore')} />
          <div className="chat-input-row">
            <textarea ref={textareaRef} value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={handleInputKeyDown} maxLength={4000} placeholder={t('messages.placeholder')} aria-label={t('messages.placeholder')} rows={1} />
            <button className="chat-send-button" type="submit" disabled={sending || !content.trim()} aria-label={sending ? t('messages.sending') : t('messages.send')}>
              <span aria-hidden="true">➤</span><span className="chat-send-label">{sending ? t('messages.sending') : t('messages.send')}</span>
            </button>
          </div>
          <label className="chat-enter-setting">
            <input type="checkbox" checked={enterToSend} onChange={(event) => setEnterToSend(event.target.checked)} />
            <span>{t('messages.enterToSend')}</span>
            <small>{enterToSend ? t('messages.enterToSendHint') : t('messages.enterToLineBreakHint')}</small>
          </label>
        </form>
      </>}
    </section>
  </Layout>
}
