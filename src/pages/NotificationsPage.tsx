import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'

interface NotificationRow {
  id: string
  event_id: string
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
      .select('id, event_id, title, read_at, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as NotificationRow[]
    setNotifications(rows)
    const eventIds = [...new Set(rows.map((row) => row.event_id))]
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
          </div>
          <button type="button" onClick={() => void markAllRead()} disabled={!notifications.some((item) => !item.read_at)}>
            {t('notifications.markAllRead')}
          </button>
        </div>
        {message ? <p className="error-message">{message}</p> : null}
        {loading ? <p>{t('common.loading')}</p> : null}
        {!loading && notifications.length === 0 ? <p className="empty-state">{t('notifications.empty')}</p> : null}
        <div className="notification-list">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              to={`/events/${notification.event_id}`}
              className={`notification-item${notification.read_at ? '' : ' unread'}`}
              onClick={() => { if (!notification.read_at) void markRead(notification.id) }}
            >
              <span className="notification-dot" aria-hidden="true" />
              <span>
                <strong>{eventTitles[notification.event_id] ?? notification.title}</strong>
                <span className="notification-meta">
                  {t('notifications.newEvent')} · {new Date(notification.created_at).toLocaleString()}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  )
}
