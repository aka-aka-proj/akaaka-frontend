import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { SeriesRegistrationProgress, type SeriesProgressItem } from '../components/SeriesRegistrationProgress'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { Registration, SeriesRegistration } from '../types'

type SeriesRow = Pick<SeriesProgressItem, 'id' | 'title'>
type SeriesMemberRow = {
  series_id: string
  event_id: string
  position: number
  event: Array<{ id: string; title: string; start_time: string }> | null
}

export function MyRegistrationsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [seriesProgress, setSeriesProgress] = useState<SeriesProgressItem[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      return
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .select('*, event:events(id, title, start_time, series_id)')
      .eq('profile_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      return
    }

    const nextRegistrations = (data as Registration[]) ?? []
    const { data: seriesRegistrationData, error: seriesRegistrationError } = await supabase
      .from('event_series_registrations')
      .select('id, series_id, profile_id, status, whole_series_registration, created_at')
      .eq('profile_id', user.id)
      .eq('whole_series_registration', true)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (seriesRegistrationError) {
      setMessage(seriesRegistrationError.message)
      return
    }

    const nextSeriesRegistrations = (seriesRegistrationData as SeriesRegistration[]) ?? []
    const seriesIds = [...new Set(nextSeriesRegistrations.map((registration) => registration.series_id))]

    if (seriesIds.length === 0) {
      setRegistrations(nextRegistrations)
      setSeriesProgress([])
      return
    }

    const [{ data: seriesData, error: seriesError }, { data: memberData, error: memberError }] = await Promise.all([
      supabase
        .from('event_series')
        .select('id, title')
        .in('id', seriesIds),
      supabase
        .from('event_series_membership')
        .select('series_id, event_id, position, event:events(id, title, start_time)')
        .in('series_id', seriesIds)
        .order('position', { ascending: true }),
    ])

    if (seriesError || memberError) {
      setMessage((seriesError ?? memberError)?.message ?? t('myRegistrations.seriesLoadFailed'))
      return
    }

    const registrationsByEvent = new Map(nextRegistrations.map((registration) => [registration.event_id, registration]))
    const seriesRegistrationById = new Map(nextSeriesRegistrations.map((registration) => [registration.series_id, registration]))
    const members = (memberData as unknown as SeriesMemberRow[]) ?? []
    const series = (seriesData as SeriesRow[]) ?? []

    setRegistrations(nextRegistrations)
    setSeriesProgress(series.map((item) => ({
      id: item.id,
      title: item.title,
      registrationStatus: seriesRegistrationById.get(item.id)?.status ?? 'pending',
      members: members
        .filter((member) => member.series_id === item.id)
        .sort((a, b) => a.position - b.position)
        .map((member) => ({
          event_id: member.event_id,
          position: member.position,
          title: member.event?.[0]?.title ?? null,
          start_time: member.event?.[0]?.start_time ?? null,
          status: registrationsByEvent.get(member.event_id)?.status ?? null,
        })),
    })))
  }, [t, user])

  useEffect(() => {
    void load()
  }, [load])

  const handleCancel = async (eventId: string) => {
    if (!user) {
      return
    }
    setSubmitting(true)
    setMessage('')

    const { error } = await supabase.functions.invoke('cancel-registration', {
      body: { event_id: eventId },
    })

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    await load()
  }

  const registrationStatus = (status: string) => {
    switch (status) {
      case 'pending': return t('eventDetail.regPending')
      case 'approved': return t('eventDetail.regApproved')
      case 'rejected': return t('eventDetail.regRejected')
      case 'waitlisted': return t('eventDetail.regWaitlisted')
      default: return status
    }
  }

  return (
    <Layout>
      <h1>{t('myRegistrations.title')}</h1>
      <SeriesRegistrationProgress series={seriesProgress} />
      <section className="card">
        {message ? <p className="message">{message}</p> : null}
        {registrations.length === 0 ? (
          <div className="empty-state">
            <p>{t('myRegistrations.noRegistrations')}</p>
          </div>
        ) : (
          <>
            {seriesProgress.length > 0 ? <h2>{t('myRegistrations.individualRegistrationsTitle')}</h2> : null}
            <ul>
              {registrations.map((reg) => (
                <li key={reg.id} className="thread-item">
                  <div className="thread-header">
                    <div>
                      <p>
                        <Link to={`/events/${reg.event_id}`}>{(reg.event as { title: string } | null)?.title ?? reg.event_id}</Link>
                      </p>
                      <small>
                        {(reg.event as { start_time: string } | null)?.start_time
                          ? new Date((reg.event as { start_time: string }).start_time).toLocaleString()
                          : ''}{' '}
                        &middot; <strong>{registrationStatus(reg.status)}</strong>
                        {reg.status === 'waitlisted' && reg.waitlist_position
                          ? ` (#${reg.waitlist_position})`
                          : ''}
                      </small>
                    </div>
                  </div>
                  {(reg.status === 'pending' || reg.status === 'approved' || reg.status === 'waitlisted') ? (
                    <div>
                      <button type="button" onClick={() => void handleCancel(reg.event_id)} disabled={submitting}>
                        {t('eventDetail.cancelRegistration')}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Layout>
  )
}
