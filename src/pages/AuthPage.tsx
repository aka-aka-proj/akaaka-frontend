import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_login_credentials: '電子郵件或密碼不正確',
  email_not_confirmed: '電子郵件尚未驗證，請先完成驗證後再登入',
  signup_disabled: '註冊功能目前已關閉',
  too_many_requests: '登入嘗試次數過多，請稍後再試',
  over_request_rate_limit: '請求過於頻繁，請稍後再試',
}

type SocialProvider = 'google' | 'facebook' | 'apple'

export function AuthPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useT()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error_description') ?? params.get('error')
    if (error) {
      setMessage(t('auth.socialLoginError'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [t])

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/events'} replace />
  }

  const signInWithSocial = async (provider: SocialProvider) => {
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/events`,
      },
    })
    if (error) {
      setMessage(t('auth.socialLoginError'))
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (email.trim().length === 0 || password.trim().length === 0) {
      setMessage(t('auth.emailRequired'))
      return
    }

    setLoading(true)
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (error) {
        setMessage(AUTH_ERROR_MESSAGES[error.message] ?? error.message)
        return
      }

      setMessage(t('auth.signUpSuccess'))
      navigate('/onboarding', { replace: true })
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setMessage(AUTH_ERROR_MESSAGES[error.message] ?? error.message)
      return
    }

    navigate('/events', { replace: true })
  }

  return (
    <Layout title={t('auth.title')}>
      <form className="card auth-card" onSubmit={submit}>
        <img src="/logo-login.svg" alt="AkaAka" width={80} height={80} className="auth-logo" />
        <h2>{isSignUp ? t('auth.signUp') : t('auth.signIn')}</h2>
        <button type="button" className="social-btn" onClick={() => signInWithSocial('google')}>
          <Icon href="/social-icons.svg" name="social-google" size={20} />
          {t('auth.continueWithGoogle')}
        </button>
        <button type="button" className="social-btn" onClick={() => signInWithSocial('facebook')}>
          <Icon href="/social-icons.svg" name="social-facebook" size={20} />
          {t('auth.continueWithFacebook')}
        </button>
        <button type="button" className="social-btn" onClick={() => signInWithSocial('apple')}>
          <Icon href="/social-icons.svg" name="social-apple" size={20} />
          {t('auth.continueWithApple')}
        </button>
        <div className="social-divider">{t('auth.orContinueWith')}</div>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-user" size={16} /> {t('common.email')}
          </span>
          <input
            aria-label={t('common.email')}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-lock" size={16} /> {t('common.password')}
          </span>
          <input
            aria-label={t('common.password')}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
        </button>
        <button type="button" onClick={() => setIsSignUp((value) => !value)}>
          {isSignUp ? t('auth.haveAccount') : t('auth.needAccount')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
