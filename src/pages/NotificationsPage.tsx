import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'

interface NotificationRow {
  id: string
  notification_type: 'new_event' | 'new_issue'
  event_id: string | null
  issue_id: string | null
  title: string
  read_at: string | null
  created_at: string
}

export function NotificationsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadNotifications = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, notification_type, event_id, issue_id, title, read_at, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as NotificationRow[]
    setNotifications(rows)
    const eventIds = [...new Set(rows.flatMap((row) => row.event_id ? [row.event_id] : []))]
    if (eventIds.length > 0) {
      const { data: events } = await supabase.from('events').select('id, title').in('id', eventIds)
      setEventTitles(Object.fromEntries((events ?? []).map((event) => [event.id, event.title])))
    } else {
      setEventTitles({})
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
            const content = (
              <>
                <span className="notification-dot" aria-hidden="true" />
                <span>
                  <strong>{notification.notification_type === 'new_issue' ? t('notifications.newIssue') : eventTitles[notification.event_id ?? ''] ?? notification.title}</strong>
                  <span className="notification-meta">
                    {notification.notification_type === 'new_issue' ? t('notifications.newIssue') : t('notifications.newEvent')} · {new Date(notification.created_at).toLocaleString()}
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
