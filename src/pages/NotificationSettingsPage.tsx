import { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { EVENT_TYPES, PRACTICE_TAGS, SOCIAL_TAGS } from '../lib/event-types'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { disableWebPush, enableWebPush, getWebPushState, type WebPushState } from '../lib/web-push'

type FollowedProfile = {
  id: string
  displayName: string
}

export function NotificationSettingsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const userId = user?.id
  const [subscribedTypes, setSubscribedTypes] = useState<string[]>([])
  const [subscribedCreators, setSubscribedCreators] = useState<string[]>([])
  const [followedProfiles, setFollowedProfiles] = useState<FollowedProfile[]>([])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [pushState, setPushState] = useState<WebPushState>('unsubscribed')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState('')

  const categories = useMemo(() => [
    { key: 'practice', label: t('notifications.practiceCategory'), types: PRACTICE_TAGS },
    { key: 'social', label: t('notifications.socialCategory'), types: SOCIAL_TAGS },
  ], [t])

  useEffect(() => {
    if (!userId) return
    void (async () => {
      const [subscriptionsResult, followsResult] = await Promise.all([
        supabase
          .from('event_notification_subscriptions')
          .select('event_type, creator_profile_id')
          .eq('profile_id', userId),
        supabase
          .from('user_follows')
          .select('followed_id')
          .eq('follower_id', userId)
          .order('created_at', { ascending: false }),
      ])

      if (subscriptionsResult.error) {
        setMessage(subscriptionsResult.error.message)
        return
      }
      if (followsResult.error) {
        setMessage(followsResult.error.message)
        return
      }

      setSubscribedTypes((subscriptionsResult.data ?? [])
        .map((row) => row.event_type)
        .filter((value): value is string => Boolean(value)))
      setSubscribedCreators((subscriptionsResult.data ?? [])
        .map((row) => row.creator_profile_id)
        .filter((value): value is string => Boolean(value)))

      const followedIds = [...new Set((followsResult.data ?? []).map((row) => String(row.followed_id)))]
      if (followedIds.length === 0) {
        setFollowedProfiles([])
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', followedIds)

      if (error) {
        setMessage(error.message)
        return
      }

      const profileMap = new Map((data ?? []).map((row) => [String(row.id), String(row.display_name ?? row.id)]))
      setFollowedProfiles(followedIds
        .map((id) => ({ id, displayName: profileMap.get(id) ?? id })))
    })()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    void getWebPushState().then(setPushState).catch(() => setPushState('unsupported'))
  }, [userId])

  const toggleWebPush = async (enabled: boolean) => {
    if (!user) return
    setPushBusy(true)
    setPushMessage('')
    try {
      if (enabled) {
        await enableWebPush(user.id)
        setPushState('subscribed')
        setPushMessage(t('notifications.push.enabled'))
      } else {
        await disableWebPush(user.id)
        setPushState('unsubscribed')
        setPushMessage(t('notifications.push.disabled'))
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'web_push_failed'
      const messageKey = code === 'web_push_denied'
        ? 'notifications.push.denied'
        : code === 'web_push_unsupported'
          ? 'notifications.push.unsupported'
          : 'notifications.push.failed'
      setPushMessage(t(messageKey))
    } finally {
      setPushBusy(false)
    }
  }

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

  const updateCreators = async (profileIds: readonly string[], enabled: boolean) => {
    if (!user) return
    setMessage('')
    setStatus('')
    const targets = profileIds.filter((profileId) => subscribedCreators.includes(profileId) !== enabled)
    const results = await Promise.all(targets.map(async (profileId) => {
      const query = supabase.from('event_notification_subscriptions')
      return enabled
        ? query.insert({ profile_id: user.id, creator_profile_id: profileId })
        : query.delete().eq('profile_id', user.id).eq('creator_profile_id', profileId)
    }))
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      setMessage(failed.error.message)
      return
    }
    setSubscribedCreators((current) => enabled
      ? [...new Set([...current, ...targets])]
      : current.filter((value) => !targets.includes(value)))
    setStatus(t('notifications.updated'))
  }

  const normalizedSearch = search.trim().toLocaleLowerCase()

  return (
    <Layout>
      <section className="card notification-page">
        <h1>{t('notifications.settingsTitle')}</h1>
        <p>{t('notifications.settingsDescription')}</p>
        {message ? <p className="error-message">{message}</p> : null}
        <section className="notification-category" aria-labelledby="push-notification-heading">
          <h2 id="push-notification-heading">{t('notifications.push.title')}</h2>
          <p>{t('notifications.push.description')}</p>
          {pushMessage ? <p className="notification-status" role="status">{pushMessage}</p> : null}
          {pushState === 'unsupported' ? <p className="notification-empty-search">{t('notifications.push.unsupported')}</p> : null}
          {pushState === 'denied' ? <p className="error-message">{t('notifications.push.denied')}</p> : null}
          {pushState !== 'unsupported' && pushState !== 'denied' ? (
            <button type="button" disabled={pushBusy} onClick={() => void toggleWebPush(pushState !== 'subscribed')}>
              {pushBusy
                ? t('notifications.push.working')
                : pushState === 'subscribed' ? t('notifications.push.disable') : t('notifications.push.enable')}
            </button>
          ) : null}
        </section>
        <div className="notification-controls">
          <label className="notification-search">
            <span>{t('notifications.searchAllLabel')}</span>
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
        <section className="notification-category" aria-labelledby="followed-notification-heading">
          <h2 id="followed-notification-heading">{t('notifications.followedPeopleCategory')}</h2>
          {followedProfiles.length === 0 ? (
            <p className="notification-empty-search">{t('notifications.noFollowedPeople')}</p>
          ) : (
            <div className="notification-type-grid">
              {followedProfiles
                .filter(({ id, displayName }) => {
                  if (!normalizedSearch) return true
                  return displayName.toLocaleLowerCase().includes(normalizedSearch) || id.toLocaleLowerCase().includes(normalizedSearch)
                })
                .map(({ id, displayName }) => {
                  const enabled = subscribedCreators.includes(id)
                  return (
                    <label key={id} className={`notification-setting-row${enabled ? ' is-selected' : ''}`}>
                      <span>{displayName}</span>
                      <input type="checkbox" checked={enabled} aria-label={displayName} onChange={() => void updateCreators([id], !enabled)} />
                    </label>
                  )
                })}
            </div>
          )}
        </section>
        {normalizedSearch && !categories.some(({ types }) => types.some((eventType) => eventType.toLocaleLowerCase().includes(normalizedSearch))) && !followedProfiles.some(({ id, displayName }) => displayName.toLocaleLowerCase().includes(normalizedSearch) || id.toLocaleLowerCase().includes(normalizedSearch)) ? (
          <p className="notification-empty-search">{t('notifications.noSearchResults')}</p>
        ) : null}
      </section>
    </Layout>
  )
}
