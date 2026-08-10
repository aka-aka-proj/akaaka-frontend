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

interface MfaFactor {
  id: string
  friendly_name?: string | null
  status: 'verified' | 'unverified'
  factor_type: string
}

interface TotpEnrollment {
  id: string
  qr_code: string
  secret: string
}

export function SecurityPrivacyPage() {
  const { user } = useAuth()
  const { t } = useT()
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([])
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollment | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaMessage, setMfaMessage] = useState('')
  const [mfaError, setMfaError] = useState('')

  const loadMfaFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      setMfaError(error.message)
      return
    }
    setMfaFactors((data?.all ?? []) as MfaFactor[])
  }

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
    if (user) void loadMfaFactors()
  }, [user?.id])

  const beginMfaEnrollment = async () => {
    setMfaLoading(true)
    setMfaError('')
    setMfaMessage('')
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'AkaAka Authenticator',
    })
    setMfaLoading(false)
    if (error) {
      setMfaError(error.message)
      return
    }
    setMfaEnrollment({
      id: data.id,
      qr_code: data.totp.qr_code,
      secret: data.totp.secret,
    })
  }

  const verifyMfaEnrollment = async () => {
    if (!mfaEnrollment || !mfaCode.trim()) return
    setMfaLoading(true)
    setMfaError('')
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollment.id })
    if (challengeError) {
      setMfaLoading(false)
      setMfaError(challengeError.message)
      return
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaEnrollment.id,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    })
    setMfaLoading(false)
    if (error) {
      setMfaError(error.message)
      return
    }
    setMfaEnrollment(null)
    setMfaCode('')
    setMfaMessage(t('securityPrivacy.mfaEnabled'))
    await loadMfaFactors()
  }

  const removeMfaFactor = async (factorId: string) => {
    setMfaLoading(true)
    setMfaError('')
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    setMfaLoading(false)
    if (error) {
      setMfaError(error.message)
      return
    }
    setMfaMessage(t('securityPrivacy.mfaRemoved'))
    await loadMfaFactors()
  }

  return (
    <Layout>
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

      <section className="card" aria-labelledby="mfa-title">
        <h2 id="mfa-title" style={{ fontSize: 20, marginBottom: 8 }}>
          <Icon href="/form-icons.svg" name="form-lock" size={20} /> {t('securityPrivacy.mfaTitle')}
        </h2>
        <p>{t('securityPrivacy.mfaDescription')}</p>
        {mfaError ? <p className="message" role="alert">{mfaError}</p> : null}
        {mfaMessage ? <p className="message" role="status">{mfaMessage}</p> : null}
        {mfaFactors.filter((factor) => factor.status === 'verified').map((factor) => (
          <div key={factor.id} className="section-heading-row">
            <span>{factor.friendly_name || t('securityPrivacy.mfaAuthenticator')}</span>
            <button type="button" onClick={() => void removeMfaFactor(factor.id)} disabled={mfaLoading}>
              {t('securityPrivacy.mfaRemove')}
            </button>
          </div>
        ))}
        {!mfaEnrollment ? (
          <button type="button" onClick={() => void beginMfaEnrollment()} disabled={mfaLoading}>
            {mfaLoading ? t('common.loading') : t('securityPrivacy.mfaAdd')}
          </button>
        ) : (
          <div className="card" style={{ marginTop: 12 }}>
            <p>{t('securityPrivacy.mfaScanPrompt')}</p>
            <img src={mfaEnrollment.qr_code} alt={t('securityPrivacy.mfaQrAlt')} width={220} height={220} />
            <p><strong>{t('securityPrivacy.mfaSecret')}</strong> {mfaEnrollment.secret}</p>
            <label>
              {t('securityPrivacy.mfaCode')}
              <input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} />
            </label>
            <button type="button" onClick={() => void verifyMfaEnrollment()} disabled={mfaLoading || !mfaCode.trim()}>
              {mfaLoading ? t('common.loading') : t('securityPrivacy.mfaVerify')}
            </button>
          </div>
        )}
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
