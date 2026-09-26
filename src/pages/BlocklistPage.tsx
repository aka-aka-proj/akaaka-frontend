import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../supabaseClient'

interface BlockedProfile {
  id: string
  display_name: string | null
  avatar_path?: string | null
}

export function BlocklistPage() {
  const [profiles, setProfiles] = useState<BlockedProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('manage-blocklist', {
      body: { action: 'list' },
    })
    if (invokeError) {
      setError(invokeError.message)
      setLoading(false)
      return
    }
    const rows = Array.isArray(data?.profiles) ? data.profiles : Array.isArray(data) ? data : []
    setProfiles(rows as BlockedProfile[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const unblock = async (profileId: string) => {
    if (removing) return
    setRemoving(profileId)
    setError('')
    const { error: invokeError } = await supabase.functions.invoke('manage-blocklist', {
      body: { action: 'unblock', profile_id: profileId },
    })
    if (invokeError) {
      setError(invokeError.message)
      setRemoving(null)
      return
    }
    setProfiles((current) => current.filter((profile) => profile.id !== profileId))
    setRemoving(null)
  }

  return (
    <Layout>
      <section className="card" aria-labelledby="blocklist-title">
        <h1 id="blocklist-title">封鎖名單 / Blocklist</h1>
        <p>管理你主動封鎖的使用者。解除封鎖不會透露對方是否封鎖你。</p>
        {error ? <p className="message" role="alert">{error}</p> : null}
        {loading ? <p role="status">載入中… / Loading…</p> : null}
        {!loading && profiles.length === 0 ? <p className="empty-state">目前沒有封鎖的使用者。 / No blocked users.</p> : null}
        {profiles.length > 0 ? (
          <ul className="notification-list" aria-label="封鎖名單">
            {profiles.map((profile) => (
              <li key={profile.id} className="notification-item notification-follow-item">
                <Link to={`/profile/${profile.id}`}>{profile.display_name || '未命名使用者 / Unnamed user'}</Link>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void unblock(profile.id)}
                  disabled={removing === profile.id}
                  style={{ minWidth: 44, minHeight: 44 }}
                >
                  {removing === profile.id ? '處理中… / Working…' : '解除封鎖 / Unblock'}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <button type="button" onClick={() => void load()} disabled={loading}>重試 / Retry</button> : null}
      </section>
    </Layout>
  )
}
