import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { getAvatarPath, normalizeSocialLinks } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id ?? ''),
    role_status: (row.role_status as Profile['role_status']) ?? 'general',
    display_name: (row.display_name as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    external_social_links: normalizeSocialLinks(row.external_social_links),
    metadata: (row.metadata as Profile['metadata']) ?? null,
    reputation_score: Number(row.reputation_score ?? 0),
  }
}

export function FollowingPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const loadFollowing = async () => {
    if (!user) return
    setLoading(true)
    setMessage('')

    const { data: follows, error: followsError } = await supabase
      .from('user_follows')
      .select('followed_id')
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false })

    if (followsError) {
      setMessage(followsError.message)
      setLoading(false)
      return
    }

    const followedIds = [...new Set((follows ?? []).map((row) => String(row.followed_id)))]
    if (followedIds.length === 0) {
      setProfiles([])
      setSelectedIds(new Set())
      setLoading(false)
      return
    }

    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role_status, display_name, bio, external_social_links, metadata, reputation_score')
      .in('id', followedIds)

    if (profilesError) {
      setMessage(profilesError.message)
      setLoading(false)
      return
    }

    const profileMap = new Map((profileRows ?? []).map((row) => [String(row.id), mapProfile(row as Record<string, unknown>)]))
    setProfiles(followedIds.map((id) => profileMap.get(id)).filter((profile): profile is Profile => Boolean(profile)))
    setSelectedIds(new Set())
    setLoading(false)
  }

  useEffect(() => {
    void loadFollowing()
  }, [user?.id])

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return profiles
    return profiles.filter((profile) =>
      (profile.display_name ?? '').toLocaleLowerCase().includes(query)
      || profile.id.toLocaleLowerCase().includes(query),
    )
  }, [profiles, search])

  const toggleSelected = (profileId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(profileId)) next.delete(profileId)
      else next.add(profileId)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      const allSelected = filteredProfiles.length > 0 && filteredProfiles.every((profile) => next.has(profile.id))
      filteredProfiles.forEach((profile) => {
        if (allSelected) next.delete(profile.id)
        else next.add(profile.id)
      })
      return next
    })
  }

  const removeSelected = async () => {
    if (!user || selectedIds.size === 0) return
    setSubmitting(true)
    setMessage('')

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .in('followed_id', [...selectedIds])

    if (error) {
      setMessage(error.message)
      setSubmitting(false)
      return
    }

    setProfiles((current) => current.filter((profile) => !selectedIds.has(profile.id)))
    setSelectedIds(new Set())
    setMessage(t('following.unfollowSuccess'))
    setSubmitting(false)
  }

  const allFilteredSelected = filteredProfiles.length > 0 && filteredProfiles.every((profile) => selectedIds.has(profile.id))

  return (
    <Layout>
      <section className="card">
        <div className="page-heading-row">
          <div>
            <h1>{t('following.title')}</h1>
            <p>{t('following.description')}</p>
          </div>
          <Link to="/profile/me" className="link-small">{t('nav.myProfile')}</Link>
        </div>

        {message ? <p className="message">{message}</p> : null}
        <label>
          {t('following.searchLabel')}
          <input
            className="search-input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('following.searchPlaceholder')}
          />
        </label>

        {!loading && profiles.length > 0 ? (
          <div className="page-heading-row" style={{ marginTop: '1rem' }}>
            <label className="checkbox">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} disabled={filteredProfiles.length === 0} />
              {t('following.selectAll')}
            </label>
            <button type="button" onClick={() => void removeSelected()} disabled={selectedIds.size === 0 || submitting}>
              {submitting ? t('following.removing') : t('following.unfollowSelected', { count: selectedIds.size })}
            </button>
          </div>
        ) : null}

        {loading ? <p>{t('common.loading')}</p> : null}
        {!loading && profiles.length === 0 ? <p className="empty-state">{t('following.empty')}</p> : null}
        {!loading && profiles.length > 0 && filteredProfiles.length === 0 ? <p className="empty-state">{t('following.noResults')}</p> : null}

        <ul>
          {filteredProfiles.map((profile) => (
            <li key={profile.id} className="thread-item">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={selectedIds.has(profile.id)}
                  onChange={() => toggleSelected(profile.id)}
                  aria-label={t('following.selectUser', { name: profile.display_name ?? profile.id })}
                />
                <img src={getAvatarPath(profile)} alt="" width={48} height={48} className="avatar" />
                <span>
                  <Link to={`/profile/${profile.id}`}>
                    <strong>{profile.display_name || profile.id}</strong>
                  </Link>
                  <small>{profile.id}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  )
}
