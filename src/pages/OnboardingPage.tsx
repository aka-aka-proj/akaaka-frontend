import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { SafetyCompactModal } from '../components/SafetyCompactModal'
import { VisibilityTooltip } from '../components/VisibilityTooltip'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { PRESET_AVATAR_PATHS } from '../lib/profile'
import { enableWebPush, getWebPushState } from '../lib/web-push'
import { supabase } from '../supabaseClient'
import type { BdsmRole, GenderIdentity, Visibility } from '../types'

const safeReturnPath = (value: string | null | undefined) => value?.startsWith('/') && !value.startsWith('//') ? value : null
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches === true

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const returnNavigationStarted = useRef(false)
  const [agreed, setAgreed] = useState(false)
  const [compactOpen, setCompactOpen] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [avatarPath, setAvatarPath] = useState('/default-avatar.svg')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity | ''>('')
  const [genderIdentityVisibility, setGenderIdentityVisibility] = useState<Visibility>('public')
  const [bdsmRoles, setBdsmRoles] = useState<BdsmRole[]>([])
  const [bdsmRolesVisibility, setBdsmRolesVisibility] = useState<Visibility>('public')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [pushPromptVisible, setPushPromptVisible] = useState(false)
  const [pushPromptBusy, setPushPromptBusy] = useState(false)
  const [pushPromptMessage, setPushPromptMessage] = useState('')
  const params = new URLSearchParams(location.search)
  const showXReturnPanel = profile && params.get('oauth_return') === 'x_android_pwa' && !isStandalone()

  const getReturnPath = () => {
    const fromQuery = safeReturnPath(new URLSearchParams(location.search).get('from'))
    const fromState = safeReturnPath((location.state as { from?: string } | null)?.from)
    return fromQuery ?? fromState ?? '/events'
  }

  useEffect(() => {
    if (profile && !showXReturnPanel && !returnNavigationStarted.current) {
      returnNavigationStarted.current = true
      navigate(getReturnPath(), { replace: true })
    }
  }, [profile, showXReturnPanel, navigate, location.search, location.state])

  useEffect(() => {
    if (agreed) headingRef.current?.focus()
  }, [agreed])

  if (showXReturnPanel) {
    const returnPath = getReturnPath()
    const callback = new URL('/onboarding', window.location.origin)
    callback.searchParams.set('from', returnPath)
    const intentUrl = `intent://${callback.host}${callback.pathname}${callback.search}#Intent;scheme=${callback.protocol.replace(':', '')};end`
    return <Layout><section className="card onboarding-pwa-return" aria-labelledby="pwa-return-title">
      <p className="eyebrow">{t('onboarding.pwaReturnEyebrow')}</p>
      <h1 id="pwa-return-title">{t('onboarding.pwaReturnTitle')}</h1>
      <p>{t('onboarding.pwaReturnDescription')}</p>
      <div className="onboarding-pwa-return-actions">
        <button type="button" className="primary" onClick={() => { window.location.href = intentUrl }}>{t('onboarding.pwaReturnOpenApp')}</button>
        <button type="button" className="secondary" onClick={() => { returnNavigationStarted.current = true; navigate(returnPath, { replace: true }) }}>{t('onboarding.pwaReturnContinueBrowser')}</button>
      </div>
      <p className="form-help">{t('onboarding.pwaReturnManual')}</p>
    </section></Layout>
  }

  if (profile) return null

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) { setMessage(t('onboarding.signInFirst')); return }
    if (!agreed) { setMessage(t('onboarding.mustAgree')); return }
    setSubmitting(true)
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      metadata: {
        visibility: { bio: visibility || 'public', gender_identity: genderIdentityVisibility || 'public', bdsm_roles: bdsmRolesVisibility || 'public' },
        avatar_path: avatarPath === '/default-avatar.svg' ? null : avatarPath,
        gender_identity: genderIdentity || undefined,
        bdsm_roles: bdsmRoles.length > 0 ? bdsmRoles : undefined,
      },
    })
    setSubmitting(false)
    if (error) { setMessage(error.message); return }
    setProfileSaved(true)
    const webPushState = await getWebPushState(user?.id).catch(() => 'unsupported' as const)
    if (webPushState === 'unsubscribed' || webPushState === 'default') { setPushPromptVisible(true); return }
    await finishOnboarding()
  }

  const finishOnboarding = async () => {
    const returnPath = getReturnPath()
    await refreshProfile()
    navigate(returnPath, { replace: true })
  }

  const acceptPush = async () => {
    if (!user) return
    setPushPromptBusy(true); setPushPromptMessage('')
    try { await enableWebPush(); await finishOnboarding() }
    catch (error) { setPushPromptMessage(error instanceof Error ? error.message : t('onboarding.pushEnableFailed')); setPushPromptBusy(false) }
  }
  const skipPush = async () => { setPushPromptBusy(true); await finishOnboarding() }

  return <Layout>
    <SafetyCompactModal open={compactOpen} onClose={async () => { await supabase.auth.signOut(); navigate('/auth', { replace: true }) }} onAgree={() => { setAgreed(true); setCompactOpen(false) }} />
    {agreed && <div className="onboarding-shell">
      {profileSaved && pushPromptVisible ? <section className="card onboarding-push-prompt" aria-labelledby="onboarding-push-title">
        <p className="eyebrow">{t('onboarding.pushEyebrow')}</p><h1 id="onboarding-push-title">{t('onboarding.pushTitle')}</h1><p>{t('onboarding.pushDescription')}</p>
        <div className="onboarding-push-actions"><button type="button" className="primary onboarding-submit" disabled={pushPromptBusy} onClick={() => void acceptPush()}>{pushPromptBusy ? t('onboarding.pushWorking') : t('onboarding.pushAccept')}</button><button type="button" className="secondary onboarding-push-later" disabled={pushPromptBusy} onClick={() => void skipPush()}>{t('onboarding.pushLater')}</button></div>
        {pushPromptMessage ? <p className="message" role="alert">{pushPromptMessage}</p> : null}
      </section> : null}
      {!profileSaved ? <><header className="onboarding-header"><p className="eyebrow">{t('onboarding.step')}</p><h1 ref={headingRef} tabIndex={-1}>{t('onboarding.title')}</h1><p>{t('onboarding.intro')}</p><div className="onboarding-progress" aria-label={t('onboarding.progressLabel')}><span className="onboarding-progress-bar" /></div><p className="onboarding-progress-copy">{t('onboarding.progress')}</p></header>
      <form className="card onboarding-form" onSubmit={submit}>
        <section className="onboarding-section"><div className="onboarding-section-heading"><p className="eyebrow">01</p><h2>{t('onboarding.basicInfoTitle')}</h2><p>{t('onboarding.basicInfoDescription')}</p></div>
          <fieldset><legend>{t('onboarding.avatarLabel')}</legend><div className="avatar-picker"><label className="avatar-option"><input type="radio" name="onboarding-avatar" value="/default-avatar.svg" checked={avatarPath === '/default-avatar.svg'} onChange={() => setAvatarPath('/default-avatar.svg')} /><img src="/default-avatar.svg" alt={t('onboarding.defaultAvatar')} className="avatar avatar-lg" /><span>{t('onboarding.defaultAvatar')}</span></label>{PRESET_AVATAR_PATHS.map((path, index) => <label className="avatar-option" key={path}><input type="radio" name="onboarding-avatar" value={path} aria-label={t('onboarding.presetAvatar', { index: index + 1 })} checked={avatarPath === path} onChange={() => setAvatarPath(path)} /><img src={path} alt="" className="avatar avatar-lg" /></label>)}</div></fieldset>
          <label>{t('onboarding.displayNameLabel')}<input aria-label={t('onboarding.displayNameLabel')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label>{t('onboarding.bioLabel')}<textarea aria-label={t('onboarding.bioLabel')} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
          <div className="onboarding-field-with-visibility"><label><span className="form-label-row">{t('onboarding.bioVisibilityLabel')} <VisibilityTooltip fieldName="bio" /></span><select aria-label={t('onboarding.bioVisibilityLabel')} value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}><option value="public">{t('onboarding.public')}</option><option value="connections_only">{t('onboarding.connectionsOnly')}</option><option value="private">{t('onboarding.private')}</option></select></label></div>
        </section>
        <section className="onboarding-section"><div className="onboarding-section-heading"><p className="eyebrow">02</p><h2>{t('onboarding.identityTitle')}</h2><p>{t('onboarding.identityDescription')}</p></div>
          <label>{t('onboarding.genderIdentityLabel')}<select aria-label={t('onboarding.genderIdentityLabel')} value={genderIdentity} onChange={(e) => setGenderIdentity(e.target.value as GenderIdentity | '')}><option value="">{t('onboarding.genderIdentityLabel')}</option><option value="man">{t('onboarding.genderIdentityMan')}</option><option value="woman">{t('onboarding.genderIdentityWoman')}</option><option value="non_binary">{t('onboarding.genderIdentityNonBinary')}</option><option value="genderqueer">{t('onboarding.genderIdentityGenderqueer')}</option><option value="agender">{t('onboarding.genderIdentityAgender')}</option><option value="bigender">{t('onboarding.genderIdentityBigender')}</option><option value="demiboy">{t('onboarding.genderIdentityDemiboy')}</option><option value="demigirl">{t('onboarding.genderIdentityDemigirl')}</option><option value="genderfluid">{t('onboarding.genderIdentityGenderfluid')}</option><option value="two_spirit">{t('onboarding.genderIdentityTwoSpirit')}</option><option value="questioning">{t('onboarding.genderIdentityQuestioning')}</option><option value="other">{t('onboarding.genderIdentityOther')}</option></select></label>
          <div className="onboarding-field-with-visibility"><label><span className="form-label-row">{t('onboarding.genderIdentityVisibilityLabel')} <VisibilityTooltip fieldName="gender_identity" /></span><select aria-label={t('onboarding.genderIdentityVisibilityLabel')} value={genderIdentityVisibility} onChange={(e) => setGenderIdentityVisibility(e.target.value as Visibility)}><option value="public">{t('onboarding.public')}</option><option value="connections_only">{t('onboarding.connectionsOnly')}</option><option value="private">{t('onboarding.private')}</option></select></label></div>
          <fieldset className="onboarding-role-fieldset"><legend>{t('onboarding.bdsmRolesLabel')}</legend><div className="role-chips onboarding-role-chips">{(['dom', 'sub', 'switch', 'master', 'slave', 'owner', 'pet', 'brat', 'rigging'] as BdsmRole[]).map((role) => <label key={role} className={`role-chip ${bdsmRoles.includes(role) ? 'selected' : ''}`}><input type="checkbox" checked={bdsmRoles.includes(role)} onChange={(e) => setBdsmRoles((prev) => e.target.checked ? [...prev, role] : prev.filter((r) => r !== role))} />{t(`onboarding.bdsmRole${role.charAt(0).toUpperCase() + role.slice(1).replace(/\s+/g, '')}`)}</label>)}</div></fieldset>
          <div className="onboarding-field-with-visibility"><label><span className="form-label-row">{t('onboarding.bdsmRolesVisibilityLabel')} <VisibilityTooltip fieldName="bdsm_roles" /></span><select aria-label={t('onboarding.bdsmRolesVisibilityLabel')} value={bdsmRolesVisibility} onChange={(e) => setBdsmRolesVisibility(e.target.value as Visibility)}><option value="public">{t('onboarding.public')}</option><option value="connections_only">{t('onboarding.connectionsOnly')}</option><option value="private">{t('onboarding.private')}</option></select></label></div>
        </section>
        <div className="onboarding-footer"><p>{t('onboarding.socialLinksLater')}</p><button type="submit" className="primary onboarding-submit" disabled={submitting}>{t('onboarding.completeOnboarding')}</button>{message ? <p className="message" role="alert">{message}</p> : null}</div>
      </form></> : null}
    </div>}
  </Layout>
}
