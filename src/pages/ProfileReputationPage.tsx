import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import { normalizeSocialLinks } from '../lib/profile'

function mapProfileRow(row: unknown): Profile {
  const source = (row ?? {}) as Record<string, unknown>
  return {
    id: String(source.id ?? ''),
    role_status: (source.role_status as Profile['role_status']) ?? 'general',
    display_name: (source.display_name as string | null) ?? null,
    bio: (source.bio as string | null) ?? null,
    external_social_links: normalizeSocialLinks(source.external_social_links),
    metadata: (source.metadata as Profile['metadata']) ?? null,
    reputation_score: Number(source.reputation_score ?? 0),
  }
}

export function ProfileReputationPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useT()
  const targetProfileId = id === undefined || id === 'me' ? user?.id ?? '' : id
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reportCount, setReportCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!targetProfileId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetProfileId)
          .maybeSingle()

        if (profileError) throw profileError
        if (profileData) {
          setProfile(mapProfileRow(profileData))
        }

        const { data: reportStats, error: statsError } = await supabase
          .from('profile_report_stats')
          .select('report_count')
          .eq('profile_id', targetProfileId)
          .maybeSingle()

        if (statsError) throw statsError
        setReportCount(Number(reportStats?.report_count ?? 0))
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [targetProfileId])

  return (
    <Layout title={t('profile.reputation')}>
      <section className="card">
        {loading ? (
          <p>{t('common.loading')}</p>
        ) : error ? (
          <p className="message error">{error}</p>
        ) : profile ? (
          <div className="reputation-container">
            <div className="profile-header">
              <img src="/default-avatar.svg" alt="" width={64} height={64} className="avatar" />
              <div className="profile-info">
                <h2>{profile.display_name || profile.id}</h2>
              </div>
            </div>

            <div className="reputation-stats" style={{ marginTop: '2rem' }}>
              <div className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Icon href="/badge-icons.svg" name="reputation-star" size={32} />
                <div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('profile.reputation')}</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{profile.reputation_score}</p>
                </div>
              </div>

              <div className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon href="/report-icons.svg" name="report-safety-risk" size={32} />
                <div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('profile.reports')}</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{reportCount}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p>{t('profile.notFound')}</p>
        )}
      </section>
    </Layout>
  )
}
