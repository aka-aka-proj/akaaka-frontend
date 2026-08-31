import { useCallback, useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { ShareToXModal } from '../components/ShareToXModal'
import type { ShareTemplateType } from '../components/ShareToXModal'
import { useAuth } from '../context/AuthContext'
import { useError } from '../context/ErrorContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { UserStats } from '../types'

type Period = 'weekly' | 'monthly' | 'all'

interface StatCardProps {
  label: string
  value: number | string
  unit?: string
  color?: string
}

function StatCard({ label, value, unit, color = '#aa3bff' }: StatCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        border: '1px solid #e5e7eb',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '2rem', fontWeight: 700, color, lineHeight: 1.2 }}>
        {value}
        {unit ? <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.25rem' }}>{unit}</span> : null}
      </div>
      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )
}

function AttendanceRing({ rate, size = 120 }: { rate: number; size?: number }) {
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (rate / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#aa3bff"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="1.5rem"
          fontWeight={700}
          fill="#111827"
        >
          {rate}%
        </text>
      </svg>
      <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{useT().t('analytics.attendanceRate')}</div>
    </div>
  )
}

export function AnalyticsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const { showError } = useError()

  const [period, setPeriod] = useState<Period>('all')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Share modal state
  const [shareOpen, setShareOpen] = useState(false)
  const [shareType, setShareType] = useState<ShareTemplateType>('participant_review')

  const loadStats = useCallback(async (p: Period) => {
    if (!user) return
    setLoading(true)

    const { data, error } = await supabase.functions.invoke('get-user-analytics', {
      body: { user_id: user.id, period: p },
    })

    setLoading(false)

    if (error) {
      showError(t('analytics.loadError'), error)
      return
    }

    if (data && data.success) {
      setStats(data.stats as UserStats)
    } else {
      showError(t('analytics.loadError'), null)
    }
  }, [user, t, showError])

  useEffect(() => {
    void loadStats(period)
  }, [loadStats, period])

  const handleShare = (type: ShareTemplateType) => {
    setShareType(type)
    setShareOpen(true)
  }

  const periodButtons: { key: Period; label: string }[] = [
    { key: 'weekly', label: t('analytics.weekly') },
    { key: 'monthly', label: t('analytics.monthly') },
    { key: 'all', label: t('analytics.all') },
  ]

  return (
    <Layout>
      <section className="card" style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem' }}>{t('analytics.title')}</h2>

        {/* Period selector */}
        <div className="chip-group" style={{ marginBottom: '1.25rem' }}>
          {periodButtons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`chip${period === key ? ' chip-active' : ''}`}
              onClick={() => setPeriod(key)}
              style={{
                background: period === key ? '#aa3bff' : undefined,
                color: period === key ? '#fff' : undefined,
                border: period === key ? '1px solid #aa3bff' : '1px solid #d1d5db',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>{t('common.loading')}</p>
        ) : stats ? (
          <>
            {/* Attendance ring */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <AttendanceRing rate={stats.attendanceRate} />
            </div>

            {/* Stat cards grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                marginBottom: '1.5rem',
              }}
            >
              <StatCard label={t('analytics.hostedEvents')} value={stats.hostedEvents} />
              <StatCard label={t('analytics.totalRegistrations')} value={stats.totalRegistrations} />
              <StatCard label={t('analytics.totalApproved')} value={stats.totalApproved} />
              <StatCard label={t('analytics.approvalRate')} value={stats.approvalRate} unit="%" />
              <StatCard label={t('analytics.waitlistConversions')} value={stats.waitlistConversions} />
              <StatCard label={t('analytics.checkedIn')} value={stats.checkedInRegistrations} />
              <StatCard label={t('analytics.eventsParticipated')} value={stats.eventsParticipated} />
              <StatCard label={t('analytics.approvedParticipations')} value={stats.approvedParticipations} />
              <StatCard
                label={t('analytics.reputationGained')}
                value={stats.reputationGained}
                color="#f59e0b"
              />
              <StatCard
                label={t('analytics.reportCount')}
                value={stats.reportCount}
                color={stats.reportCount > 0 ? '#ef4444' : '#6b7280'}
              />
            </div>

            {/* Hosted tags */}
            {stats.hostedTags.length > 0 ? (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem' }}>{t('analytics.hostedTags')}</div>
                <div className="chip-group">
                  {stats.hostedTags.map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Share buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleShare('host_weekly')}
                disabled={stats.hostedEvents === 0}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  background: stats.hostedEvents === 0 ? '#f3f4f6' : '#000',
                  color: stats.hostedEvents === 0 ? '#9ca3af' : '#fff',
                  cursor: stats.hostedEvents === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {t('analytics.shareAsHost')}
              </button>
              <button
                type="button"
                onClick={() => handleShare('participant_review')}
                disabled={stats.eventsParticipated === 0}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  background: stats.eventsParticipated === 0 ? '#f3f4f6' : '#000',
                  color: stats.eventsParticipated === 0 ? '#9ca3af' : '#fff',
                  cursor: stats.eventsParticipated === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {t('analytics.shareAsParticipant')}
              </button>
            </div>
          </>
        ) : (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>{t('analytics.noData')}</p>
        )}
      </section>

      <ShareToXModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        templateType={shareType}
        data={{
          stats: stats ?? undefined,
          profileUrl: user ? `${window.location.origin}/profile/${user.id}` : undefined,
          tags: stats?.exploredTags ?? [],
        }}
      />
    </Layout>
  )
}
