import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { ReportForm } from '../components/ReportForm'
import { useAuth } from '../context/AuthContext'
import { useIconTheme } from '../context/IconThemeContext'
import { useT } from '../hooks/useT'
import { canViewBio, getBioVisibility, normalizeSocialLinks } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { BdsmRole, GenderIdentity, Profile, SocialLink, Visibility } from '../types'

const createSocialLink = (): SocialLink => ({ platform: 'facebook', url: '' })

function mapProfileRow(row: unknown): Profile {
  const source = (row ?? {}) as Record<string, unknown>
  return {
    id: String(source.id ?? ''),
    role_status: (source.role_status as Profile['role_status']) ?? 'general',
    display_name: (source.display_name as string | null) ?? null,
    bio: (source.bio as string | null) ?? null,
    external_social_links: normalizeSocialLinks(source.external_social_links),
    metadata: (source.metadata as Profile['metadata']) ?? null,
    reputation_score: Number(source.reputation_score ?? 0),
  }
}

export function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const { iconTheme, setIconTheme, syncFromProfile } = useIconTheme()
  const { t } = useT()
  const targetProfileId = id === undefined || id === 'me' ? user?.id ?? '' : id
  const isOwner = user?.id === targetProfileId
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity | ''>('')
  const [genderIdentityVisibility, setGenderIdentityVisibility] = useState<Visibility>('public')
  const [bdsmRoles, setBdsmRoles] = useState<BdsmRole[]>([])
  const [bdsmRolesVisibility, setBdsmRolesVisibility] = useState<Visibility>('public')
  const [recommendComment, setRecommendComment] = useState('')
  const [isBlocked, setIsBlocked] = useState(false)
  const [reportCount, setReportCount] = useState(0)
  const [message, setMessage] = useState('')

  const bioVisibility = getBioVisibility(profile)
  const showBio = profile
    ? canViewBio(user?.id, profile.id, bioVisibility)
    : false

  const socialLinksForView = useMemo(
    () => socialLinks.filter((item) => item.url.trim().length > 0),
    [socialLinks],
  )

  const loadProfile = async () => {
    if (!targetProfileId) {
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetProfileId)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      return
    }

    const mapped = data ? mapProfileRow(data) : null
    setProfile(mapped)
    setDisplayName(mapped?.display_name ?? '')
    setBio(mapped?.bio ?? '')
    setVisibility(getBioVisibility(mapped))
    setSocialLinks(mapped?.external_social_links ?? [createSocialLink()])
    setGenderIdentity(mapped?.metadata?.gender_identity ?? '')
    setGenderIdentityVisibility(mapped?.metadata?.visibility?.gender_identity ?? 'public')
    setBdsmRoles(mapped?.metadata?.bdsm_roles ?? [])
    setBdsmRolesVisibility(mapped?.metadata?.visibility?.bdsm_roles ?? 'public')

    const { data: reportStats } = await supabase
      .from('profile_report_stats')
      .select('report_count')
      .eq('profile_id', targetProfileId)
      .maybeSingle()
    setReportCount(Number(reportStats?.report_count ?? 0))

    if (mapped && isOwner) {
      syncFromProfile(mapped)
    }

    if (user && targetProfileId) {
      const { data: blockData, error: blockError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetProfileId)
        .maybeSingle()

      if (blockError) {
        setMessage(blockError.message)
      } else {
        setIsBlocked(Boolean(blockData))
      }
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [targetProfileId, user?.id])

  const updateLink = (index: number, patch: Partial<SocialLink>) => {
    setSocialLinks((links) =>
      links.map((link, current) => (current === index ? { ...link, ...patch } : link)),
    )
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isOwner || !user) {
      return
    }

    const { data: currentRow } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', user.id)
      .maybeSingle()

    const existingMeta = (currentRow?.metadata as Record<string, unknown>) ?? {}

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        external_social_links: socialLinksForView,
        metadata: {
          ...existingMeta,
          visibility: {
            bio: visibility || 'public',
            gender_identity: genderIdentityVisibility || 'public',
            bdsm_roles: bdsmRolesVisibility || 'public',
          },
          gender_identity: genderIdentity || null,
          bdsm_roles: bdsmRoles.length > 0 ? bdsmRoles : null,
          icon_theme: iconTheme,
        },
      })
      .eq('id', user.id)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(t('profile.profileUpdated'))
    await refreshProfile()
    await loadProfile()
  }

  const recommend = async () => {
    if (!user || !targetProfileId) {
      return
    }

    if (user.id === targetProfileId) {
      setMessage(t('profile.cannotRecommendSelf'))
      return
    }

    const { error, response } = await supabase.functions.invoke('create-recommendation', {
      body: {
        to_profile_id: targetProfileId,
        comment: recommendComment.trim() || undefined,
      },
    })

    if (error) {
      if (response?.status === 429) {
        setMessage(t('profile.recommendRateLimit'))
      } else {
        setMessage(t('profile.errorOccurred'))
      }
      return
    }

    setRecommendComment('')
    setMessage(t('profile.recommendationSubmitted'))
    await loadProfile()
  }

  const toggleBlock = async () => {
    if (!user || !targetProfileId || user.id === targetProfileId) {
      return
    }

    if (isBlocked) {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetProfileId)
      if (error) {
        setMessage(error.message)
        return
      }

      setIsBlocked(false)
      setMessage(t('profile.userUnblocked'))
      return
    }

    const { error } = await supabase.from('blocks').insert([
      { blocker_id: user.id, blocked_id: targetProfileId },
    ])
    if (error) {
      setMessage(error.message)
      return
    }

    setIsBlocked(true)
    setMessage(t('profile.userBlocked'))
  }

  const deleteAccount = async () => {
    if (!user) {
      return
    }

    if (!window.confirm(t('profile.deleteAccountConfirm'))) {
      return
    }

    const { error } = await supabase.functions.invoke('delete-account')

    if (error) {
      setMessage(t('profile.deleteAccountError'))
      return
    }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      // session 可能已失效，強制導向登入頁
    }
    setMessage(t('profile.deleteAccountSuccess'))
    navigate('/auth', { replace: true })
  }

  return (
    <Layout title={t('profile.title')}>
      <section className="card">
        {profile ? (
          <div className="profile-header" style={{position: 'relative'}}>
            <img src="/default-avatar.svg" alt="" width={128} height={128} className="avatar avatar-xl" />
            <div className="profile-info">
              <div className="profile-header-actions" style={{position: 'absolute', top: 0, right: 0}}>
                <button onClick={toggleBlock} aria-label={isBlocked ? t('profile.unblock') : t('profile.block')} title={isBlocked ? t('profile.unblock') : t('profile.block')}>
                  <Icon href="/icons.svg" name={isBlocked ? "unblock-icon" : "block-icon"} size={24} />
                </button>
              </div>
              <h2>{profile.display_name || profile.id}</h2>
              <p className="profile-role">
                <Icon href="/badge-icons.svg" name={`badge-${profile.role_status}`} size={20} />
                {' '}{t('profile.role')}: {profile.role_status}
              </p>
              <p className="profile-reputation">
                <Link to={`/profile/${targetProfileId}/reputation`}>
                  <Icon href="/badge-icons.svg" name="reputation-star" size={16} />
                  {' '}{t('profile.reputation')}: {profile.reputation_score}
                </Link>
                {' '}
                <Link to={`/profile/${targetProfileId}/feedback`} className="link-small">
                  ({t('profile.viewFeedback')})
                </Link>
                {' '}
                <Link to={`/profile/${targetProfileId}/reports`} className="link-small">
                  ({t('profile.viewReports')})
                </Link>
              </p>
              <p className="profile-reports">
                <Icon href="/report-icons.svg" name="report-safety-risk" size={16} />
                {' '}{t('profile.reports')}: {reportCount}
              </p>
              {profile.metadata?.gender_identity ? (
                <p>
                  {t('profile.genderIdentityLabel')}:{' '}
                  {t(`profile.genderIdentity${profile.metadata.gender_identity.charAt(0).toUpperCase() + profile.metadata.gender_identity.slice(1)}` as any)}
                </p>
              ) : null}
              {profile.metadata?.bdsm_roles && profile.metadata.bdsm_roles.length > 0 ? (
                <p>
                  {t('profile.bdsmRolesLabel')}:{' '}
                  {profile.metadata.bdsm_roles.map((r) => t(`profile.bdsmRole${r.charAt(0).toUpperCase() + r.slice(1).replace(/\s+/g, '')}` as any)).join(', ')}
                </p>
              ) : null}
              <p>
                {t('profile.bio')}:{' '}
                {showBio
                  ? profile.bio || t('profile.noBio')
                  : t('profile.hidden', { visibility: bioVisibility })}
              </p>
              <ul className="social-links-list">
                {profile.external_social_links.map((link) => (
                  <li key={`${link.platform}-${link.url}`} className="social-link-item">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.platform}>
                      <Icon href="/icons.svg" name={`${link.platform}-icon`} size={32} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <img src="/illustration-empty-profile.svg" alt="" width={400} height={280} className="illustration" />
            <p>{t('profile.notFound')}</p>
          </div>
        )}
        {message ? (
          <p className="message">
            {message}{' '}
            <Link to={`/issues/new?title=profile-error&description=${encodeURIComponent(message)}`}>
              {t('issues.reportThisIssue')}
            </Link>
          </p>
        ) : null}
      </section>

      {isOwner ? (
        <>
        <section className="card">
          <h3>{t('profile.loginInfo')}</h3>
          <p className="login-info-private">{t('profile.loginInfoPrivate')}</p>
          <dl>
            <dt>{t('profile.loginInfoUserId')}</dt>
            <dd>{user?.id}</dd>
            <dt>{t('profile.loginInfoEmail')}</dt>
            <dd>{user?.email}</dd>
          </dl>
        </section>

        <form className="card" onSubmit={saveProfile}>
          <h3>{t('profile.editProfile')}</h3>
          <label>
            {t('profile.displayNameLabel')}
            <input
              aria-label={t('profile.displayNameLabel')}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
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
          </label>
          <fieldset>
            <legend>{t('profile.bdsmRolesLabel')}</legend>
            {(['dom', 'sub', 'switch', 'master', 'slave', 'owner', 'pet', 'brat', 'rope_bunny', 'rigging'] as BdsmRole[]).map((role) => (
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
                {t(`profile.bdsmRole${role.charAt(0).toUpperCase() + role.slice(1).replace(/\s+/g, '')}` as any)}
              </label>
            ))}
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
          </label>
          <section>
            <h4>{t('profile.socialLinks')}</h4>
            {socialLinks.map((link, index) => (
              <div className="row" key={`owner-social-${index}`}>
                <select
                  aria-label={t('profile.socialPlatform', { index: index + 1 })}
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
                  aria-label={t('profile.socialUrl', { index: index + 1 })}
                  value={link.url}
                  placeholder="https://..."
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                />
              </div>
            ))}
            <button type="button" onClick={() => setSocialLinks((links) => [...links, createSocialLink()])}>
              <Icon href="/action-icons.svg" name="action-plus" size={16} /> {t('profile.addSocialLink')}
            </button>
          </section>
          <button type="submit">{t('profile.saveProfile')}</button>
        </form>

        <section className="card">
          <h3>{t('profile.iconTheme')}</h3>
          <label>
            {t('profile.iconThemeLabel')}
            <select
              aria-label={t('profile.iconThemeLabel')}
              value={iconTheme}
              onChange={(event) => setIconTheme(event.target.value as 'purple' | 'red')}
            >
              <option value="purple">{t('profile.iconThemePurple')}</option>
              <option value="red">{t('profile.iconThemeRed')}</option>
            </select>
          </label>
        </section>

        <section className="card danger-zone">
          <h3>{t('profile.deleteAccount')}</h3>
          <button type="button" className="btn-danger" onClick={() => void deleteAccount()}>
            <Icon href="/action-icons.svg" name="action-trash" size={16} /> {t('profile.deleteAccount')}
          </button>
        </section>
        </>
      ) : (
        <section className="card">
          <h3>{t('profile.trustActions')}</h3>
          <button
            type="button"
            onClick={() => void recommend()}
            disabled={user?.id === targetProfileId}
          >
            <Icon href="/action-icons.svg" name="action-thumbsup" size={16} /> {t('profile.giveRecommendation')}
          </button>
          <textarea
            aria-label={t('profile.recommendationCommentLabel')}
            placeholder={t('profile.recommendationCommentPlaceholder')}
            value={recommendComment}
            onChange={(event) => setRecommendComment(event.target.value)}
          />
          {user?.id === targetProfileId ? (
            <p className="message">{t('profile.cannotRecommendSelf')}</p>
          ) : null}
        </section>
      )}

      {!isOwner && targetProfileId ? <ReportForm targetProfileId={targetProfileId} /> : null}
    </Layout>
  )
}
