import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export function ProfileReportPage() {
  const { id } = useParams()
  const { t } = useT()
  const { user } = useAuth()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReports = async () => {
      if (!id || !user) return
      setLoading(true)
      // Only fetch reports where the current user is the reporter, for the target profile
      const { data, error } = await supabase
        .from('reports')
        .select('id, category, details, status, created_at')
        .eq('target_profile_id', id)
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setReports(data || [])
      }
      setLoading(false)
    }

    void fetchReports()
  }, [id, user])

  return (
    <Layout title={t('profile.reportTitle')}>
      <section className="card">
        {loading ? (
          <p>{t('common.loading')}</p>
        ) : error ? (
          <p className="message error">{error}</p>
        ) : reports.length > 0 ? (
          <ul className="report-list" style={{ listStyle: 'none', padding: 0 }}>
            {reports.map((report) => (
              <li key={report.id} className="report-item" style={{ borderBottom: '1px solid var(--border-color)', padding: '1rem 0' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>{report.category}</p>
                <p style={{ margin: '0 0 0.5rem 0' }}>{report.details}</p>
                <p style={{ margin: '0 0 0.5rem 0' }}>Status: {report.status}</p>
                <time style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {new Date(report.created_at).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('profile.noReports')}</p>
        )}
      </section>
    </Layout>
  )
}
