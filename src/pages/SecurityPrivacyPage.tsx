import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

interface AuditEntry {
  id: string
  actor_id: string
  action: string
  payload: Record<string, unknown>
  created_at: string
}

export function SecurityPrivacyPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')

  const loadAuditLogs = async () => {
    if (!user) return
    setAuditLoading(true)
    setAuditError('')

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('target_profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      setAuditError(error.message)
    } else {
      setAuditLogs((data ?? []) as AuditEntry[])
    }
    setAuditLoading(false)
  }

  useEffect(() => {
    void loadAuditLogs()
  }, [user?.id])

  return (
    <Layout title={t('securityPrivacy.title')}>
      <section className="card">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>
          <Icon href="/form-icons.svg" name="form-lock" size={20} /> {t('securityPrivacy.storageTitle')}
        </h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>{t('securityPrivacy.storageVercel')}</li>
          <li>{t('securityPrivacy.storageSupabase')}</li>
          <li>{t('securityPrivacy.storagePgRls')}</li>
        </ul>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>
          <Icon href="/action-icons.svg" name="action-trash" size={20} /> {t('securityPrivacy.lifecycleTitle')}
        </h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>{t('securityPrivacy.lifecycleCascade')}</li>
          <li>{t('securityPrivacy.lifecycleRetention')}</li>
        </ul>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>
          <Icon href="/action-icons.svg" name="action-block" size={20} /> {t('securityPrivacy.securityTitle')}
        </h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>{t('securityPrivacy.securityRls')}</li>
          <li>{t('securityPrivacy.securityVisibility')}</li>
          <li>{t('securityPrivacy.securityVenue')}</li>
          <li>{t('securityPrivacy.securityPositive')}</li>
          <li>{t('securityPrivacy.securityBlockReport')}</li>
        </ul>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>
          <Icon href="/report-icons.svg" name="report-safety-risk" size={20} /> {t('securityPrivacy.auditTitle')}
        </h2>
        <p>{t('securityPrivacy.auditDesc')}</p>
        <button
          type="button"
          onClick={() => void loadAuditLogs()}
          disabled={auditLoading}
          style={{ marginBottom: 12 }}
        >
          {auditLoading ? t('common.loading') : t('securityPrivacy.auditViewLogs')}
        </button>
        {auditError ? <p className="message">{auditError}</p> : null}
        {auditLogs.length > 0 ? (
          <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
            {auditLogs.map((log) => (
              <li
                key={log.id}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid #eee',
                  fontSize: 14,
                }}
              >
                {log.action === 'role_status_change' ? (
                  <span>
                    {t('securityPrivacy.auditRoleChange', {
                      oldStatus: String(log.payload?.old_status ?? '?'),
                      newStatus: String(log.payload?.new_status ?? '?'),
                    })}
                  </span>
                ) : (
                  <span>{log.action}: {JSON.stringify(log.payload)}</span>
                )}
                <br />
                <span style={{ fontSize: 12, color: '#999' }}>
                  {t('securityPrivacy.auditTimestamp', {
                    time: new Date(log.created_at).toLocaleString(),
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          !auditLoading && <p style={{ color: '#999' }}>{t('securityPrivacy.auditNoLogs')}</p>
        )}
      </section>

      <section className="card">
        <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
          AkaAka — 安全、透明、隱私優先
        </p>
      </section>
    </Layout>
  )
}