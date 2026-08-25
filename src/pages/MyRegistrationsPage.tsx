import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { Registration } from '../types'

export function MyRegistrationsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      return
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .select('*, event:events(id, title, start_time)')
      .eq('profile_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      return
    }

    setRegistrations((data as Registration[]) ?? [])
  }, [user])

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
      <section className="card">
        {message ? <p className="message">{message}</p> : null}
        {registrations.length === 0 ? (
          <div className="empty-state">
            <p>{t('myRegistrations.noRegistrations')}</p>
          </div>
        ) : (
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
        )}
      </section>
    </Layout>
  )
}
