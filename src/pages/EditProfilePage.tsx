import { useEffect, useState } from 'react'
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
          <Link to="/profile/me" className="btn-secondary">
            {t('profile.cancelEdit')}
          </Link>
        </div>
        {loading ? <p>{t('common.loading')}</p> : null}
        {message ? <p className="message">{message}</p> : null}
        {!loading ? (
          <>
            <label>
              {t('profile.displayNameLabel')}
              <input
                aria-label={t('profile.displayNameLabel')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <fieldset>
              <legend>{t('profile.avatarLabel')}</legend>
              <div className="avatar-picker">
                <label className="avatar-option">
                  <input
                    type="radio"
                    name="profile-avatar"
                    value="/default-avatar.svg"
                    checked={avatarPath === '/default-avatar.svg'}
                    onChange={() => setAvatarPath('/default-avatar.svg')}
                  />
                  <img src="/default-avatar.svg" alt={t('profile.defaultAvatar')} className="avatar avatar-lg" />
                  <span>{t('profile.defaultAvatar')}</span>
                </label>
                {PRESET_AVATAR_PATHS.map((path) => (
                  <label className="avatar-option" key={path}>
                    <input
                      type="radio"
                      name="profile-avatar"
                      value={path}
                      checked={avatarPath === path}
                      onChange={() => setAvatarPath(path)}
                    />
                    <img src={path} alt="" className="avatar avatar-lg" />
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              {t('profile.bioLabel')}
              <textarea
                aria-label={t('profile.bioLabel')}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </label>
            <label>
              {t('profile.bioVisibilityLabel')}
              <select
                aria-label={t('profile.bioVisibilityLabel')}
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as Visibility)}
              >
                <option value="public">{t('profile.public')}</option>
                <option value="connections_only">{t('profile.connectionsOnly')}</option>
                <option value="private">{t('profile.private')}</option>
              </select>
              <VisibilityTooltip fieldName="bio" />
            </label>
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
            <label>
              {t('profile.genderIdentityVisibilityLabel')}
              <select
                aria-label={t('profile.genderIdentityVisibilityLabel')}
                value={genderIdentityVisibility}
                onChange={(event) => setGenderIdentityVisibility(event.target.value as Visibility)}
              >
                <option value="public">{t('profile.public')}</option>
                <option value="connections_only">{t('profile.connectionsOnly')}</option>
                <option value="private">{t('profile.private')}</option>
              </select>
              <VisibilityTooltip fieldName="gender_identity" />
            </label>
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
            <label>
              {t('profile.bdsmRolesVisibilityLabel')}
              <select
                aria-label={t('profile.bdsmRolesVisibilityLabel')}
                value={bdsmRolesVisibility}
                onChange={(event) => setBdsmRolesVisibility(event.target.value as Visibility)}
              >
                <option value="public">{t('profile.public')}</option>
                <option value="connections_only">{t('profile.connectionsOnly')}</option>
                <option value="private">{t('profile.private')}</option>
              </select>
              <VisibilityTooltip fieldName="bdsm_roles" />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? t('profile.savingProfile') : t('profile.saveProfile')}
              </button>
              <Link to="/profile/me" className="btn-secondary">
                {t('profile.cancelEdit')}
              </Link>
            </div>
          </>
        ) : null}
      </form>
    </Layout>
  )
}
