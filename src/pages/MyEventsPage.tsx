import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { CreateEventMenu } from '../components/CreateEventMenu'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import styles from './MyEventsPage.module.css'

interface OwnedItem {
  id: string
  creator_id: string
  title: string
  updated_at: string
  event_series_membership?: { count: number }[]
}
const pageSize = 20
const publishedEventLifecycleStatuses = ['published', 'registration_open', 'registration_closed', 'completed']
const publishedSeriesLifecycleStatuses = ['published', 'archived', 'cancelled']
export function MyEventsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [params, setParams] = useSearchParams()
  const kind = params.get('type') === 'series' ? 'series' : 'events'
  const status = params.get('status') === 'published' ? 'published' : 'draft'
  return <Layout><section className={`card ${styles.page}`}>
    <div className={styles.heading}><h1>{t('ownedEvents.title')}</h1><CreateEventMenu /></div>
    <div className={styles.filters} role="group" aria-label={t('ownedEvents.kind')}>
      {(['events', 'series'] as const).map(value => <button key={value} type="button" aria-pressed={kind === value}
        onClick={() => setParams({ type: value, status })}>{t(`ownedEvents.${value}`)}</button>)}
    </div>
    <div className={styles.filters} role="group" aria-label={t('ownedEvents.status')}>
      {(['draft', 'published'] as const).map(value => <button key={value} type="button" aria-pressed={status === value}
        onClick={() => setParams({ type: kind, status: value })}>{t(`ownedEvents.${value}`)}</button>)}
    </div>
    {user ? <OwnedList key={`${user.id}:${kind}:${status}`} userId={user.id} kind={kind} status={status} /> : null}
  </section></Layout>
}
function OwnedList({ userId, kind, status }: { userId: string; kind: 'events' | 'series'; status: 'draft' | 'published' }) {
  const { t, locale } = useT()
  const [items, setItems] = useState<OwnedItem[]>([])
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(false)
      try {
        let query = supabase.from(kind === 'series' ? 'event_series' : 'events')
          .select(kind === 'series' ? 'id,creator_id,title,updated_at,event_series_membership(count)' : 'id,creator_id,title,updated_at')
          .eq('creator_id', userId)
        query = status === 'published'
          ? query.in('lifecycle_status', kind === 'series' ? publishedSeriesLifecycleStatuses : publishedEventLifecycleStatuses)
          : query.eq('lifecycle_status', status)
        const { data, error: queryError } = await query
          .order('updated_at', { ascending: false }).order('id', { ascending: false })
          .range(0, page * pageSize - 1)
        if (cancelled) return
        if (queryError) throw queryError
        const rows = (data ?? []) as unknown as OwnedItem[]
        setItems(rows.filter(row => row.creator_id === userId))
        setHasMore(rows.length === page * pageSize)
      } catch { if (!cancelled) setError(true) }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [userId, kind, status, page, retry])
  return <>
    {error && <div role="alert"><p>{t('ownedEvents.loadFailed')}</p><button type="button" onClick={() => setRetry(n => n + 1)} disabled={loading}>{t('ownedEvents.retry')}</button></div>}
    {loading && <p role="status">{t('common.loading')}</p>}
    {!loading && !error && items.length === 0 && <p>{t('ownedEvents.empty')}</p>}
    <ul className={styles.list}>{items.map(item => <li key={item.id} className={styles.item}>
      <div><h2>{item.title}</h2><p>{t(`ownedEvents.${status}`)}{kind === 'series' ? ` · ${t('ownedEvents.sessions', { count: item.event_series_membership?.[0]?.count ?? 0 })}` : ''}</p>
      <p>{t('ownedEvents.updated')} <time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleString(locale)}</time></p></div>
      <Link className="secondary-action" to={kind === 'series' ? `/events/series/${item.id}/manage` : `/events/${item.id}/edit`}>{t(status === 'draft' ? 'ownedEvents.resume' : 'ownedEvents.manage')}</Link>
    </li>)}</ul>
    {hasMore && <button type="button" disabled={loading || error} onClick={() => setPage(n => n + 1)}>{t('events.loadMore')}</button>}
  </>
}
