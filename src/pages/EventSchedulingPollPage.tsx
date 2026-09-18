import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import styles from './EventSchedulingPollPage.module.css'

type Poll = { id: string; event_id: string; creator_id: string; status: 'open' | 'closed'; closed_at: string | null }
type Option = { id: string; poll_id: string; kind: 'datetime' | 'location'; starts_at: string | null; location_label: string | null; sort_order: number }
type ProfileResult = { id: string; display_name: string | null }

export function EventSchedulingPollPage() {
  const { id: eventId } = useParams()
  const { user } = useAuth()
  const { t, locale } = useT()
  const [event, setEvent] = useState<{ title: string; creator_id: string; lifecycle_status: string } | null>(null)
  const [poll, setPoll] = useState<Poll | null>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [voters, setVoters] = useState<ProfileResult[]>([])
  const [candidateDate, setCandidateDate] = useState('')
  const [candidateLocation, setCandidateLocation] = useState('')
  const [profileQuery, setProfileQuery] = useState('')
  const [profileResults, setProfileResults] = useState<ProfileResult[]>([])
  const [chosenDate, setChosenDate] = useState('')
  const [chosenLocation, setChosenLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isOwner = Boolean(user && event?.creator_id === user.id)

  const load = useCallback(async () => {
    if (!eventId || !user) return
    setLoading(true); setError('')
    const eventResult = await supabase.from('events').select('title, creator_id, lifecycle_status').eq('id', eventId).maybeSingle()
    if (eventResult.error || !eventResult.data) { setError(t('schedulingPoll.permissionDenied')); setLoading(false); return }
    setEvent(eventResult.data)
    const pollResult = await supabase.from('event_scheduling_polls').select('*').eq('event_id', eventId).maybeSingle()
    if (pollResult.error) { setError(t('schedulingPoll.permissionDenied')); setLoading(false); return }
    const currentPoll = pollResult.data as Poll | null
    setPoll(currentPoll)
    if (!currentPoll) { setLoading(false); return }
    const [optionResult, voteResult, countResult] = await Promise.all([
      supabase.from('event_scheduling_poll_options').select('*').eq('poll_id', currentPoll.id).order('sort_order'),
      supabase.from('event_scheduling_poll_votes').select('option_id').eq('poll_id', currentPoll.id).eq('profile_id', user.id),
      supabase.rpc('get_event_scheduling_poll_results', { p_poll_id: currentPoll.id }),
    ])
    if (optionResult.error || voteResult.error || countResult.error) { setError(t('schedulingPoll.loadError')); setLoading(false); return }
    setOptions((optionResult.data ?? []) as Option[])
    setMyVotes(new Set((voteResult.data ?? []).map((row: { option_id: string }) => row.option_id)))
    setCounts(Object.fromEntries((countResult.data ?? []).map((row: { option_id: string; vote_count: number }) => [row.option_id, Number(row.vote_count)])))
    if (eventResult.data.creator_id === user.id) {
      const voterRows = await supabase.from('event_scheduling_poll_voters').select('profile_id, profiles!event_scheduling_poll_voters_profile_id_fkey(id, display_name)').eq('poll_id', currentPoll.id)
      if (!voterRows.error) setVoters((voterRows.data ?? []).map((row: { profiles: ProfileResult | ProfileResult[] | null }) => Array.isArray(row.profiles) ? row.profiles[0] : row.profiles).filter(Boolean) as ProfileResult[])
    }
    setLoading(false)
  }, [eventId, user, t])

  useEffect(() => { void load() }, [load])
  const dates = useMemo(() => options.filter((option) => option.kind === 'datetime'), [options])
  const locations = useMemo(() => options.filter((option) => option.kind === 'location'), [options])
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

  const run = async (operation: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    setBusy(true); setError(''); setMessage('')
    const result = await operation()
    setBusy(false)
    if (result.error) { setError(t('schedulingPoll.mutationError')); return false }
    setMessage(success); await load(); return true
  }

  const createPoll = () => run(() => supabase.from('event_scheduling_polls').insert({ event_id: eventId, creator_id: user?.id }), t('schedulingPoll.created'))
  const addDate = async () => {
    if (!poll || !candidateDate) return
    const ok = await run(() => supabase.from('event_scheduling_poll_options').insert({ poll_id: poll.id, kind: 'datetime', starts_at: new Date(candidateDate).toISOString(), sort_order: options.length }), t('schedulingPoll.optionAdded'))
    if (ok) setCandidateDate('')
  }
  const addLocation = async () => {
    if (!poll || !candidateLocation.trim()) return
    const ok = await run(() => supabase.from('event_scheduling_poll_options').insert({ poll_id: poll.id, kind: 'location', location_label: candidateLocation.trim(), sort_order: options.length }), t('schedulingPoll.optionAdded'))
    if (ok) setCandidateLocation('')
  }
  const toggleVote = async (optionId: string) => {
    if (!poll || !user || poll.status === 'closed') return
    const previous = new Set(myVotes); const next = new Set(previous)
    if (next.has(optionId)) next.delete(optionId); else next.add(optionId)
    setMyVotes(next)
    const result = previous.has(optionId)
      ? await supabase.from('event_scheduling_poll_votes').delete().eq('poll_id', poll.id).eq('option_id', optionId).eq('profile_id', user.id)
      : await supabase.from('event_scheduling_poll_votes').upsert({ poll_id: poll.id, option_id: optionId, profile_id: user.id }, { onConflict: 'poll_id,option_id,profile_id' })
    if (result.error) { setMyVotes(previous); setError(t('schedulingPoll.voteRollback')) } else await load()
  }
  const searchProfiles = async () => {
    if (!profileQuery.trim()) return
    const result = await supabase.from('profiles').select('id, display_name').ilike('display_name', `%${profileQuery.trim()}%`).limit(8)
    if (!result.error) setProfileResults(((result.data ?? []) as ProfileResult[]).filter((profile) => profile.id !== user?.id))
  }
  const addVoter = (profile: ProfileResult) => poll && run(() => supabase.from('event_scheduling_poll_voters').insert({ poll_id: poll.id, profile_id: profile.id }), t('schedulingPoll.voterAdded'))
  const finalize = async () => {
    if (!poll || (dates.length > 0 && !chosenDate) || (locations.length > 0 && !chosenLocation)) { setError(t('schedulingPoll.chooseFinal')); return }
    if (!window.confirm(t('schedulingPoll.confirmFinalize'))) return
    await run(() => supabase.rpc('finalize_event_scheduling_poll', { p_poll_id: poll.id, p_datetime_option_id: chosenDate || null, p_location_option_id: chosenLocation || null }), t('schedulingPoll.finalized'))
  }

  if (loading) return <Layout><main className={styles.page}><p>{t('common.loading')}</p></main></Layout>
  if (error && !event) return <Layout><main className={styles.page}><p role="alert" className={styles.error}>{error}</p></main></Layout>
  return <Layout><main className={styles.page}>
    <header className={styles.header}><div><Link to={`/events/${eventId}/edit`}>{t('common.back')}</Link><h1>{t('schedulingPoll.title')}</h1><p>{event?.title}</p></div>{poll?.status === 'closed' ? <strong>{t('schedulingPoll.closed')}</strong> : null}</header>
    {message ? <p role="status">{message}</p> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {!poll && isOwner && event?.lifecycle_status === 'draft' ? <section className={styles.section}><p>{t('schedulingPoll.emptyOwner')}</p><button className={styles.button} disabled={busy} onClick={createPoll}>{t('schedulingPoll.create')}</button></section> : null}
    {!poll && !isOwner ? <section className={styles.section}><p>{t('schedulingPoll.empty')}</p></section> : null}
    {poll ? <>
      {isOwner && poll.status === 'open' ? <section className={styles.section}><h2>{t('schedulingPoll.manage')}</h2><div className={styles.row}><label>{t('schedulingPoll.dateCandidate')}<input type="datetime-local" value={candidateDate} onChange={(e) => setCandidateDate(e.target.value)} /></label><button className={styles.button} disabled={busy || !candidateDate} onClick={addDate}>{t('schedulingPoll.add')}</button></div><div className={styles.row}><label>{t('schedulingPoll.locationCandidate')}<input maxLength={200} value={candidateLocation} onChange={(e) => setCandidateLocation(e.target.value)} /></label><button className={styles.button} disabled={busy || !candidateLocation.trim()} onClick={addLocation}>{t('schedulingPoll.add')}</button></div><div className={styles.row}><label>{t('schedulingPoll.findVoter')}<input value={profileQuery} onChange={(e) => setProfileQuery(e.target.value)} /></label><button className={styles.button} onClick={searchProfiles}>{t('schedulingPoll.search')}</button></div>{profileResults.map((profile) => <button className={styles.button} key={profile.id} onClick={() => addVoter(profile)}>{t('schedulingPoll.addVoter', { name: profile.display_name || t('schedulingPoll.unnamed') })}</button>)}<p className={styles.message}>{t('schedulingPoll.eligibleCount', { count: voters.length })}</p></section> : null}
      <PollOptions title={t('schedulingPoll.dates')} options={dates} counts={counts} votes={myVotes} readOnly={poll.status === 'closed' || isOwner} formatDate={formatDate} onToggle={toggleVote} />
      <PollOptions title={t('schedulingPoll.locations')} options={locations} counts={counts} votes={myVotes} readOnly={poll.status === 'closed' || isOwner} formatDate={formatDate} onToggle={toggleVote} />
      {options.length === 0 ? <section className={styles.section}><p>{t('schedulingPoll.noCandidates')}</p></section> : null}
      {isOwner && poll.status === 'open' ? <section className={styles.section}><h2>{t('schedulingPoll.finalize')}</h2>{dates.length ? <label>{t('schedulingPoll.finalDate')}<select value={chosenDate} onChange={(e) => setChosenDate(e.target.value)}><option value="">{t('schedulingPoll.choose')}</option>{dates.map((option) => <option key={option.id} value={option.id}>{formatDate(option.starts_at!)}</option>)}</select></label> : null}{locations.length ? <label>{t('schedulingPoll.finalLocation')}<select value={chosenLocation} onChange={(e) => setChosenLocation(e.target.value)}><option value="">{t('schedulingPoll.choose')}</option>{locations.map((option) => <option key={option.id} value={option.id}>{option.location_label}</option>)}</select></label> : null}<p className={styles.message}>{Object.values(counts).some(Boolean) ? t('schedulingPoll.aggregateOnly') : t('schedulingPoll.noVotes')}</p><div className={styles.actions}><button className={styles.button} disabled={busy || options.length < 2} onClick={finalize}>{t('schedulingPoll.confirmAndFinalize')}</button></div></section> : null}
    </> : null}
  </main></Layout>
}

function PollOptions({ title, options, counts, votes, readOnly, formatDate, onToggle }: { title: string; options: Option[]; counts: Record<string, number>; votes: Set<string>; readOnly: boolean; formatDate: (value: string) => string; onToggle: (id: string) => void }) {
  if (!options.length) return null
  return <section className={styles.section}><h2>{title}</h2><ul className={styles.list}>{options.map((option) => <li className={`${styles.option} ${votes.has(option.id) ? styles.selected : ''}`} key={option.id}><label><input type="checkbox" checked={votes.has(option.id)} disabled={readOnly} onChange={() => onToggle(option.id)} /> {option.kind === 'datetime' ? formatDate(option.starts_at!) : option.location_label}</label><span>{counts[option.id] ?? 0}</span></li>)}</ul></section>
}
