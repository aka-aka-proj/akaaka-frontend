import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'

interface AiCharacter {
  id: string
  name: string
  persona: string
  memory: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UserProfile {
  display_name: string | null
  bio: string | null
  metadata: {
    gender_identity?: string | null
    bdsm_roles?: string[] | null
  } | null
}

export function VirtualLoverChatPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { t } = useT()

  const [character, setCharacter] = useState<AiCharacter | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [usedModel, setUsedModel] = useState('')
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
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

      // Load user's own profile for context
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, bio, metadata')
          .eq('id', user.id)
          .maybeSingle()
        if (profile) {
          setUserProfile(profile as unknown as UserProfile)
        }
      }

      // Load the latest conversation and its messages
      const { data: latestConv } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('character_id', data.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestConv) {
        setConversationId(latestConv.id)
        const { data: msgs } = await supabase
          .from('ai_messages')
          .select('role, content')
          .eq('conversation_id', latestConv.id)
          .order('created_at', { ascending: true })

        if (msgs && msgs.length > 0) {
          setMessages(msgs as ChatMessage[])
        }
      } else {
        // Auto-create first conversation if none exists
        const { data: newConv } = await supabase
          .from('ai_conversations')
          .insert({ character_id: data.id })
          .select('id')
          .single()

        if (newConv) {
          setConversationId(newConv.id)
        }
      }

      setLoading(false)
    }

    const loadFeedback = async () => {
      if (!user?.id || !id) return
      const { data: fb } = await supabase
        .from('ai_chat_feedback')
        .select('model_name, feedback')
        .eq('character_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (fb) {
        setUsedModel(fb.model_name)
        setFeedback(fb.feedback as 'like' | 'dislike')
      }
    }

    const pickRandomModel = async () => {
      if (!id) return
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (data.model) setUsedModel(data.model)
      } catch {
        // silently fail, model will be set from SSE later
      }
    }

    const provisionLlmKey = async () => {
      if (!user?.id) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-key`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    }

    void loadCharacter()
    void loadFeedback()
    void pickRandomModel()
    void provisionLlmKey()
  }, [id, user?.id])

  const sendMessage = async () => {
    if (!input.trim() || streaming || !character) return

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setStreaming(true)

    // Save user message to DB immediately
    if (conversationId) {
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage.content,
      }).select().maybeSingle()
    }

    let assistantContent = ''

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Authentication required')
      const functionUrl = `${supabaseUrl}/functions/v1/chat`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
          characterPersona: {
            id: character.id,
            name: character.name,
            bio: character.persona,
          },
          userProfile,
          sessionMessageCount: messages.length + 1,
          preferredModel: usedModel || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let modelExtracted = false

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const jsonStr = trimmed.slice(6)
          if (jsonStr === '[DONE]') break

          try {
            const parsed = JSON.parse(jsonStr)

            // Extract model name from the first SSE event (OpenRouter includes it)
            if (!modelExtracted && parsed.model) {
              setUsedModel(parsed.model)
              modelExtracted = true
            }

            const delta = parsed?.choices?.[0]?.delta
            if (!delta) continue

            // Prefer 'content', fall back to 'reasoning' text
            const text = delta.content ?? delta.reasoning ?? ''
            if (!text) continue

            assistantContent += text
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
              return updated
            })
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error during chat')
    } finally {
      setStreaming(false)
      // Save assistant message to DB after streaming completes
      if (conversationId && assistantContent) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantContent,
        }).select().maybeSingle()
      }
    }
  }

  const startNewConversation = async () => {
    if (!character) return
    const { data } = await supabase.from('ai_conversations').insert({
      character_id: character.id,
    }).select('id').single()

    if (data) {
      setConversationId(data.id)
      setMessages([])
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleShuffle = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.model) {
        setUsedModel(data.model)
        setFeedback(null)
      }
    } catch {
      // silently fail
    }
  }

  const handleFeedback = async (type: 'like' | 'dislike') => {
    if (!character || !user || !usedModel || feedbackSaving) return

    setFeedback(type)
    setFeedbackSaving(true)

    try {
      const { error } = await supabase.from('ai_chat_feedback').insert({
        character_id: character.id,
        user_id: user.id,
        model_name: usedModel,
        feedback: type,
      })
      if (error) throw error
    } catch {
      // silently fail, don't revert UI
    } finally {
      setFeedbackSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <p>{t('common.loading')}</p>
      </Layout>
    )
  }

  if (!character) {
    return (
      <Layout>
        <p className="message">{message}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      {message ? <p className="message">{message}</p> : null}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* {character.memory ? (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic', margin: 0, flex: 1 }}>
            🧠 {character.memory}
          </p>
        ) : null} */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PrivacyDisclosure
            label={t('privacyDisclosure.aiLabel')}
            description={t('privacyDisclosure.aiConversation')}
            learnMore={t('privacyDisclosure.learnMore')}
          />
          <button type="button" onClick={startNewConversation} style={{ flexShrink: 0 }}>
            + {t('virtualLover.newConversation')}
          </button>
        </div>
      </div>
      <div>
        {t('virtualLover.nameLabel')}: <span style={{ fontStyle: 'italic', color: '#6b7280' }}>{character.name}</span>
        <br />
        {t('virtualLover.personaLabel')}:
        <br /> 
        <span style={{ fontStyle: 'italic', color: '#6b7280' }}>{character.persona}</span>
      </div>
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
                  {msg.role === 'user' ? userProfile?.display_name ?? user?.email ?? 'You' : character.name}
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

        <div className="model-feedback-row">
          <span className="model-name-label">
            {usedModel ? (
              <>
                Model: <strong>{usedModel}</strong>
                <button type="button" className="shuffle-btn" onClick={handleShuffle} title="隨機更換模型">🔀</button>
              </>
            ) : (
              <span style={{ color: '#9ca3af' }}>載入模型中...</span>
            )}
          </span>
          <div className="feedback-buttons">
            <button
              type="button"
              className={`feedback-btn ${feedback === 'like' ? 'feedback-btn-active' : ''}`}
              onClick={() => void handleFeedback('like')}
              disabled={feedbackSaving || !usedModel}
              title="Like"
            >
              👍
            </button>
            <button
              type="button"
              className={`feedback-btn ${feedback === 'dislike' ? 'feedback-btn-active' : ''}`}
              onClick={() => void handleFeedback('dislike')}
              disabled={feedbackSaving || !usedModel}
              title="Dislike"
            >
              👎
            </button>
          </div>
        </div>

        <div className="chat-input-row">
          <PrivacyDisclosure label={t('privacyDisclosure.label')} description={t('privacyDisclosure.aiConversation')} learnMore={t('privacyDisclosure.learnMore')} />
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
