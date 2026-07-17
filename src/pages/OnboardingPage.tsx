import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { SocialLink, Visibility } from '../types'

const createSocialLink = (): SocialLink => ({ platform: 'facebook', url: '' })

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [agreed, setAgreed] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([createSocialLink()])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateLink = (index: number, patch: Partial<SocialLink>) => {
    setSocialLinks((links) =>
      links.map((link, current) => (index === current ? { ...link, ...patch } : link)),
    )
  }

  const addLink = () => {
    setSocialLinks((links) => [...links, createSocialLink()])
  }

  const removeLink = (index: number) => {
    setSocialLinks((links) => links.filter((_link, current) => current !== index))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setMessage(t('onboarding.signInFirst'))
      return
    }

    if (!agreed) {
      setMessage(t('onboarding.mustAgree'))
      return
    }

    const sanitizedLinks = socialLinks.filter((link) => link.url.trim().length > 0)
    if (sanitizedLinks.length === 0) {
      setMessage(t('onboarding.addSocialLinkRequired'))
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        external_social_links: sanitizedLinks,
        metadata: {
          visibility: {
            bio: visibility || 'public',
          },
        },
      },
      { onConflict: 'id' },
    )
    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    await refreshProfile()
    navigate('/events', { replace: true })
  }

  return (
    <Layout title={t('onboarding.title')}>
      <form className="card" onSubmit={submit}>
        <label className="checkbox">
          <input
            aria-label={t('onboarding.agreeAria')}
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          {t('onboarding.agreeLabel')}
        </label>
        <label>
          {t('onboarding.displayNameLabel')}
          <input
            aria-label={t('onboarding.displayNameLabel')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          {t('onboarding.bioLabel')}
          <textarea
            aria-label={t('onboarding.bioLabel')}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>
        <label>
          {t('onboarding.bioVisibilityLabel')}
          <select
            aria-label={t('onboarding.bioVisibilityLabel')}
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
          >
            <option value="public">{t('onboarding.public')}</option>
            <option value="connections_only">{t('onboarding.connectionsOnly')}</option>
            <option value="private">{t('onboarding.private')}</option>
          </select>
        </label>
        <section>
          <h3>{t('onboarding.externalSocialLinks')}</h3>
          {socialLinks.map((link, index) => (
            <div key={`social-link-${index}`} className="row">
              <select
                aria-label={t('onboarding.socialPlatform', { index: index + 1 })}
                value={link.platform}
                onChange={(event) =>
                  updateLink(index, {
                    platform: event.target.value as SocialLink['platform'],
                  })
                }
              >
                <option value="facebook">facebook</option>
                <option value="instagram">instagram</option>
                <option value="x">x</option>
              </select>
              <input
                aria-label={t('onboarding.socialUrl', { index: index + 1 })}
                placeholder="https://..."
                value={link.url}
                onChange={(event) => updateLink(index, { url: event.target.value })}
              />
              <button type="button" onClick={() => removeLink(index)}>
                {t('common.remove')}
              </button>
            </div>
          ))}
          <button type="button" onClick={addLink}>
            {t('onboarding.addSocialLink')}
          </button>
        </section>
        <button type="submit" disabled={submitting}>
          {t('onboarding.completeOnboarding')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
