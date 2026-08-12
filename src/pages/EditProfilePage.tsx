import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { VisibilityTooltip } from '../components/VisibilityTooltip'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { getAvatarPath, getBioVisibility, mapProfileRow, PRESET_AVATAR_PATHS } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { BdsmRole, GenderIdentity, Visibility } from '../types'

const BDSM_ROLES: BdsmRole[] = ['dom', 'sub', 'switch', 'master', 'slave', 'owner', 'pet', 'brat', 'rigging']

function visibilityIcon(value: Visibility) {
  return value === 'private' ? '🔒' : value === 'connections_only' ? '🔗' : '🌐'
}

export function EditProfilePage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarPath, setAvatarPath] = useState('/default-avatar.svg')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity | ''>('')
  const [genderIdentityVisibility, setGenderIdentityVisibility] = useState<Visibility>('public')
  const [bdsmRoles, setBdsmRoles] = useState<BdsmRole[]>([])
  const [bdsmRolesVisibility, setBdsmRolesVisibility] = useState<Visibility>('public')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const avatarPickerTriggerRef = useRef<HTMLButtonElement>(null)
  const avatarPickerFirstOptionRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!avatarPickerOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAvatarPickerOpen(false)
        window.setTimeout(() => avatarPickerTriggerRef.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    requestAnimationFrame(() => avatarPickerFirstOptionRef.current?.focus())
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [avatarPickerOpen])

  const closeAvatarPicker = () => {
    setAvatarPickerOpen(false)
    window.setTimeout(() => avatarPickerTriggerRef.current?.focus(), 0)
  }

  useEffect(() => {
    if (!user) {
      return
    }

    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      const profile = data ? mapProfileRow(data) : null
      setDisplayName(profile?.display_name ?? '')
      setBio(profile?.bio ?? '')
      setAvatarPath(getAvatarPath(profile))
      setVisibility(getBioVisibility(profile))
      setGenderIdentity(profile?.metadata?.gender_identity ?? '')
      setGenderIdentityVisibility(profile?.metadata?.visibility?.gender_identity ?? 'public')
      setBdsmRoles(profile?.metadata?.bdsm_roles ?? [])
      setBdsmRolesVisibility(profile?.metadata?.visibility?.bdsm_roles ?? 'public')
      setLoading(false)
    })()
  }, [user])

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      return
    }

    setSubmitting(true)
    setMessage('')

    const { data: currentRow, error: currentError } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', user.id)
      .maybeSingle()

    if (currentError) {
      setMessage(currentError.message)
      setSubmitting(false)
      return
    }

    const existingMeta = (currentRow?.metadata as Record<string, unknown>) ?? {}
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        metadata: {
          ...existingMeta,
          visibility: {
            bio: visibility || 'public',
            gender_identity: genderIdentityVisibility || 'public',
            bdsm_roles: bdsmRolesVisibility || 'public',
          },
          avatar_path: avatarPath === '/default-avatar.svg' ? null : avatarPath,
          gender_identity: genderIdentity || null,
          bdsm_roles: bdsmRoles.length > 0 ? bdsmRoles : null,
        },
      })
      .eq('id', user.id)

    if (error) {
      setMessage(error.message)
      setSubmitting(false)
      return
    }

    await refreshProfile()
    navigate('/profile/me', { replace: true })
  }

  return (
    <Layout>
      <form className="card profile-edit-form profile-edit-page" onSubmit={saveProfile}>
        <div className="profile-edit-page-header">
          <div>
            <h1>{t('profile.editProfile')}</h1>
            <p>{t('profile.editProfileDescription')}</p>
          </div>
        </div>
        {loading ? <p>{t('common.loading')}</p> : null}
        {message ? <p className="message">{message}</p> : null}
        {!loading ? (
          <>
            <section className="profile-edit-section" aria-labelledby="profile-basic-heading">
              <h2 id="profile-basic-heading">{t('profile.basicInfoHeading')}</h2>
              <label>
                {t('profile.displayNameLabel')}
              <input
                aria-label={t('profile.displayNameLabel')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              </label>
              <div className="avatar-current-picker">
                <img src={avatarPath} alt={t('profile.currentAvatar')} className="avatar avatar-lg" />
                <div>
                  <p className="form-field-label">{t('profile.avatarLabel')}</p>
                  <button ref={avatarPickerTriggerRef} type="button" className="btn-secondary" onClick={() => setAvatarPickerOpen(true)}>
                    {t('profile.changeAvatar')}
                  </button>
                </div>
              </div>
            </section>
            {avatarPickerOpen ? (
              <div className="avatar-picker-backdrop" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeAvatarPicker()
              }}>
                <section className="avatar-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="avatar-picker-heading">
                  <div className="avatar-picker-sheet-header">
                    <h2 id="avatar-picker-heading">{t('profile.avatarPickerTitle')}</h2>
                    <button type="button" className="icon-button" aria-label={t('profile.closeAvatarPicker')} onClick={closeAvatarPicker}>×</button>
                  </div>
                  <div className="avatar-picker">
                    {['/default-avatar.svg', ...PRESET_AVATAR_PATHS].map((path, index) => {
                      const label = index === 0 ? t('profile.defaultAvatar') : `${t('profile.presetAvatar')} ${index}`
                      return (
                        <label className="avatar-option" htmlFor={`profile-avatar-${index}`} key={path}>
                          <input
                            ref={index === 0 ? avatarPickerFirstOptionRef : undefined}
                            id={`profile-avatar-${index}`}
                            type="radio"
                            name="profile-avatar"
                            value={path}
                            checked={avatarPath === path}
                            aria-label={label}
                            onChange={() => {
                              setAvatarPath(path)
                              closeAvatarPicker()
                            }}
                          />
                          <img src={path} alt={label} className="avatar avatar-lg" />
                          <span>{label}</span>
                        </label>
                      )
                    })}
                  </div>
                </section>
              </div>
            ) : null}
            <section className="profile-edit-section" aria-labelledby="profile-details-heading">
              <h2 id="profile-details-heading">{t('profile.detailsHeading')}</h2>
              <div className="profile-edit-field">
                <div className="form-label-row"><label htmlFor="profile-bio">{t('profile.bioLabel')}</label><VisibilityTooltip fieldName="bio" /></div>
              <span className="visibility-select-icon" aria-hidden="true">{visibilityIcon(visibility)}</span>
              <select
                aria-label={t('profile.bioVisibilityLabel')}
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as Visibility)}
              >
                <option value="public">{t('profile.public')}</option>
                <option value="connections_only">{t('profile.connectionsOnly')}</option>
                <option value="private">{t('profile.private')}</option>
              </select>
              <textarea
                id="profile-bio"
                aria-label={t('profile.bioLabel')}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
              </div>
              <label>
                {t('profile.genderIdentityLabel')}
              <select
                aria-label={t('profile.genderIdentityLabel')}
                value={genderIdentity}
                onChange={(event) => setGenderIdentity(event.target.value as GenderIdentity | '')}
              >
                <option value="">{t('profile.genderIdentityLabel')}</option>
                <option value="man">{t('profile.genderIdentityMan')}</option>
                <option value="woman">{t('profile.genderIdentityWoman')}</option>
                <option value="non_binary">{t('profile.genderIdentityNonBinary')}</option>
                <option value="genderqueer">{t('profile.genderIdentityGenderqueer')}</option>
                <option value="agender">{t('profile.genderIdentityAgender')}</option>
                <option value="bigender">{t('profile.genderIdentityBigender')}</option>
                <option value="demiboy">{t('profile.genderIdentityDemiboy')}</option>
                <option value="demigirl">{t('profile.genderIdentityDemigirl')}</option>
                <option value="genderfluid">{t('profile.genderIdentityGenderfluid')}</option>
                <option value="two_spirit">{t('profile.genderIdentityTwoSpirit')}</option>
                <option value="questioning">{t('profile.genderIdentityQuestioning')}</option>
                <option value="other">{t('profile.genderIdentityOther')}</option>
              </select>
              </label>
              <div className="profile-edit-field">
                <div className="form-label-row"><label htmlFor="profile-gender-visibility">{t('profile.genderIdentityVisibilityLabel')}</label><VisibilityTooltip fieldName="gender_identity" /></div>
              <span className="visibility-select-icon" aria-hidden="true">{visibilityIcon(genderIdentityVisibility)}</span>
              <select
                id="profile-gender-visibility"
                aria-label={t('profile.genderIdentityVisibilityLabel')}
                value={genderIdentityVisibility}
                onChange={(event) => setGenderIdentityVisibility(event.target.value as Visibility)}
              >
                <option value="public">{t('profile.public')}</option>
                <option value="connections_only">{t('profile.connectionsOnly')}</option>
                <option value="private">{t('profile.private')}</option>
              </select>
              </div>
            </section>
            <section className="profile-edit-section" aria-labelledby="profile-identity-heading">
              <h2 id="profile-identity-heading">{t('profile.identityHeading')}</h2>
              <fieldset>
              <legend>{t('profile.bdsmRolesLabel')}</legend>
              <div className="role-chips">
                {BDSM_ROLES.map((role) => (
                  <label key={role} className={`role-chip ${bdsmRoles.includes(role) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={bdsmRoles.includes(role)}
                      onChange={(event) => {
                        setBdsmRoles((prev) => (
                          event.target.checked
                            ? [...prev, role]
                            : prev.filter((item) => item !== role)
                        ))
                      }}
                    />
                    {t(`profile.bdsmRole${role.charAt(0).toUpperCase() + role.slice(1).replace(/\s+/g, '')}` as any)}
                  </label>
                ))}
              </div>
              </fieldset>
              <div className="profile-edit-field">
                <div className="form-label-row"><label htmlFor="profile-roles-visibility">{t('profile.bdsmRolesVisibilityLabel')}</label><VisibilityTooltip fieldName="bdsm_roles" /></div>
              <span className="visibility-select-icon" aria-hidden="true">{visibilityIcon(bdsmRolesVisibility)}</span>
              <select
                id="profile-roles-visibility"
                aria-label={t('profile.bdsmRolesVisibilityLabel')}
                value={bdsmRolesVisibility}
                onChange={(event) => setBdsmRolesVisibility(event.target.value as Visibility)}
              >
                <option value="public">{t('profile.public')}</option>
                <option value="connections_only">{t('profile.connectionsOnly')}</option>
                <option value="private">{t('profile.private')}</option>
              </select>
              </div>
            </section>
          </>
        ) : null}
        {!loading ? (
          <div className="profile-edit-actions">
            <Link to="/profile/me" className="btn-secondary profile-edit-action">{t('profile.cancelEdit')}</Link>
            <button type="submit" className="profile-edit-action" disabled={submitting}>{submitting ? t('profile.savingProfile') : t('profile.saveProfile')}</button>
          </div>
        ) : null}
      </form>
    </Layout>
  )
}
