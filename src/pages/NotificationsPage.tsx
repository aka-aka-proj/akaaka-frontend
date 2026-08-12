import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
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
      const [{ data: profiles }, { data: follows }] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', actorIds),
        supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).in('followed_id', actorIds),
      ])
      setActorNames(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.id])))
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
      setMessage(response?.status === 403 ? t('notifications.venueApplicationAal2Required') : t('notifications.venueApplicationReviewError'))
      setProcessingApplicationId(null)
      return
    }
    setApplicationProfiles((current) => ({
      ...current,
      [targetUserId]: { ...(current[targetUserId] ?? { id: targetUserId, display_name: null }), role_status: newRole },
    }))
    setMessage(newRole === 'venue_approved' ? t('notifications.venueApplicationApproved') : t('notifications.venueApplicationDenied'))
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
  }

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
        {message ? <p className="error-message">{message}</p> : null}
        {loading ? <p>{t('common.loading')}</p> : null}
        {!loading && notifications.length === 0 ? <p className="empty-state">{t('notifications.empty')}</p> : null}
        <div className="notification-list">
          {notifications.map((notification) => {
            const isFollowNotification = notification.notification_type === 'new_follow'
            const isVenueApplicationNotification = notification.notification_type === 'venue_application'
            const applicationProfile = notification.venue_application_profile_id ? applicationProfiles[notification.venue_application_profile_id] : undefined
            const actorName = actorNames[notification.actor_profile_id ?? ''] ?? notification.title
            const content = (
              <>
                <span className="notification-dot" aria-hidden="true" />
                <span>
                <strong>{isFollowNotification ? `${t('notifications.newFollow')}: ${actorName}` : notification.notification_type === 'new_issue' ? t('notifications.newIssue') : isVenueApplicationNotification ? t('notifications.venueApplication') : eventTitles[notification.event_id ?? ''] ?? notification.title}</strong>
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
