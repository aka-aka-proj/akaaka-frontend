import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { ReportItem } from '../types'

export function MyReportsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [reports, setReports] = useState<ReportItem[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadReports = async () => {
      if (!user) {
        return
      }

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setMessage(error.message)
        return
      }

      setReports((data as ReportItem[]) ?? [])
    }

    void loadReports()
  }, [user])

  return (
    <Layout>
      <section className="card">
        {message ? <p className="message">{message}</p> : null}
        {reports.length === 0 ? (
          <div className="empty-state">
            <p>{t('myReports.title')}</p>
          </div>
        ) : (
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                <p>{report.category}</p>
                <p>{report.details}</p>
                <span className={`status status-${report.status}`}>{report.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  )
}
