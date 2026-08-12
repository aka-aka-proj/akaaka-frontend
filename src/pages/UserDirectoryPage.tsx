import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
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

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase.from('public_profiles').select('id, display_name, avatar_path').neq('id', user.id).order('display_name', { ascending: true, nullsFirst: false }).limit(100)
      if (cancelled) return
      if (queryError) { setError(queryError.message); setProfiles([]) } else setProfiles((data ?? []).map((row) => mapProfile(row as Record<string, unknown>)))
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user?.id])

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query ? profiles.filter((profile) => (profile.display_name ?? '').toLocaleLowerCase().includes(query) || profile.id.toLocaleLowerCase().includes(query)) : profiles
  }, [profiles, search])

  return <Layout>
    <section className="card user-directory-page">
      <div className="page-heading-row"><div><h1>{t('users.title')}</h1><p>{t('users.description')}</p></div><Link to="/following" className="link-small">{t('users.viewFollowing')}</Link></div>
      <label>{t('users.searchLabel')}<input className="search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('users.searchPlaceholder')} /></label>
      {error ? <p className="message">{error}</p> : null}
      {loading ? <p>{t('common.loading')}</p> : null}
      {!loading && !error && profiles.length === 0 ? <p className="empty-state">{t('users.empty')}</p> : null}
      {!loading && !error && profiles.length > 0 && filteredProfiles.length === 0 ? <p className="empty-state">{t('users.noResults')}</p> : null}
      {!loading && filteredProfiles.length > 0 ? <ul className="user-directory-list">{filteredProfiles.map((profile) => <li key={profile.id} className="user-directory-item"><img src={getAvatarPath(profile)} alt="" width={48} height={48} className="avatar" /><span className="user-directory-profile-copy"><Link to={`/profile/${profile.id}`}><strong>{profile.display_name || t('users.unnamed')}</strong></Link><small title={profile.id}>{profile.id}</small></span></li>)}</ul> : null}
    </section>
  </Layout>
}
