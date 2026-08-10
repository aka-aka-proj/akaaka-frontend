import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { EVENT_TYPES } from '../lib/event-types'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'

export function NotificationSettingsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [subscribedTypes, setSubscribedTypes] = useState<string[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    void supabase
      .from('event_notification_subscriptions')
      .select('event_type')
      .eq('profile_id', user.id)
      .not('event_type', 'is', null)
      .then(({ data, error }) => {
        if (error) setMessage(error.message)
        setSubscribedTypes((data ?? []).map((row) => row.event_type).filter((value): value is string => Boolean(value)))
      })
  }, [user?.id])

  const toggleType = async (eventType: string) => {
    if (!user) return
    const enabled = subscribedTypes.includes(eventType)
    const query = supabase.from('event_notification_subscriptions')
    const result = enabled
      ? await query.delete().eq('profile_id', user.id).eq('event_type', eventType)
      : await query.insert({ profile_id: user.id, event_type: eventType })
    if (result.error) {
      setMessage(result.error.message)
      return
    }
    setSubscribedTypes((current) => enabled ? current.filter((value) => value !== eventType) : [...current, eventType])
  }

  return (
    <Layout>
      <section className="card notification-page">
        <h1>{t('notifications.settingsTitle')}</h1>
        <p>{t('notifications.settingsDescription')}</p>
        {message ? <p className="error-message">{message}</p> : null}
        <div className="notification-type-grid">
          {EVENT_TYPES.map((eventType) => {
            const enabled = subscribedTypes.includes(eventType)
            return (
              <label key={eventType} className="notification-setting-row">
                <span>{eventType}</span>
                <input type="checkbox" checked={enabled} onChange={() => void toggleType(eventType)} />
              </label>
            )
          })}
        </div>
      </section>
    </Layout>
  )
}
