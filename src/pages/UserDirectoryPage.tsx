import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { getAvatarPath, normalizeSocialLinks } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

function mapProfile(row: Record<string, unknown>): Profile {
  return { id: String(row.id ?? ''), role_status: 'general', display_name: (row.display_name as string | null) ?? null, bio: null, external_social_links: normalizeSocialLinks(null), metadata: row.avatar_path ? { avatar_path: String(row.avatar_path) } : null, reputation_score: 0 }
}

export function UserDirectoryPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [notificationIds, setNotificationIds] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      const [profilesResult, followsResult, notificationsResult] = await Promise.all([
        supabase.from('public_profiles').select('id, display_name, avatar_path').neq('id', user.id).order('display_name', { ascending: true, nullsFirst: false }).limit(100),
        supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).limit(100),
        supabase.from('event_notification_subscriptions').select('creator_profile_id').eq('profile_id', user.id).limit(100),
      ])
      if (cancelled) return
      const queryError = profilesResult.error ?? followsResult.error ?? notificationsResult.error
      if (queryError) {
        setError(queryError.message)
        setProfiles([])
      } else {
        setProfiles((profilesResult.data ?? []).map((row) => mapProfile(row as Record<string, unknown>)))
        setFollowedIds(new Set((followsResult.data ?? []).map((row) => String(row.followed_id))))
        setNotificationIds(new Set((notificationsResult.data ?? []).map((row) => String(row.creator_profile_id))))
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query ? profiles.filter((profile) => (profile.display_name ?? '').toLocaleLowerCase().includes(query) || profile.id.toLocaleLowerCase().includes(query)) : profiles
  }, [profiles, search])

  const toggleFollow = async (profileId: string) => {
    if (!user || pendingAction) return
    setPendingAction(`follow:${profileId}`)
    const isFollowing = followedIds.has(profileId)
    const result = isFollowing
      ? await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('followed_id', profileId)
      : await supabase.from('user_follows').insert({ follower_id: user.id, followed_id: profileId })
    if (result.error) {
      setError(result.error.message)
    } else {
      setFollowedIds((current) => {
        const next = new Set(current)
        if (isFollowing) next.delete(profileId)
        else next.add(profileId)
        return next
      })
    }
    setPendingAction(null)
  }

  const toggleNotifications = async (profileId: string) => {
    if (!user || pendingAction) return
    setPendingAction(`notifications:${profileId}`)
    const isSubscribed = notificationIds.has(profileId)
    const result = isSubscribed
      ? await supabase.from('event_notification_subscriptions').delete().eq('profile_id', user.id).eq('creator_profile_id', profileId)
      : await supabase.from('event_notification_subscriptions').insert({ profile_id: user.id, creator_profile_id: profileId })
    if (result.error) {
      setError(result.error.message)
    } else {
      setNotificationIds((current) => {
        const next = new Set(current)
        if (isSubscribed) next.delete(profileId)
        else next.add(profileId)
        return next
      })
    }
    setPendingAction(null)
  }

  return <Layout>
    <section className="card user-directory-page">
      <div className="page-heading-row"><div><h1>{t('users.title')}</h1><p>{t('users.description')}</p></div><Link to="/following" className="link-small">{t('users.viewFollowing')}</Link></div>
      <label>{t('users.searchLabel')}<input className="search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('users.searchPlaceholder')} /></label>
      {error ? <p className="message">{error}</p> : null}
      {loading ? <p>{t('common.loading')}</p> : null}
      {!loading && !error && profiles.length === 0 ? <p className="empty-state">{t('users.empty')}</p> : null}
      {!loading && !error && profiles.length > 0 && filteredProfiles.length === 0 ? <p className="empty-state">{t('users.noResults')}</p> : null}
      {!loading && filteredProfiles.length > 0 ? <ul className="user-directory-list">{filteredProfiles.map((profile) => {
        const isFollowing = followedIds.has(profile.id)
        const isSubscribed = notificationIds.has(profile.id)
        return <li key={profile.id} className="user-directory-item">
          <img src={getAvatarPath(profile)} alt="" width={48} height={48} className="avatar" />
          <span className="user-directory-profile-copy"><Link to={`/profile/${profile.id}`}><strong>{profile.display_name || t('users.unnamed')}</strong></Link><small title={profile.id}>{profile.id}</small></span>
          <span className="user-directory-actions">
            <button type="button" className="profile-follow-action" onClick={() => void toggleFollow(profile.id)} disabled={pendingAction !== null} aria-pressed={isFollowing}>
              {isFollowing ? t('profile.unfollow') : t('profile.follow')}
            </button>
            <button type="button" className="profile-secondary-action profile-mute-action" onClick={() => void toggleNotifications(profile.id)} disabled={pendingAction !== null} aria-pressed={isSubscribed} aria-label={isSubscribed ? t('profile.disableCreatorNotifications') : t('profile.enableCreatorNotifications')} title={isSubscribed ? t('profile.disableCreatorNotifications') : t('profile.enableCreatorNotifications')}>
              <Icon href="/action-icons.svg" name={isSubscribed ? 'action-bell' : 'action-bell-off'} size={20} />
            </button>
          </span>
        </li>
      })}</ul> : null}
    </section>
  </Layout>
}
