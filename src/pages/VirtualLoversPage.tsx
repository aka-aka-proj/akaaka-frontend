import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'

interface AiCharacter {
  id: string
  name: string
  persona: string
  created_at: string
}

export function VirtualLoversPage() {
  const { user } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()

  const [characters, setCharacters] = useState<AiCharacter[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadCharacters = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('ai_characters')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(t('virtualLover.loadError'))
    } else {
      setCharacters(data ?? [])
    }
    setLoading(false)
  }, [user, t])

  useEffect(() => {
    void loadCharacters()
  }, [loadCharacters])

  // Handle success message from create page
  useEffect(() => {
    const state = location.state as { message?: string } | null
    if (state?.message) {
      setMessage(state.message)
      // Clear the state so message doesn't persist on re-render
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const deleteCharacter = async (id: string) => {
    if (!window.confirm(t('virtualLover.deleteConfirm'))) return

    const { error } = await supabase.from('ai_characters').delete().eq('id', id)
    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(t('virtualLover.characterDeleted'))
    await loadCharacters()
  }

  return (
    <Layout>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <h2 style={{ margin: 0 }}>{t('virtualLover.myCharacters')}</h2>
            <PrivacyDisclosure
              label={t('privacyDisclosure.aiLabel')}
              description={t('privacyDisclosure.aiConversation')}
              learnMore={t('privacyDisclosure.learnMore')}
            />
          </div>
          <button type="button" onClick={() => navigate('/virtual-lovers/new')}>
            <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('virtualLover.createNew')}
          </button>
        </div>

        {message ? <p className="message">{message}</p> : null}

        {loading ? (
          <p>{t('common.loading')}</p>
        ) : characters.length === 0 ? (
          <div className="empty-state">
            <p>{t('virtualLover.noCharacters')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {characters.map((char) => (
              <div key={char.id} className="card vl-card-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/virtual-lovers/${char.id}/chat`)}>
                  <strong>{char.name}</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {char.persona}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button type="button" onClick={() => navigate(`/virtual-lovers/${char.id}/chat`)}>
                    {t('virtualLover.startChat')}
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void deleteCharacter(char.id)}>
                    <Icon href="/action-icons.svg" name="action-trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Layout>
  )
}
