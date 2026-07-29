import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
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

const TEMPLATE_ICONS: Record<string, string> = {
  gentleMentor: '📚',
  playfulCompanion: '🎭',
  firmGuardian: '🛡️',
  curiousExplorer: '🔍',
  intellectualController: '🧠',
}

export function VirtualLoverCreatePage() {
  const { user } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [persona, setPersona] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleTemplateClick = (templateKey: string | null) => {
    if (dirty && selectedTemplate !== null && selectedTemplate !== templateKey) {
      if (!window.confirm(t('virtualLover.templateConfirmSwitch'))) return
    }

    if (templateKey === null) {
      setPersona('')
      setName('')
      setSelectedTemplate(null)
      setDirty(false)
    } else {
      setPersona(t(`virtualLover.templates.${templateKey}Content`))
      setName(t(`virtualLover.templates.${templateKey}`))
      setSelectedTemplate(templateKey)
      setDirty(false)
    }
  }

  const createCharacter = async () => {
    if (!user || !name.trim() || !persona.trim()) return
    setSubmitting(true)

    const { error } = await supabase.from('ai_characters').insert({
      user_id: user.id,
      name: name.trim(),
      persona: persona.trim(),
    })

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    navigate('/virtual-lovers', { state: { message: t('virtualLover.saveSuccess') } })
  }

  const isCustom = selectedTemplate === null
  const personaLength = persona.length

  return (
    <Layout title={t('virtualLover.title')}>
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" onClick={() => navigate('/virtual-lovers')} className="btn-back">
            ←
          </button>
          <h2 style={{ margin: 0 }}>{t('virtualLover.createNew')}</h2>
        </div>

        {message ? <p className="message">{message}</p> : null}

        <div className="template-carousel">
          {/* 自定義角色卡片 */}
          <button
            type="button"
            className={`template-card ${isCustom ? 'template-card--selected' : ''}`}
            onClick={() => handleTemplateClick(null)}
          >
            <div className="template-card__icon">+</div>
            <div className="template-card__name">{t('virtualLover.customRole')}</div>
          </button>

          {/* 範本角色卡片 */}
          {TEMPLATE_KEYS.map((key) => {
            const isSelected = selectedTemplate === key
            return (
              <button
                key={key}
                type="button"
                className={`template-card ${isSelected ? 'template-card--selected' : ''}`}
                onClick={() => handleTemplateClick(key)}
              >
                <div className="template-card__icon">{TEMPLATE_ICONS[key]}</div>
                <div className="template-card__name">{t(`virtualLover.templates.${key}`)}</div>
              </button>
            )
          })}
        </div>

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
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('virtualLover.personaLabel')}</span>
            <span style={{ fontSize: '0.8rem', color: personaLength >= 250 ? '#ef4444' : '#6b7280' }}>
              {personaLength}/250
            </span>
          </div>
          <textarea
            aria-label={t('virtualLover.personaLabel')}
            value={persona}
            onChange={(e) => {
              setPersona(e.target.value)
              setDirty(true)
            }}
            maxLength={250}
            placeholder={t('virtualLover.personaPlaceholder')}
            style={{ minHeight: '6rem' }}
          />
        </label>

        <button
          type="button"
          onClick={() => void createCharacter()}
          disabled={!name.trim() || !persona.trim() || submitting}
          style={{ minHeight: '44px' }}
        >
          {submitting ? t('virtualLover.saving') : t('virtualLover.save')}
        </button>
      </section>
    </Layout>
  )
}