import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { SafetyCompactModal } from '../components/SafetyCompactModal'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { BdsmRole, GenderIdentity, SocialLink, Visibility } from '../types'

const createSocialLink = (): SocialLink => ({ platform: 'facebook', url: '' })

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  useEffect(() => {
    console.log('OnboardingPage loaded, state:', location.state);
  }, [location.state]);
  
  const { t } = useT()
  const [agreed, setAgreed] = useState(false)
  const [compactOpen, setCompactOpen] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity | ''>('')
  const [genderIdentityVisibility, setGenderIdentityVisibility] = useState<Visibility>('public')
  const [bdsmRoles, setBdsmRoles] = useState<BdsmRole[]>([])
  const [bdsmRolesVisibility, setBdsmRolesVisibility] = useState<Visibility>('public')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (profile) {
      const params = new URLSearchParams(location.search)
      const fromQuery = params.get('from')
      const fromState = (location.state as { from?: string } | null)?.from
      const from = fromQuery ?? fromState
      
      console.log('OnboardingPage loaded, resolved from:', from);
      navigate(from ?? '/events', { replace: true })
    }
  }, [profile, navigate, location.search, location.state])

  if (profile) {
    return null
  }

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
            gender_identity: genderIdentityVisibility || 'public',
            bdsm_roles: bdsmRolesVisibility || 'public',
          },
          gender_identity: genderIdentity || undefined,
          bdsm_roles: bdsmRoles.length > 0 ? bdsmRoles : undefined,
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
    const from = (location.state as { from?: string } | null)?.from
    navigate(from ?? '/events', { replace: true })
  }

  return (
    <Layout title={t('onboarding.title')}>
      <SafetyCompactModal
        open={compactOpen}
        onClose={async () => {
          await supabase.auth.signOut()
          navigate('/auth', { replace: true })
        }}
        onAgree={() => {
          setAgreed(true)
          setCompactOpen(false)
        }}
      />
      {agreed && (
        <>
          <form className="card" onSubmit={submit}>
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
              <label>
                {t('onboarding.genderIdentityLabel')}
                <select
                  aria-label={t('onboarding.genderIdentityLabel')}
                  value={genderIdentity}
                  onChange={(event) => setGenderIdentity(event.target.value as GenderIdentity | '')}
                >
                  <option value="">{t('onboarding.genderIdentityLabel')}</option>
                  <option value="man">{t('onboarding.genderIdentityMan')}</option>
                  <option value="woman">{t('onboarding.genderIdentityWoman')}</option>
                  <option value="non_binary">{t('onboarding.genderIdentityNonBinary')}</option>
                  <option value="genderqueer">{t('onboarding.genderIdentityGenderqueer')}</option>
                  <option value="agender">{t('onboarding.genderIdentityAgender')}</option>
                  <option value="bigender">{t('onboarding.genderIdentityBigender')}</option>
                  <option value="demiboy">{t('onboarding.genderIdentityDemiboy')}</option>
                  <option value="demigirl">{t('onboarding.genderIdentityDemigirl')}</option>
                  <option value="genderfluid">{t('onboarding.genderIdentityGenderfluid')}</option>
                  <option value="two_spirit">{t('onboarding.genderIdentityTwoSpirit')}</option>
                  <option value="questioning">{t('onboarding.genderIdentityQuestioning')}</option>
                  <option value="other">{t('onboarding.genderIdentityOther')}</option>
                </select>
              </label>
              <label>
                {t('onboarding.genderIdentityVisibilityLabel')}
                <select
                  aria-label={t('onboarding.genderIdentityVisibilityLabel')}
                  value={genderIdentityVisibility}
                  onChange={(event) => setGenderIdentityVisibility(event.target.value as Visibility)}
                >
                  <option value="public">{t('onboarding.public')}</option>
                  <option value="connections_only">{t('onboarding.connectionsOnly')}</option>
                  <option value="private">{t('onboarding.private')}</option>
                </select>
              </label>
              <fieldset>
                <legend>{t('onboarding.bdsmRolesLabel')}</legend>
                {(['dom', 'sub', 'switch', 'master', 'slave', 'owner', 'pet', 'brat', 'rigging'] as BdsmRole[]).map((role) => (
                  <label key={role} className="checkbox">
                    <input
                      type="checkbox"
                      checked={bdsmRoles.includes(role)}
                      onChange={(event) => {
                        setBdsmRoles((prev) =>
                          event.target.checked
                            ? [...prev, role]
                            : prev.filter((r) => r !== role),
                        )
                      }}
                    />
                    {t(`onboarding.bdsmRole${role.charAt(0).toUpperCase() + role.slice(1).replace(/\s+/g, '')}` as any)}
                  </label>
                ))}
              </fieldset>
              <label>
                {t('onboarding.bdsmRolesVisibilityLabel')}
                <select
                  aria-label={t('onboarding.bdsmRolesVisibilityLabel')}
                  value={bdsmRolesVisibility}
                  onChange={(event) => setBdsmRolesVisibility(event.target.value as Visibility)}
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
                    <Icon href="/action-icons.svg" name="action-trash" size={16} /> {t('common.remove')}
                  </button>
                </div>
              ))}
              <button type="button" onClick={addLink}>
                <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('onboarding.addSocialLink')}
              </button>
            </section>
            <button type="submit" disabled={submitting}>
              {t('onboarding.completeOnboarding')}
            </button>
            {message ? <p className="message">{message}</p> : null}
          </form>
        </>
      )}
    </Layout>
  )
}
