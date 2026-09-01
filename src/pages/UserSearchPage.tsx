import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { getAvatarPath, normalizeSocialLinks } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import { getProfilesForViewer } from '../lib/profile-access'

type SearchProfile = Pick<Profile, 'id' | 'display_name' | 'metadata'>

export function UserSearchPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<SearchProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      const trimmed = query.trim()
      const [{ data: outgoingRows, error: outgoingError }, { data: incomingRows, error: incomingError }] = await Promise.all([
        supabase.from('user_follows').select('followed_id').eq('follower_id', user.id),
        supabase.from('user_follows').select('follower_id').eq('followed_id', user.id),
      ])

      if (cancelled) return
      const relationshipError = outgoingError ?? incomingError
      if (relationshipError) {
        setError(relationshipError.message)
        setProfiles([])
        setLoading(false)
        return
      }

      const outgoing = new Set((outgoingRows ?? []).map((row) => String(row.followed_id)))
      const incoming = new Set((incomingRows ?? []).map((row) => String(row.follower_id)))
      const eligibleIds = [...outgoing].filter((id) => incoming.has(id))
      if (eligibleIds.length === 0) {
        setProfiles([])
        setLoading(false)
        return
      }

      const { data, error: queryError } = await getProfilesForViewer(eligibleIds)
      const filteredData = data
        .filter((profile) => !trimmed
          || profile.display_name?.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase())
          || profile.id === trimmed)
        .sort((a, b) => {
          const aName = a.display_name?.trim() ?? ''
          const bName = b.display_name?.trim() ?? ''
          if (!aName && bName) return 1
          if (aName && !bName) return -1
          return aName.localeCompare(bName, undefined, { sensitivity: 'base' })
        })
        .slice(0, 50)

      if (cancelled) return
      if (queryError) {
        setError(queryError.message)
        setProfiles([])
      } else {
        setProfiles(filteredData.map(({ id, display_name, metadata }) => ({ id, display_name, metadata })))
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [query, user])

  return <Layout>
    <section className="card user-search-page">
      <div className="page-heading-row">
        <div>
          <h1>{t('messages.findUsers')}</h1>
          <p>{t('messages.findUsersDescription')}</p>
        </div>
        <Link to="/messages" className="link-small">{t('messages.back')}</Link>
      </div>
      <label>
        {t('messages.searchUsersLabel')}
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('messages.searchUsersPlaceholder')}
        />
      </label>
      {error ? <p className="message">{error}</p> : null}
      {loading ? <p>{t('common.loading')}</p> : null}
      {!loading && !error && profiles.length === 0 ? <p className="empty-state">{query.trim() ? t('messages.noSearchResults') : t('messages.noUsers')}</p> : null}
      {!loading && profiles.length > 0 ? (
        <ul className="user-search-list">
          {profiles.map((profile) => {
            const avatarProfile = {
              ...profile,
              role_status: 'general' as const,
              bio: null,
              external_social_links: normalizeSocialLinks(null),
              reputation_score: 0,
            }
            return <li key={profile.id} className="user-search-item">
              <img src={getAvatarPath(avatarProfile)} alt="" width={48} height={48} className="avatar" />
              <span className="user-search-profile-copy">
                <Link to={`/messages/new?user=${profile.id}`} className="user-search-chat-link">
                  <strong>{profile.display_name || t('messages.unnamed')}</strong>
                </Link>
                <small title={profile.id}>{profile.id}</small>
                <Link to={`/profile/${profile.id}`} className="link-small">{t('messages.viewProfile')}</Link>
              </span>
            </li>
          })}
        </ul>
      ) : null}
    </section>
  </Layout>
}
