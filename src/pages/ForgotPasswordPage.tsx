import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { TurnstileCaptcha } from '../components/TurnstileCaptcha'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0)
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim()) {
      setMessage(t('auth.emailRequired'))
      return
    }
    if (turnstileSiteKey && !captchaToken) {
      setMessage(t('auth.captchaRequired'))
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
      captchaToken: captchaToken || undefined,
    })
    setLoading(false)
    setCaptchaToken('')
    setCaptchaResetSignal((value) => value + 1)

    if (error) {
      setMessage(t('auth.passwordResetRequestError'))
      return
    }
    setMessage(t('auth.passwordResetRequestSent'))
  }

  return (
    <Layout>
      <form className="card auth-card" onSubmit={submit}>
        <h1>{t('auth.forgotPassword')}</h1>
        <p className="form-help">{t('auth.passwordResetHelp')}</p>
        <label className="form-field">
          <span className="form-label-row">{t('common.email')}</span>
          <input
            aria-label={t('common.email')}
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {turnstileSiteKey ? (
          <div className="auth-captcha" aria-describedby="password-reset-captcha-help">
            <TurnstileCaptcha
              siteKey={turnstileSiteKey}
              resetSignal={captchaResetSignal}
              onToken={setCaptchaToken}
              onError={(reason) => setMessage(reason === 'expired' ? t('auth.captchaExpired') : t('auth.captchaError'))}
            />
            <p id="password-reset-captcha-help" className="form-help" aria-live="polite">
              {captchaToken ? t('auth.captchaVerified') : t('auth.captchaHelp')}
            </p>
          </div>
        ) : null}
        <button type="submit" disabled={loading}>
          {t('auth.sendPasswordReset')}
        </button>
        {message ? <p className="message" role="status">{message}</p> : null}
        <button type="button" className="text-button" onClick={() => navigate('/auth')}>
          {t('auth.backToSignIn')}
        </button>
      </form>
    </Layout>
  )
}
