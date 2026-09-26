import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { getAvatarPath } from '../lib/profile'
import { supabase } from '../supabaseClient'
import styles from './BlocklistPage.module.css'

interface Entry { blocked_id: string; created_at: string; display_name: string | null; avatar_path: string | null }
const pageSize = 20

function Blocklist({ userId }: { userId: string }) {
  const { t, locale } = useT()
  const [rows, setRows] = useState<Entry[]>([])
  const [page, setPage] = useState(0)
  const [retryPage, setRetryPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [actionError, setActionError] = useState(false)
  const [message, setMessage] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const generation = useRef(0)
  const changing = useRef(false)
  const load = useCallback(async (targetPage: number) => {
    const current = ++generation.current
    setLoading(true); setError(false); setRetryPage(targetPage)
    try {
      const { data, error: queryError } = await supabase.from('blocks').select('blocked_id, created_at')
        .eq('blocker_id', userId).order('created_at', { ascending: false }).order('blocked_id', { ascending: true })
        .range(targetPage * pageSize, targetPage * pageSize + pageSize)
      if (queryError) throw queryError
      const blocks = (data ?? []).slice(0, pageSize) as Array<{ blocked_id: string; created_at: string }>
      const profiles = blocks.length ? await supabase.from('public_profiles').select('id, display_name, avatar_path').in('id', blocks.map(row => row.blocked_id)) : { data: [], error: null }
      if (profiles.error) throw profiles.error
      if (generation.current !== current) return
      const byId = new Map((profiles.data ?? []).map(profile => [profile.id, profile]))
      setRows(blocks.map(row => ({ ...row, display_name: byId.get(row.blocked_id)?.display_name ?? null, avatar_path: byId.get(row.blocked_id)?.avatar_path ?? null })))
      setHasNext((data?.length ?? 0) > pageSize)
      setPage(targetPage)
    } catch {
      if (generation.current === current) { setRows([]); setError(true) }
    } finally {
      if (generation.current === current) setLoading(false)
    }
  }, [userId])
  useEffect(() => {
    void load(0)
    const requestGeneration = generation
    return () => { requestGeneration.current++ }
  }, [load])

  const unblock = async (profileId: string) => {
    if (changing.current) return
    changing.current = true; setPending(profileId); setActionError(false); setMessage(false)
    const current = generation.current
    try {
      const { error: deleteError } = await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', profileId)
      if (deleteError) throw deleteError
      if (generation.current !== current) return
      setMessage(true)
      await load(0)
    } catch {
      if (generation.current === current) setActionError(true)
    } finally { changing.current = false; setPending(null) }
  }

  return <section className={`card blocklist-page ${styles.page}`} aria-labelledby="blocklist-title">
    <h1 id="blocklist-title">{t('blocklist.title')}</h1>
    <p>{t('blocklist.description')}</p>
    <p>{t('blocklist.unblockHelp')}</p>
    <p>{t('blocklist.conflictHelp')}</p>
    {message ? <p role="status">{t('blocklist.unblocked')}</p> : null}
    {actionError ? <p role="alert">{t('blocklist.unblockError')}</p> : null}
    {loading ? <p role="status">{t('common.loading')}</p> : null}
    {error ? <div role="alert"><p>{t('blocklist.loadError')}</p><button type="button" disabled={loading} onClick={() => void load(retryPage)}>{t('blocklist.retry')}</button></div> : null}
    {!loading && !error && rows.length === 0 ? <p>{t('blocklist.empty')}</p> : null}
    {!loading && !error && rows.length > 0 ? <ul className="user-directory-list">
      {rows.map(row => <li key={row.blocked_id} className="user-directory-item">
        <img className="avatar" width={48} height={48} alt="" src={getAvatarPath({ metadata: { avatar_path: row.avatar_path ?? undefined } })} />
        <span className="user-directory-profile-copy">
          <Link to={`/profile/${row.blocked_id}`}><strong>{row.display_name || t('blocklist.unnamed')}</strong></Link>
          <small>{t('blocklist.since', { date: new Date(row.created_at).toLocaleDateString(locale) })}</small>
        </span>
        <button type="button" disabled={pending !== null} aria-label={t('blocklist.unblockUser', { name: row.display_name || t('blocklist.unnamed') })}
          onClick={() => void unblock(row.blocked_id)}>{pending === row.blocked_id ? t('common.processing') : t('blocklist.unblock')}</button>
      </li>)}
    </ul> : null}
    {!error && (page > 0 || hasNext) ? <nav className="section-heading-row" aria-label={t('blocklist.pagination')}>
      <button type="button" disabled={loading || pending !== null || page === 0} onClick={() => void load(page - 1)}>{t('blocklist.previous')}</button>
      <span>{t('blocklist.page', { page: page + 1 })}</span>
      <button type="button" disabled={loading || pending !== null || !hasNext} onClick={() => void load(page + 1)}>{t('blocklist.next')}</button>
    </nav> : null}
  </section>
}

export function BlocklistPage() {
  const { user } = useAuth()
  return <Layout>{user ? <Blocklist key={user.id} userId={user.id} /> : null}</Layout>
}
