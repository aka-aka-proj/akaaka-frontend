import { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { EVENT_TYPES, PRACTICE_TAGS, SOCIAL_TAGS } from '../lib/event-types'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'

export function NotificationSettingsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const userId = user?.id
  const [subscribedTypes, setSubscribedTypes] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const categories = useMemo(() => [
    { key: 'practice', label: t('notifications.practiceCategory'), types: PRACTICE_TAGS },
    { key: 'social', label: t('notifications.socialCategory'), types: SOCIAL_TAGS },
  ], [t])

  useEffect(() => {
    if (!userId) return
    void supabase
      .from('event_notification_subscriptions')
      .select('event_type')
      .eq('profile_id', userId)
      .not('event_type', 'is', null)
      .then(({ data, error }) => {
        if (error) {
          setMessage(error.message)
          return
        }
        setSubscribedTypes((data ?? []).map((row) => row.event_type).filter((value): value is string => Boolean(value)))
      })
  }, [userId])

  const updateTypes = async (eventTypes: readonly string[], enabled: boolean) => {
    if (!user) return
    setMessage('')
    setStatus('')
    const targets = eventTypes.filter((eventType) => subscribedTypes.includes(eventType) !== enabled)
    const results = await Promise.all(targets.map(async (eventType) => {
      const query = supabase.from('event_notification_subscriptions')
      return enabled
        ? query.insert({ profile_id: user.id, event_type: eventType })
        : query.delete().eq('profile_id', user.id).eq('event_type', eventType)
    }))
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      setMessage(failed.error.message)
      return
    }
    setSubscribedTypes((current) => enabled
      ? [...new Set([...current, ...targets])]
      : current.filter((value) => !targets.includes(value)))
    setStatus(t('notifications.updated'))
  }

  const toggleType = async (eventType: string) => {
    await updateTypes([eventType], !subscribedTypes.includes(eventType))
  }

  const normalizedSearch = search.trim().toLocaleLowerCase()

  return (
    <Layout>
      <section className="card notification-page">
        <h1>{t('notifications.settingsTitle')}</h1>
        <p>{t('notifications.settingsDescription')}</p>
        {message ? <p className="error-message">{message}</p> : null}
        <div className="notification-controls">
          <label className="notification-search">
            <span>{t('notifications.searchLabel')}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('notifications.searchPlaceholder')} />
          </label>
          <div className="notification-bulk-actions">
            <button type="button" onClick={() => void updateTypes(EVENT_TYPES, true)}>{t('notifications.selectAll')}</button>
            <button type="button" onClick={() => void updateTypes(EVENT_TYPES, false)}>{t('notifications.clearAll')}</button>
          </div>
        </div>
        {status ? <p className="notification-status" role="status">{status}</p> : null}
        {categories.map((category) => {
          const visibleTypes = category.types.filter((eventType) => eventType.toLocaleLowerCase().includes(normalizedSearch))
          if (visibleTypes.length === 0) return null
          return (
            <section key={category.key} className="notification-category" aria-labelledby={`${category.key}-notification-heading`}>
              <h2 id={`${category.key}-notification-heading`}>{category.label}</h2>
              <div className="notification-type-grid">
                {visibleTypes.map((eventType) => {
                  const enabled = subscribedTypes.includes(eventType)
                  return (
                    <label key={eventType} className={`notification-setting-row${enabled ? ' is-selected' : ''}`}>
                      <span>{eventType}</span>
                      <input type="checkbox" checked={enabled} onChange={() => void toggleType(eventType)} />
                    </label>
                  )
                })}
              </div>
            </section>
          )
        })}
        {normalizedSearch && !categories.some(({ types }) => types.some((eventType) => eventType.toLocaleLowerCase().includes(normalizedSearch))) ? (
          <p className="notification-empty-search">{t('notifications.noSearchResults')}</p>
        ) : null}
      </section>
    </Layout>
  )
}
