import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'
import {
  provisionBrowserProviderKey,
  requestProviderChat,
  VIRTUAL_LOVER_MODELS,
} from '../lib/virtual-lover-provider'

interface AiCharacter {
  id: string
  name: string
  persona: string
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
  const [providerKey, setProviderKey] = useState<string | null>(null)
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
        .select('id, name, persona')
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

    const provisionLlmKey = async () => {
      if (!user?.id) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      try {
        const key = await provisionBrowserProviderKey(
          import.meta.env.VITE_SUPABASE_URL as string,
          session.access_token,
        )
        setProviderKey(key)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to unlock AI provider')
      }
    }

    void loadCharacter()
    void loadFeedback()
    void provisionLlmKey()
  }, [id, user?.id])

  const sendMessage = async () => {
    if (!input.trim() || streaming || !character) return

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setStreaming(true)

    let assistantContent = ''

    try {
      if (!providerKey) throw new Error('llm_key_unavailable')
      const userContext = userProfile
        ? [
          userProfile.display_name ? `Name: ${userProfile.display_name}` : '',
          userProfile.bio ? `Self introduction: ${userProfile.bio}` : '',
          userProfile.metadata?.gender_identity ? `Gender identity: ${userProfile.metadata.gender_identity}` : '',
          userProfile.metadata?.bdsm_roles?.length ? `BDSM roles: ${userProfile.metadata.bdsm_roles.join(', ')}` : '',
        ].filter(Boolean).join('\n')
        : ''
      const systemPrompt = `You are ${character.name}, a fictional adult romantic roleplay character speaking natural Traditional Chinese.\n\nPersonality: ${character.persona}\n\nThis is a private, consenting-adults-only roleplay. Never involve minors, coercion, real-world harm, or non-consensual sexual activity. If the user says stop, uses a safeword, or sounds uncomfortable, stop sexual escalation immediately and respond with brief reassurance and aftercare.${userContext ? `\n\nAbout the user you are talking to:\n${userContext}` : ''}`
      const response = await requestProviderChat(
        providerKey,
        usedModel || VIRTUAL_LOVER_MODELS[0],
        [{ role: 'system', content: systemPrompt }, ...updatedMessages],
      )

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
  }
  }

  const startNewConversation = async () => {
    if (!character) return
    setMessages([])
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleShuffle = async () => {
    const currentIndex = VIRTUAL_LOVER_MODELS.indexOf(usedModel as typeof VIRTUAL_LOVER_MODELS[number])
    const nextIndex = (currentIndex + 1) % VIRTUAL_LOVER_MODELS.length
    setUsedModel(VIRTUAL_LOVER_MODELS[nextIndex])
    setFeedback(null)
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
