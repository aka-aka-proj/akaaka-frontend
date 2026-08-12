import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { NOTIFICATIONS_CHANGED_EVENT } from '../hooks/useUnreadNotificationCount'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'

interface NotificationRow {
  id: string
  notification_type: 'new_event' | 'new_issue' | 'new_follow' | 'venue_application'
  event_id: string | null
  issue_id: string | null
  venue_application_profile_id: string | null
  actor_profile_id: string | null
  title: string
  read_at: string | null
  created_at: string
}

interface PublicProfileSummary {
  id: string
  display_name: string | null
  role_status: 'general' | 'venue_pending' | 'venue_approved'
}

export function NotificationsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({})
  const [actorNames, setActorNames] = useState<Record<string, string>>({})
  const [followedBackIds, setFollowedBackIds] = useState<Set<string>>(new Set())
  const [applicationProfiles, setApplicationProfiles] = useState<Record<string, PublicProfileSummary>>({})
  const [processingApplicationId, setProcessingApplicationId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [mfaAssuranceLevel, setMfaAssuranceLevel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadNotifications = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, notification_type, event_id, issue_id, actor_profile_id, venue_application_profile_id, title, read_at, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as NotificationRow[]
    setNotifications(rows)
    const eventIds = [...new Set(rows.flatMap((row) => row.event_id ? [row.event_id] : []))]
    const actorIds = [...new Set(rows.flatMap((row) => row.actor_profile_id ? [row.actor_profile_id] : []))]
    const applicationIds = [...new Set(rows.flatMap((row) => row.venue_application_profile_id ? [row.venue_application_profile_id] : []))]
    if (eventIds.length > 0) {
      const { data: events } = await supabase.from('events').select('id, title').in('id', eventIds)
      setEventTitles(Object.fromEntries((events ?? []).map((event) => [event.id, event.title])))
    } else {
      setEventTitles({})
    }
    if (actorIds.length > 0) {
      const actorProfileRequest = user.app_metadata?.role === 'admin'
        ? Promise.all(actorIds.map(async (profileId) => {
          const { data: profile } = await supabase.rpc('get_public_profile', { target_profile_id: profileId }).maybeSingle()
          const publicProfile = profile as { display_name?: string } | null
          return publicProfile ? { id: profileId, display_name: publicProfile.display_name ?? null } : null
        }))
        : supabase.from('profiles').select('id, display_name').in('id', actorIds).then(({ data }) => data ?? [])
      const [{ data: follows }, actorProfiles] = await Promise.all([
        supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).in('followed_id', actorIds),
        actorProfileRequest,
      ])
      setActorNames(Object.fromEntries(actorProfiles.filter(Boolean).map((profile) => [profile!.id, profile!.display_name || profile!.id])))
      setFollowedBackIds(new Set((follows ?? []).map((follow) => String(follow.followed_id))))
    } else {
      setActorNames({})
      setFollowedBackIds(new Set())
    }
    if (applicationIds.length > 0) {
      const results = await Promise.all(applicationIds.map(async (profileId) => {
        const { data: profile } = await supabase.rpc('get_public_profile', { target_profile_id: profileId }).maybeSingle()
        return profile ? [profileId, profile as PublicProfileSummary] as const : null
      }))
      setApplicationProfiles(Object.fromEntries(results.filter((entry): entry is readonly [string, PublicProfileSummary] => entry !== null)))
    } else {
      setApplicationProfiles({})
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadNotifications()
  }, [user?.id])

  useEffect(() => {
    if (user?.app_metadata?.role !== 'admin') return
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (!error) setMfaAssuranceLevel(data?.currentLevel ?? 'aal1')
    })
  }, [user?.id, user?.app_metadata?.role])

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      setMessage(error.message)
      return
    }
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
  }

  const followBack = async (notification: NotificationRow) => {
    if (!user || !notification.actor_profile_id || followedBackIds.has(notification.actor_profile_id)) return
    const { error } = await supabase.from('user_follows').insert({
      follower_id: user.id,
      followed_id: notification.actor_profile_id,
    })
    if (error) {
      setMessage(t('notifications.followBackError'))
      return
    }
    setFollowedBackIds((current) => new Set(current).add(notification.actor_profile_id!))
    setMessage(t('notifications.followBackSuccess'))
    if (!notification.read_at) void markRead(notification.id)
  }

  const reviewVenueApplication = async (notification: NotificationRow, newRole: 'general' | 'venue_approved') => {
    const targetUserId = notification.venue_application_profile_id
    if (!user || user.app_metadata?.role !== 'admin' || !targetUserId || processingApplicationId) return
    setProcessingApplicationId(notification.id)
    setMessage('')
    const { error, response } = await supabase.functions.invoke('review-venue-application', {
      body: { target_user_id: targetUserId, new_role: newRole },
    })
    if (error) {
      if (response?.status === 403) setMfaAssuranceLevel('aal1')
      setMessage(response?.status === 403 ? t('notifications.venueApplicationAal2Required') : t('notifications.venueApplicationReviewError'))
      setProcessingApplicationId(null)
      return
    }
    setApplicationProfiles((current) => ({
      ...current,
      [targetUserId]: { ...(current[targetUserId] ?? { id: targetUserId, display_name: null }), role_status: newRole },
    }))
    setMessage(newRole === 'venue_approved' ? t('notifications.venueApplicationApproved') : t('notifications.venueApplicationDenied'))
    setMfaAssuranceLevel('aal2')
    if (!notification.read_at) await markRead(notification.id)
    setProcessingApplicationId(null)
  }

  const markAllRead = async () => {
    if (!user) return
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_profile_id', user.id)
      .is('read_at', null)
    if (error) {
      setMessage(error.message)
      return
    }
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })))
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
  }

  const hasPendingVenueApplication = notifications.some((notification) => (
    notification.notification_type === 'venue_application'
    && notification.venue_application_profile_id
    && applicationProfiles[notification.venue_application_profile_id]?.role_status === 'venue_pending'
  ))

  return (
    <Layout>
      <section className="card notification-page">
        <div className="page-heading-row">
          <div>
            <h1>{t('notifications.title')}</h1>
            <p>{t('notifications.description')}</p>
            <PrivacyDisclosure label={t('privacyDisclosure.label')} description={t('privacyDisclosure.notifications')} learnMore={t('privacyDisclosure.learnMore')} />
          </div>
          <button type="button" onClick={() => void markAllRead()} disabled={!notifications.some((item) => !item.read_at)}>
            {t('notifications.markAllRead')}
          </button>
        </div>
        {user?.app_metadata?.role === 'admin' && hasPendingVenueApplication && mfaAssuranceLevel !== 'aal2' ? (
          <aside className="card" style={{ marginTop: 16 }} aria-labelledby="notification-mfa-guide-title">
            <h2 id="notification-mfa-guide-title" style={{ fontSize: 18, marginBottom: 8 }}>
              {t('notifications.venueApplicationMfaGuideTitle')}
            </h2>
            <p>{t('notifications.venueApplicationMfaGuideDescription')}</p>
            <Link className="primary-action" to="/settings/security-privacy">
              {t('notifications.venueApplicationMfaGuideLink')}
            </Link>
          </aside>
        ) : null}
        {message ? <p className="error-message">{message}</p> : null}
        {loading ? <p>{t('common.loading')}</p> : null}
        {!loading && notifications.length === 0 ? <p className="empty-state">{t('notifications.empty')}</p> : null}
        <div className="notification-list">
          {notifications.map((notification) => {
            const isFollowNotification = notification.notification_type === 'new_follow'
            const isVenueApplicationNotification = notification.notification_type === 'venue_application'
            const applicationProfile = notification.venue_application_profile_id ? applicationProfiles[notification.venue_application_profile_id] : undefined
            const actorId = notification.actor_profile_id
            const actorName = actorNames[actorId ?? ''] ?? actorId ?? notification.title
            const content = (
              <>
                <span className="notification-dot" aria-hidden="true" />
                <span>
                <strong>{isFollowNotification ? <>{t('notifications.newFollow')}: {actorId ? <Link to={`/profile/${actorId}`}>{actorName}</Link> : actorName}</> : notification.notification_type === 'new_issue' ? t('notifications.newIssue') : isVenueApplicationNotification ? t('notifications.venueApplication') : eventTitles[notification.event_id ?? ''] ?? notification.title}</strong>
                <span className="notification-meta">
                    {isFollowNotification ? t('notifications.newFollow') : notification.notification_type === 'new_issue' ? t('notifications.newIssue') : isVenueApplicationNotification ? t('notifications.venueApplication') : t('notifications.newEvent')} · {new Date(notification.created_at).toLocaleString()}
                  </span>
                </span>
              </>
            )
            return notification.event_id ? (
              <Link
                key={notification.id}
                to={`/events/${notification.event_id}`}
                className={`notification-item${notification.read_at ? '' : ' unread'}`}
                onClick={() => { if (!notification.read_at) void markRead(notification.id) }}
              >
                {content}
              </Link>
            ) : isFollowNotification ? (
              <div key={notification.id} className={`notification-item notification-follow-item${notification.read_at ? '' : ' unread'}`}>
                {content}
                <span className="notification-actions">
                  <button type="button" onClick={() => void followBack(notification)} disabled={followedBackIds.has(notification.actor_profile_id ?? '')}>
                    {followedBackIds.has(notification.actor_profile_id ?? '') ? t('notifications.followedBack') : t('notifications.followBack')}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => { if (!notification.read_at) void markRead(notification.id) }} disabled={Boolean(notification.read_at)}>
                    {t('notifications.ignoreFollow')}
                  </button>
                </span>
              </div>
            ) : isVenueApplicationNotification ? (
              <div
                key={notification.id}
                className={`notification-item notification-venue-application-item${notification.read_at ? '' : ' unread'}`}
                role="status"
                onClick={() => { if (!notification.read_at) void markRead(notification.id) }}
              >
                {content}
                <span className="notification-application-details">
                  {notification.venue_application_profile_id ? (
                    <Link
                      to={`/profile/${notification.venue_application_profile_id}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('notifications.viewApplicant')}: {applicationProfile?.display_name || notification.venue_application_profile_id}
                    </Link>
                  ) : null}
                  {user?.app_metadata?.role === 'admin' && applicationProfile?.role_status === 'venue_pending' ? (
                    <span className="notification-actions">
                      <button type="button" onClick={() => void reviewVenueApplication(notification, 'venue_approved')} disabled={processingApplicationId === notification.id}>
                        {processingApplicationId === notification.id ? t('notifications.reviewingVenueApplication') : t('notifications.approveVenueApplication')}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => void reviewVenueApplication(notification, 'general')} disabled={processingApplicationId === notification.id}>
                        {t('notifications.denyVenueApplication')}
                      </button>
                    </span>
                  ) : applicationProfile?.role_status === 'venue_approved' ? (
                    <span className="notification-application-status">{t('notifications.venueApplicationApprovedStatus')}</span>
                  ) : applicationProfile?.role_status === 'general' ? (
                    <span className="notification-application-status">{t('notifications.venueApplicationDeniedStatus')}</span>
                  ) : null}
                </span>
              </div>
            ) : (
              <div
                key={notification.id}
                className={`notification-item${notification.read_at ? '' : ' unread'}`}
                role="status"
                tabIndex={0}
                onClick={() => { if (!notification.read_at) void markRead(notification.id) }}
                onKeyDown={(event) => {
                  if ((event.key === 'Enter' || event.key === ' ') && !notification.read_at) {
                    event.preventDefault()
                    void markRead(notification.id)
                  }
                }}
              >
                {content}
              </div>
            )
          })}
        </div>
      </section>
    </Layout>
  )
}
