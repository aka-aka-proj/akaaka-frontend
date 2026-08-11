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
      const createQuery = () => supabase
        .from('profiles')
        .select('id, display_name, metadata')
        .neq('id', user.id)
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
                <Link to={`/profile/${profile.id}`}>
                  <strong>{profile.display_name || t('messages.unnamed')}</strong>
                </Link>
                <small title={profile.id}>{profile.id}</small>
              </span>
            </li>
          })}
        </ul>
      ) : null}
    </section>
  </Layout>
}
