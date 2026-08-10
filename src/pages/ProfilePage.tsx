import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { DeleteConfirmationDialog } from '../components/DeleteConfirmationDialog'
import { ReportForm } from '../components/ReportForm'
import { VisibilityTooltip } from '../components/VisibilityTooltip'
import { ProfileShareModal } from '../components/ProfileShareModal'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { canViewBio, getAvatarPath, getBioVisibility, normalizeSocialLinks, PRESET_AVATAR_PATHS } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { BdsmRole, GenderIdentity, Profile, Visibility } from '../types'

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

function maskEmail(email: string | undefined) {
  if (!email) return ''
  const [localPart, domain] = email.split('@')
  if (!domain || localPart.length < 3) return email
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`
}

export function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, refreshProfile, identities } = useAuth()
  const { t } = useT()
  const targetProfileId = id === undefined || id === 'me' ? user?.id ?? '' : id
  const isOwner = user?.id === targetProfileId

  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarPath, setAvatarPath] = useState('/default-avatar.svg')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity | ''>('')
  const [genderIdentityVisibility, setGenderIdentityVisibility] = useState<Visibility>('public')
  const [bdsmRoles, setBdsmRoles] = useState<BdsmRole[]>([])
  const [bdsmRolesVisibility, setBdsmRolesVisibility] = useState<Visibility>('public')
  const [recommendComment, setRecommendComment] = useState('')
  const [isBlocked, setIsBlocked] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isEventNotificationSubscribed, setIsEventNotificationSubscribed] = useState(false)
  const [canMessage, setCanMessage] = useState(false)
  const [reportCount, setReportCount] = useState(0)
  const [createdEventsCount, setCreatedEventsCount] = useState(0)
  const [completedEventsCount, setCompletedEventsCount] = useState(0)
  const [joinedEventsCount, setJoinedEventsCount] = useState(0)
  const [message, setMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showUserId, setShowUserId] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const profileUrl = `${window.location.origin}/profile/${targetProfileId}`

  const xProfileUrl = useMemo(() => {
    if (isOwner && identities) {
      const twitterIdentity = identities.find(i => i.provider === 'twitter')
      return twitterIdentity?.identity_data?.user_name 
        ? `https://x.com/${twitterIdentity.identity_data.user_name}` 
        : null
    }
    
    const externalLink = profile?.external_social_links.find(l => l.platform === 'x')
    return externalLink?.url ?? null
  }, [isOwner, identities, profile])

  const bioVisibility = getBioVisibility(profile)
  const showBio = profile
    ? canViewBio(user?.id, profile.id, bioVisibility)
    : false

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
    setAvatarPath(getAvatarPath(mapped))
    setVisibility(getBioVisibility(mapped))
    setGenderIdentity(mapped?.metadata?.gender_identity ?? '')
    setGenderIdentityVisibility(mapped?.metadata?.visibility?.gender_identity ?? 'public')
    setBdsmRoles(mapped?.metadata?.bdsm_roles ?? [])
    setBdsmRolesVisibility(mapped?.metadata?.visibility?.bdsm_roles ?? 'public')
    setCanMessage(false)

    const { data: reportStats } = await supabase
      .from('profile_report_stats')
      .select('report_count')
      .eq('profile_id', targetProfileId)
      .maybeSingle()
    setReportCount(Number(reportStats?.report_count ?? 0))

    // Query created events count
    const { count: createdCount, error: createdErr } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', targetProfileId)
    if (!createdErr) setCreatedEventsCount(createdCount ?? 0)

    // Query completed events count (created events with start_time in the past)
    const { count: completedCount, error: completedErr } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', targetProfileId)
      .lt('start_time', new Date().toISOString())
    if (!completedErr) setCompletedEventsCount(completedCount ?? 0)

    // Query joined events count (approved registrations)
    const { count: joinedCount, error: joinedErr } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', targetProfileId)
      .eq('status', 'approved')
    if (!joinedErr) setJoinedEventsCount(joinedCount ?? 0)

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

      if (!isOwner) {
        const [{ data: outgoingConnection }, { data: incomingConnection }] = await Promise.all([
          supabase.from('connections').select('requester_id, receiver_id, status').eq('requester_id', user.id).eq('receiver_id', targetProfileId).eq('status', 'accepted').maybeSingle(),
          supabase.from('connections').select('requester_id, receiver_id, status').eq('requester_id', targetProfileId).eq('receiver_id', user.id).eq('status', 'accepted').maybeSingle(),
        ])
        setCanMessage(Boolean(outgoingConnection && incomingConnection))

        const { data: followData, error: followError } = await supabase
          .from('user_follows')
          .select('followed_id')
          .eq('follower_id', user.id)
          .eq('followed_id', targetProfileId)
          .maybeSingle()
        if (followError) setMessage(followError.message)
        setIsFollowing(Boolean(followData))
      }

      if (!isOwner) {
        const { data: subscription, error: subscriptionError } = await supabase
          .from('event_notification_subscriptions')
          .select('id')
          .eq('profile_id', user.id)
          .eq('creator_profile_id', targetProfileId)
          .maybeSingle()
        if (subscriptionError) setMessage(subscriptionError.message)
        setIsEventNotificationSubscribed(Boolean(subscription))
      }
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [targetProfileId, user?.id])

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

  const toggleEventNotificationSubscription = async () => {
    if (!user || isOwner || !targetProfileId) return

    const result = isEventNotificationSubscribed
      ? await supabase
        .from('event_notification_subscriptions')
        .delete()
        .eq('profile_id', user.id)
        .eq('creator_profile_id', targetProfileId)
      : await supabase
        .from('event_notification_subscriptions')
        .insert({ profile_id: user.id, creator_profile_id: targetProfileId })

    if (result.error) {
      setMessage(result.error.message)
      return
    }

    setIsEventNotificationSubscribed((current) => !current)
    setMessage(t(isEventNotificationSubscribed ? 'profile.creatorNotificationDisabled' : 'profile.creatorNotificationEnabled'))
  }

  const toggleFollow = async () => {
    if (!user || isOwner || !targetProfileId) return

    const result = isFollowing
      ? await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_id', targetProfileId)
      : await supabase
        .from('user_follows')
        .insert({ follower_id: user.id, followed_id: targetProfileId })

    if (result.error) {
      setMessage(result.error.message)
      return
    }

    setIsFollowing((current) => !current)
    setMessage(t(isFollowing ? 'profile.userUnfollowed' : 'profile.userFollowed'))
  }

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const performDeleteAccount = async () => {
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

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      // session 可能已失效，強制清除本地狀態並導向登入頁
    }
    setMessage(t('profile.signOutSuccess'))
    navigate('/auth', { replace: true })
  }

  return (
    <Layout>
      <section className="card">
        {profile ? (
          <div className="profile-header" style={{position: 'relative'}}>
            <img src={getAvatarPath(profile)} alt="" width={128} height={128} className={`avatar avatar-xl ${isOwner ? '' : 'avatar-other'}`} />
              <div className="profile-info">
                {!isOwner && (
                  <div className="profile-header-actions" style={{position: 'absolute', top: 0, right: 0}}>
                    <button className="profile-secondary-action" onClick={toggleBlock} aria-label={isBlocked ? t('profile.unblock') : t('profile.block')} title={isBlocked ? t('profile.unblock') : t('profile.block')}>
                      <Icon href="/icons.svg" name={isBlocked ? "unblock-icon" : "block-icon"} size={24} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFollow()}
                      aria-pressed={isFollowing}
                      className="profile-follow-action"
                      title={isFollowing ? t('profile.unfollow') : t('profile.follow')}
                    >
                      {isFollowing ? t('profile.unfollow') : t('profile.follow')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleEventNotificationSubscription()}
                      aria-pressed={isEventNotificationSubscribed}
                      className="profile-secondary-action profile-mute-action"
                      title={isEventNotificationSubscribed ? t('profile.disableCreatorNotifications') : t('profile.enableCreatorNotifications')}
                    >
                      {isEventNotificationSubscribed ? '🔔' : '🔕'}
                    </button>
                    {canMessage && !isBlocked ? (
                      <button type="button" onClick={() => navigate(`/messages/new?user=${targetProfileId}`)} title={t('profile.sendMessage')}>
                        {t('profile.sendMessage')}
                      </button>
                    ) : null}
                  </div>
                )}
                <div className="profile-title-row">
                <h2>
                  {profile.display_name || profile.id}
                  {user?.app_metadata?.role === 'admin' && (
                    <>
                      {' '}
                      <Link to="/admin/moderation" className="link-small">
                        ({t('admin.moderation.title')})
                      </Link>
                    </>
                  )}
                </h2>
                {isOwner && (
                  <div className="profile-title-actions">
                    <button type="button" className="btn-secondary" onClick={() => setIsShareModalOpen(true)}>
                      {t('profile.shareProfile')}
                    </button>
                    <button type="button" className="btn-secondary profile-edit-trigger" onClick={() => setIsEditing((current) => !current)}>
                      <Icon href="/action-icons.svg" name="action-edit" size={16} />
                      {isEditing ? t('profile.cancelEdit') : t('profile.editProfile')}
                    </button>
                  </div>
                )}
                </div>
              <p className="profile-role">
                <Icon href="/badge-icons.svg" name={`badge-${profile.role_status}`} size={20} />
                <span className="role-badge">{t('profile.role')}: {profile.role_status}</span>
              </p>
              <div className="profile-metrics" aria-label={t('profile.profileStats')}>
                <Link to={`/profile/${targetProfileId}/feedback`} className="metric-card">
                  <strong>{profile.reputation_score}</strong>
                  <span><Icon href="/badge-icons.svg" name="reputation-star" size={15} /> {t('profile.reputation')}</span>
                </Link>
                <Link to={`/profile/${targetProfileId}/reports`} aria-label={`${t('profile.reports')}: ${reportCount}`} className={`metric-card ${reportCount === 0 ? 'metric-muted' : ''}`}>
                  <strong>{reportCount}</strong>
                  <span><Icon href="/report-icons.svg" name="report-safety-risk" size={15} /> {t('profile.reports')}</span>
                </Link>
                <div className="metric-card">
                  <strong>{createdEventsCount}</strong>
                  <span><Icon href="/form-icons.svg" name="form-calendar" size={15} /> {t('profile.createdEvents')}</span>
                </div>
                <div className="metric-card">
                  <strong>{completedEventsCount}</strong>
                  <span><Icon href="/form-icons.svg" name="form-calendar" size={15} /> {t('profile.completedEvents')}</span>
                </div>
                <div className="metric-card">
                  <strong>{joinedEventsCount}</strong>
                  <span><Icon href="/action-icons.svg" name="action-thumbsup" size={15} /> {t('profile.joinedEvents')}</span>
                </div>
              </div>
              <div className="profile-attributes">
                {profile.metadata?.gender_identity ? (
                  <div className="profile-attribute">
                    <span className="attribute-label">{t('profile.genderIdentityLabel')}</span>
                    <span className="profile-chip">
                      {t(`profile.genderIdentity${profile.metadata.gender_identity.charAt(0).toUpperCase() + profile.metadata.gender_identity.slice(1)}` as any)}
                    </span>
                  </div>
                ) : null}
                {profile.metadata?.bdsm_roles && profile.metadata.bdsm_roles.length > 0 ? (
                  <div className="profile-attribute">
                    <span className="attribute-label">{t('profile.bdsmRolesLabel')}</span>
                    <div className="profile-chip-list">
                      {profile.metadata.bdsm_roles.map((r) => (
                        <span className="profile-chip" key={r}>
                          {t(`profile.bdsmRole${r.charAt(0).toUpperCase() + r.slice(1).replace(/\s+/g, '')}` as any)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <p>
                {t('profile.bio')}:{' '}
                {showBio
                  ? profile.bio ? profile.bio : (
                    <>
                      <span>{t('profile.noBio')}</span>
                      {isOwner && (
                        <button type="button" className="btn-link-inline" onClick={() => setIsEditing(true)}>
                          {t('profile.addBio')}
                        </button>
                      )}
                    </>
                  )
                  : t('profile.hidden', { visibility: bioVisibility })}
              </p>
              <ul className="social-links-list">
                {profile.external_social_links.map((link) => (
                  <li key={`${link.platform}-${link.url}`} className="social-link-item">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.platform}>
                      <Icon href="/social-icons.svg" name={`social-${link.platform}`} size={32} />
                    </a>
                  </li>
                ))}
                {xProfileUrl && (
                  <li className="social-link-item">
                    <a href={xProfileUrl} target="_blank" rel="noopener noreferrer" aria-label="X">
                      <Icon href="/social-icons.svg" name="social-x" size={32} />
                    </a>
                  </li>
                )}
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
        <section className="card login-info-card">
          <h3>{t('profile.loginInfo')}</h3>
          <p className="login-info-private">{t('profile.loginInfoPrivate')}</p>
          <dl>
            <dt>{t('profile.loginInfoUserId')}</dt>
            <dd className="sensitive-value">
              <span>{showUserId ? user?.id : `${user?.id?.slice(0, 8)}…${user?.id?.slice(-4)}`}</span>
              <button type="button" className="btn-quiet" onClick={() => setShowUserId((current) => !current)} aria-label={showUserId ? t('profile.hideUserId') : t('profile.showUserId')}>
                <Icon href="/form-icons.svg" name={showUserId ? 'form-lock' : 'form-eye'} size={16} />
              </button>
            </dd>
            <dt>{t('profile.loginInfoEmail')}</dt>
            <dd className="sensitive-value">
              <span>{showEmail ? user?.email : maskEmail(user?.email)}</span>
              <button type="button" className="btn-quiet" onClick={() => setShowEmail((current) => !current)} aria-label={showEmail ? t('profile.hideEmail') : t('profile.showEmail')}>
                <Icon href="/form-icons.svg" name={showEmail ? 'form-lock' : 'form-eye'} size={16} />
              </button>
            </dd>
            <dt>{t('profile.connectedAccounts')}</dt>
            <dd>
              {identities && identities.length > 0 
                ? identities.map(i => i.provider).join(', ') 
                : t('profile.noConnectedAccounts')}
            </dd>
          </dl>
          <button type="button" onClick={() => void handleSignOut()}>
            {t('nav.signOut')}
          </button>
        </section>

        {isEditing && <form className="card profile-edit-form" onSubmit={saveProfile}>
          <h3>{t('profile.editProfile')}</h3>
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
            {(['dom', 'sub', 'switch', 'master', 'slave', 'owner', 'pet', 'brat', 'rigging'] as BdsmRole[]).map((role) => (
              <label key={role} className={`role-chip ${bdsmRoles.includes(role) ? 'selected' : ''}`}>
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
            <button type="submit">{t('profile.saveProfile')}</button>
            <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>{t('profile.cancelEdit')}</button>
          </div>
        </form>}

        <section className="card danger-zone">
          <h3>{t('profile.deleteAccount')}</h3>
          <button type="button" className="btn-danger" onClick={() => setIsDeleteModalOpen(true)}>
            <Icon href="/action-icons.svg" name="action-trash" size={16} /> {t('profile.deleteAccount')}
          </button>
        </section>
        <DeleteConfirmationDialog
          isOpen={isDeleteModalOpen}
          title={t('profile.deleteAccount')}
          description={t('profile.deleteAccountConfirm')}
          confirmationPhrase="DELETE"
          confirmationLabel={t('profile.deleteAccountConfirmationLabel')}
          confirmationPlaceholder={t('profile.deleteAccountConfirmationPlaceholder')}
          confirmLabel={t('profile.deleteAccount')}
          onConfirm={() => {
            setIsDeleteModalOpen(false)
            void performDeleteAccount()
          }}
          onCancel={() => setIsDeleteModalOpen(false)}
        />
        </>
      ) : (
        <section className="card trust-actions-card">
          <h3>{t('profile.trustActions')}</h3>
          <textarea
            aria-label={t('profile.recommendationCommentLabel')}
            placeholder={t('profile.recommendationCommentFor', { name: profile?.display_name || t('profile.title') })}
            value={recommendComment}
            onChange={(event) => setRecommendComment(event.target.value)}
          />
          <button
            type="button"
            className="primary-action"
            onClick={() => void recommend()}
            disabled={user?.id === targetProfileId}
          >
            <Icon href="/action-icons.svg" name="action-thumbsup" size={16} /> {t('profile.giveRecommendation')}
          </button>
          {user?.id === targetProfileId ? (
            <p className="message">{t('profile.cannotRecommendSelf')}</p>
          ) : null}
        </section>
      )}

      {!isOwner && targetProfileId ? <ReportForm targetProfileId={targetProfileId} collapsible /> : null}
      {isShareModalOpen && profile ? (
        <ProfileShareModal
          profileUrl={profileUrl}
          profileName={profile.display_name || profile.id}
          onClose={() => setIsShareModalOpen(false)}
          onMessage={setMessage}
        />
      ) : null}
    </Layout>
  )
}
