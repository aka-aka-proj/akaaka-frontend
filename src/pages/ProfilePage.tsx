import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { DeleteConfirmationDialog } from '../components/DeleteConfirmationDialog'
import { ReportForm } from '../components/ReportForm'
import { ProfileShareModal } from '../components/ProfileShareModal'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { canViewBio, getAvatarPath, getBioVisibility, mapProfileRow } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import type { UserIdentity } from '@supabase/supabase-js'

function maskEmail(email: string | undefined) {
  if (!email) return ''
  const [localPart, domain] = email.split('@')
  if (!domain || localPart.length < 3) return email
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`
}

export function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, identities, refreshProfile } = useAuth()
  const { t } = useT()
  const targetProfileId = id === undefined || id === 'me' ? user?.id ?? '' : id
  const isOwner = user?.id === targetProfileId

  const [profile, setProfile] = useState<Profile | null>(null)
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
  const [showUserId, setShowUserId] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [connectedIdentities, setConnectedIdentities] = useState<UserIdentity[]>(identities ?? [])
  const [identityToUnlink, setIdentityToUnlink] = useState<UserIdentity | null>(null)
  const [isUnlinkingIdentity, setIsUnlinkingIdentity] = useState(false)
  const [isSubmittingVenueApplication, setIsSubmittingVenueApplication] = useState(false)
  const profileUrl = `${window.location.origin}/profile/${targetProfileId}`

  useEffect(() => {
    setConnectedIdentities(identities ?? [])
  }, [identities])

  const primaryIdentity = useMemo(() => {
    if (connectedIdentities.length === 0) return null
    return connectedIdentities.reduce((primary, identity) => {
      if (!identity.created_at || !primary.created_at) return primary
      return identity.created_at < primary.created_at ? identity : primary
    }, connectedIdentities[0])
  }, [connectedIdentities])

  const xProfileUrl = useMemo(() => {
    if (isOwner && connectedIdentities) {
      const twitterIdentity = connectedIdentities.find(i => i.provider === 'twitter' || i.provider === 'x')
      return twitterIdentity?.identity_data?.user_name 
        ? `https://x.com/${twitterIdentity.identity_data.user_name}` 
        : null
    }
    
    const externalLink = profile?.external_social_links.find(l => l.platform === 'x')
    return externalLink?.url ?? null
  }, [isOwner, connectedIdentities, profile])

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
          supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).eq('followed_id', targetProfileId).maybeSingle(),
          supabase.from('user_follows').select('follower_id').eq('follower_id', targetProfileId).eq('followed_id', user.id).maybeSingle(),
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

  const requestVenueApplication = async () => {
    if (!user || !isOwner || profile?.role_status !== 'general') return
    setIsSubmittingVenueApplication(true)
    setMessage('')
    const { error, response } = await supabase.functions.invoke('request-venue-application')
    if (error) {
      if (response?.status === 409) setMessage(t('profile.venueApplicationAlreadyPending'))
      else setMessage(t('profile.venueApplicationError'))
      setIsSubmittingVenueApplication(false)
      return
    }
    setMessage(t('profile.venueApplicationSubmitted'))
    await refreshProfile()
    await loadProfile()
    setIsSubmittingVenueApplication(false)
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

  const unlinkIdentity = async () => {
    if (!identityToUnlink || isUnlinkingIdentity) return

    setIsUnlinkingIdentity(true)
    const targetIdentityId = identityToUnlink.identity_id

    try {
      const { data: latestData, error: latestError } = await supabase.auth.getUserIdentities()
      if (latestError) {
        setMessage(t('profile.unlinkAccountError'))
        return
      }

      const latestIdentities = latestData.identities
      const latestPrimaryIdentity = latestIdentities.reduce<UserIdentity | null>((primary, identity) => {
        if (!primary) return identity
        if (!identity.created_at || !primary.created_at) return primary
        return identity.created_at < primary.created_at ? identity : primary
      }, null)
      const latestTargetIdentity = latestIdentities.find(identity => identity.identity_id === targetIdentityId)

      if (!latestTargetIdentity || latestTargetIdentity.identity_id === latestPrimaryIdentity?.identity_id) {
        setConnectedIdentities(latestIdentities)
        setIdentityToUnlink(null)
        setMessage(t('profile.unlinkAccountAlreadyDone'))
        return
      }

      const { error } = await supabase.auth.unlinkIdentity(latestTargetIdentity)
      if (error) {
        const { data: reconciledData } = await supabase.auth.getUserIdentities()
        const stillExists = reconciledData?.identities.some(identity => identity.identity_id === targetIdentityId)
        if (error.status === 404 && !stillExists) {
          setConnectedIdentities(reconciledData?.identities ?? [])
          setIdentityToUnlink(null)
          setMessage(t('profile.unlinkAccountAlreadyDone'))
        } else {
          setMessage(t('profile.unlinkAccountError'))
        }
        return
      }

      setConnectedIdentities((current) => current.filter(identity => identity.identity_id !== targetIdentityId))
      setMessage(t('profile.unlinkAccountSuccess', { provider: latestTargetIdentity.provider }))
      setIdentityToUnlink(null)
    } finally {
      setIsUnlinkingIdentity(false)
    }
  }

  return (
    <Layout>
      <section className="card">
        {profile ? (
          <div className="profile-header" style={{position: 'relative'}}>
            <img src={getAvatarPath(profile)} alt="" width={128} height={128} className={`avatar avatar-xl ${isOwner ? '' : 'avatar-other'}`} />
              <div className="profile-info">
                {!isOwner && (
                  <div className="profile-header-actions">
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
                      aria-label={isEventNotificationSubscribed ? t('profile.disableCreatorNotifications') : t('profile.enableCreatorNotifications')}
                    >
                      <Icon href="/action-icons.svg" name={isEventNotificationSubscribed ? 'action-bell' : 'action-bell-off'} size={20} />
                    </button>
                    {canMessage && !isBlocked ? (
                      <button
                        type="button"
                        className="profile-message-action"
                        onClick={() => navigate(`/messages/new?user=${targetProfileId}`)}
                        title={t('profile.sendMessage')}
                      >
                        <Icon href="/nav-icons.svg" name="nav-message" size={18} />
                        {t('profile.sendMessage')}
                      </button>
                    ) : null}
                    <div className="profile-more-menu">
                      <button
                        type="button"
                        className="profile-secondary-action"
                        aria-label={t('profile.moreOptions')}
                        title={t('profile.moreOptions')}
                        aria-expanded={isMoreMenuOpen}
                        aria-controls="profile-more-options"
                        onClick={() => setIsMoreMenuOpen((current) => !current)}
                      >
                        <Icon href="/nav-icons.svg" name="nav-more" size={20} />
                      </button>
                      {isMoreMenuOpen ? (
                        <div id="profile-more-options" className="profile-more-menu__items" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setIsMoreMenuOpen(false); void toggleBlock() }}>
                            <Icon href="/action-icons.svg" name="action-block" size={18} />
                            {isBlocked ? t('profile.unblock') : t('profile.block')}
                          </button>
                          <Link role="menuitem" to={`/profile/${targetProfileId}/reports`} onClick={() => setIsMoreMenuOpen(false)}>
                            <Icon href="/report-icons.svg" name="report-safety-risk" size={18} />
                            {t('profile.reportUser')}
                          </Link>
                        </div>
                      ) : null}
                    </div>
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
                    <button type="button" className="btn-secondary profile-title-action" onClick={() => setIsShareModalOpen(true)}>
                      {t('profile.shareProfile')}
                    </button>
                    <Link to="/profile/me/edit" className="btn-secondary profile-title-action profile-edit-trigger">
                      <Icon href="/action-icons.svg" name="action-edit" size={16} />
                      {t('profile.editProfile')}
                    </Link>
                  </div>
                )}
                </div>
              <p className="profile-role">
                <Icon href="/badge-icons.svg" name={`badge-${profile.role_status}`} size={20} />
                <span className="role-badge">{t('profile.role')}: {profile.role_status}</span>
              </p>
              {isOwner && profile.role_status !== 'venue_approved' ? (
                <section className="venue-application-card" aria-labelledby="venue-application-heading">
                  <h3 id="venue-application-heading">{t('profile.venueApplicationHeading')}</h3>
                  <p>
                    {profile.role_status === 'venue_pending'
                      ? t('profile.venueApplicationPendingDescription')
                      : t('profile.venueApplicationDescription')}
                  </p>
                  {profile.role_status === 'general' ? (
                    <button type="button" onClick={() => void requestVenueApplication()} disabled={isSubmittingVenueApplication}>
                      {isSubmittingVenueApplication ? t('profile.venueApplicationSubmitting') : t('profile.venueApplicationButton')}
                    </button>
                  ) : null}
                </section>
              ) : null}
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
                        <Link to="/profile/me/edit" className="btn-link-inline">
                          {t('profile.addBio')}
                        </Link>
                      )}
                    </>
                  )
                  : t('profile.hidden', { visibility: bioVisibility })}
              </p>
              <ul className="social-links-list">
                {profile.external_social_links
                  .filter((link) => link.platform !== 'x' || !xProfileUrl)
                  .map((link) => (
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
              {connectedIdentities.length > 0 ? (
                <ul className="connected-accounts-list">
                  {connectedIdentities.map((identity) => {
                    const isPrimary = identity.identity_id === primaryIdentity?.identity_id
                    return (
                      <li key={identity.identity_id}>
                        <span>{identity.provider}</span>
                        {isPrimary ? (
                          <span className="connected-account-primary">{t('profile.primaryConnectedAccount')}</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-quiet"
                            onClick={() => setIdentityToUnlink(identity)}
                            aria-label={t('profile.unlinkAccount', { provider: identity.provider })}
                          >
                            {t('profile.unlinkAccountAction')}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : t('profile.noConnectedAccounts')}
            </dd>
          </dl>
          <button type="button" onClick={() => void handleSignOut()}>
            {t('nav.signOut')}
          </button>
        </section>

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
        <DeleteConfirmationDialog
          isOpen={identityToUnlink !== null}
          title={t('profile.unlinkAccountTitle')}
          description={t('profile.unlinkAccountConfirm', { provider: identityToUnlink?.provider ?? '' })}
          confirmLabel={t('profile.unlinkAccountAction')}
          confirmDisabled={isUnlinkingIdentity}
          onConfirm={() => void unlinkIdentity()}
          onCancel={() => setIdentityToUnlink(null)}
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
