import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import type { ReportItem } from '../types'

export function ProfileReportPage() {
  const { id } = useParams()
  const { t } = useT()
  const { user } = useAuth()
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetProfileId = id === undefined || id === 'me' ? user?.id ?? '' : id

  useEffect(() => {
    const fetchReports = async () => {
      if (!targetProfileId || !user) return
      setLoading(true)
      
      const query = supabase
        .from('reports')
        .select('*')
        .eq('target_profile_id', targetProfileId)
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        setError(error.message)
      } else {
        setReports((data as ReportItem[]) || [])
      }
      setLoading(false)
    }

    void fetchReports()
  }, [targetProfileId, user])

  const getCategoryLabel = (category: string) => {
    const key = category.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
    return t(`report.${key}`) || category
  }

  return (
    <Layout>
      <section className="card">
        {loading ? (
          <p>{t('common.loading')}</p>
        ) : error ? (
          <p className="message error">{error}</p>
        ) : reports.length > 0 ? (
          <ul className="report-list" style={{ listStyle: 'none', padding: 0 }}>
            {reports.map((report) => (
              <li key={report.id} className="report-item" style={{ borderBottom: '1px solid var(--border-color)', padding: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>
                    {getCategoryLabel(report.category)}
                  </p>
                  <span className={`status status-${report.status}`} style={{ fontSize: '0.75rem' }}>
                    {report.status}
                  </span>
                </div>
                <p style={{ margin: '0 0 0.5rem 0', whiteSpace: 'pre-wrap' }}>{report.details}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  <span />
                  <time>
                    {new Date(report.created_at).toLocaleDateString()}
                  </time>
                </div>
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
