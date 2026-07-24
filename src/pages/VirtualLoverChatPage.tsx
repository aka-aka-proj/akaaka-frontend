import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

interface AiCharacter {
  id: string
  name: string
  persona: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function VirtualLoverChatPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { t } = useT()

  const [character, setCharacter] = useState<AiCharacter | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streaming, scrollToBottom])

  useEffect(() => {
    const loadCharacter = async () => {
      if (!id) return
      const { data, error } = await supabase
        .from('ai_characters')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        setMessage('Character not found.')
        setLoading(false)
        return
      }

      setCharacter(data)

      // Load existing chat history
      const { data: chatData } = await supabase
        .from('ai_chats')
        .select('messages')
        .eq('character_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (chatData?.messages) {
        setMessages(chatData.messages as ChatMessage[])
      }

      setLoading(false)
    }

    void loadCharacter()
  }, [id])

  const sendMessage = async () => {
    if (!input.trim() || streaming || !character) return

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setStreaming(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const functionUrl = `${supabaseUrl}/functions/v1/chat`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
          characterPersona: {
            id: character.id,
            name: character.name,
            bio: character.persona,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        assistantContent += chunk

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
          return updated
        })
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error during chat')
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  if (loading) {
    return (
      <Layout title={t('common.loading')}>
        <p>{t('common.loading')}</p>
      </Layout>
    )
  }

  if (!character) {
    return (
      <Layout title={t('virtualLover.title')}>
        <p className="message">{message}</p>
      </Layout>
    )
  }

  return (
    <Layout title={t('virtualLover.chatTitle', { name: character.name })}>
      {message ? <p className="message">{message}</p> : null}

      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                {character.persona}
              </p>
              <p>{t('virtualLover.inputPlaceholder')}</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-assistant'}`}>
                <div className="chat-msg-role">
                  {msg.role === 'user' ? user?.email ?? 'You' : character.name}
                </div>
                <div className="chat-msg-content">{msg.content}</div>
              </div>
            ))
          )}
          {streaming ? (
            <div className="chat-msg chat-msg-assistant">
              <div className="chat-msg-role">{character.name}</div>
              <div className="chat-msg-content chat-typing">...</div>
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-row">
          <textarea
            className="chat-input"
            aria-label={t('virtualLover.inputPlaceholder')}
            placeholder={t('virtualLover.inputPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={2}
          />
          <button type="button" onClick={() => void sendMessage()} disabled={!input.trim() || streaming}>
            {t('virtualLover.send')}
          </button>
        </div>
      </div>
    </Layout>
  )
}