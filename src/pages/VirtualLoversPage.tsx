import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

const TEMPLATE_KEYS = [
  'gentleMentor',
  'playfulCompanion',
  'firmGuardian',
  'curiousExplorer',
  'intellectualController',
] as const

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

  const [characters, setCharacters] = useState<AiCharacter[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [persona, setPersona] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadCharacters = async () => {
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
  }

  useEffect(() => {
    void loadCharacters()
  }, [user?.id])

  const createCharacter = async () => {
    if (!user || !name.trim() || !persona.trim()) return

    const { error } = await supabase.from('ai_characters').insert({
      user_id: user.id,
      name: name.trim(),
      persona: persona.trim(),
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setShowCreate(false)
    setName('')
    setPersona('')
    setMessage(t('virtualLover.saveSuccess'))
    await loadCharacters()
  }

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

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const content = e.target.value
    if (content) {
      setPersona(content)
    }
  }

  return (
    <Layout title={t('virtualLover.title')}>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{t('virtualLover.myCharacters')}</h2>
          <button type="button" onClick={() => setShowCreate(!showCreate)}>
            <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('virtualLover.createNew')}
          </button>
        </div>

        {message ? <p className="message">{message}</p> : null}

        {showCreate ? (
          <div className="card" style={{ marginTop: '0.5rem' }}>
            <label>
              {t('virtualLover.nameLabel')}
              <input
                aria-label={t('virtualLover.nameLabel')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </label>
            <label>
              <span>{t('virtualLover.templateLabel')}</span>
              <select
                aria-label={t('virtualLover.templateLabel')}
                value={''}
                onChange={handleTemplateSelect}
              >
                <option value="">{t('virtualLover.templatePlaceholder')}</option>
                {TEMPLATE_KEYS.map((key) => (
                  <option key={key} value={t(`virtualLover.templates.${key}Content`)}>
                    {t(`virtualLover.templates.${key}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('virtualLover.personaLabel')}</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {t('virtualLover.personaCount', { count: persona.length })}
                </span>
              </div>
              <textarea
                aria-label={t('virtualLover.personaLabel')}
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                maxLength={250}
                placeholder={t('virtualLover.personaPlaceholder')}
                style={{ minHeight: '6rem' }}
              />
            </label>
            <button type="button" onClick={() => void createCharacter()} disabled={!name.trim() || !persona.trim()}>
              {t('virtualLover.save')}
            </button>
          </div>
        ) : null}

        {loading ? (
          <p>{t('common.loading')}</p>
        ) : characters.length === 0 ? (
          <div className="empty-state">
            <p>{t('virtualLover.noCharacters')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {characters.map((char) => (
              <div key={char.id} className="card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/virtual-lovers/${char.id}/chat`)}>
                  <strong>{char.name}</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
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