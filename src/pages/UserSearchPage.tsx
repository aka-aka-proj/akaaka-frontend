import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { getAvatarPath, normalizeSocialLinks } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

type SearchProfile = Pick<Profile, 'id' | 'display_name' | 'metadata'>

function mapProfile(row: Record<string, unknown>): SearchProfile {
  return {
    id: String(row.id ?? ''),
    display_name: (row.display_name as string | null) ?? null,
    metadata: (row.metadata as Profile['metadata']) ?? null,
  }
}

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
      const { data: connectionRows, error: connectionError } = await supabase
        .from('connections')
        .select('requester_id, receiver_id, status')
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted')

      if (cancelled) return
      if (connectionError) {
        setError(connectionError.message)
        setProfiles([])
        setLoading(false)
        return
      }

      const outgoing = new Set<string>()
      const incoming = new Set<string>()
      for (const row of connectionRows ?? []) {
        if (row.requester_id === user.id) outgoing.add(String(row.receiver_id))
        if (row.receiver_id === user.id) incoming.add(String(row.requester_id))
      }
      const eligibleIds = [...outgoing].filter((id) => incoming.has(id))
      if (eligibleIds.length === 0) {
        setProfiles([])
        setLoading(false)
        return
      }

      const createQuery = () => supabase
        .from('profiles')
        .select('id, display_name, metadata')
        .in('id', eligibleIds)
        .order('display_name', { ascending: true, nullsFirst: false })

      const result = trimmed
        ? await Promise.all([
            createQuery().ilike('display_name', `%${trimmed}%`).limit(50),
            createQuery().eq('id', trimmed).limit(50),
          ])
        : [await createQuery().limit(50)]
      const queryError = result.find((item) => item.error)?.error ?? null
      const data = [...new Map(result.flatMap((item) => item.data ?? []).map((row) => [String(row.id), row])).values()]

      if (cancelled) return
      if (queryError) {
        setError(queryError.message)
        setProfiles([])
      } else {
        setProfiles((data ?? []).map((row) => mapProfile(row as Record<string, unknown>)))
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [query, user?.id])

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
