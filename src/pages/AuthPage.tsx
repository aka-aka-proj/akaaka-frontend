import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { TurnstileCaptcha } from '../components/TurnstileCaptcha'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_login_credentials: '電子郵件或密碼不正確',
  'Invalid login credentials': '電子郵件或密碼不正確',
  email_not_confirmed: '電子郵件尚未驗證，請先完成驗證後再登入',
  signup_disabled: '註冊功能目前已關閉',
  too_many_requests: '登入嘗試次數過多，請稍後再試',
  over_request_rate_limit: '請求過於頻繁，請稍後再試',
  'User already registered': '此電子郵件已註冊，請使用原有的社交登入方式（Google、Facebook 或 Apple）登入。',
  'A user with this email address has already been registered': '此電子郵件已註冊，請使用原有的社交登入方式（Google、Facebook 或 Apple）登入。',
}

type SocialProvider = 'google' | 'facebook' | 'x'

export function AuthPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useT()

  console.log('Current state:', location.state);
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error_description') ?? params.get('error')
    if (error) {
      setMessage(t('auth.socialLoginError'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [t])

  useEffect(() => {
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current)
      }
    }
  }, [])

  const startCooldown = useCallback(() => {
    setResendCooldown(60)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current)
            cooldownRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage(t('auth.resendSuccess'))
    startCooldown()
  }

  const signInWithSocial = async (provider: SocialProvider) => {
    setMessage('')
    const params = new URLSearchParams(location.search)
    const fromQuery = params.get('from')
    const fromState = (location.state as { from?: string } | null)?.from
    const from = fromQuery ?? fromState

    const redirectTo = from
      ? `${window.location.origin}/onboarding?from=${encodeURIComponent(from)}`
      : `${window.location.origin}/onboarding`

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    })
    if (error) {
      setMessage(t('auth.socialLoginError'))
    }
  }

  useEffect(() => {
    if (user) {
      const params = new URLSearchParams(location.search)
      const fromQuery = params.get('from')
      const fromState = (location.state as { from?: string } | null)?.from
      const from = fromQuery ?? fromState
      
      console.log("登入成功，導向來源：", from);
      navigate(from ?? '/events', { replace: true })
    }
  }, [user, navigate, location.search, location.state])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (email.trim().length === 0 || password.trim().length === 0) {
      setMessage(t('auth.emailRequired'))
      return
    }
    if (turnstileSiteKey && !captchaToken) {
      setMessage(t('auth.captchaRequired'))
      return
    }

    setLoading(true)
    const authOptions = captchaToken ? { captchaToken } : undefined
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password, options: authOptions })
      setLoading(false)
      setCaptchaToken('')
      setCaptchaResetSignal((value) => value + 1)
      if (error) {
        setMessage(AUTH_ERROR_MESSAGES[error.message] ?? error.message)
        return
      }

      setMessage(t('auth.signUpSuccess'))
      setShowVerificationPrompt(true)
      startCooldown()
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password, options: authOptions })
    setLoading(false)
    setCaptchaToken('')
    setCaptchaResetSignal((value) => value + 1)
    if (error) {
      if (error.message === 'invalid_login_credentials') {
        const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
        if (!resendError) {
          setMessage(t('auth.emailNotConfirmed'))
          startCooldown()
          return
        }
      }
      setMessage(AUTH_ERROR_MESSAGES[error.message] ?? error.message)
      return
    }
  }

  return (
    <Layout>
      {showVerificationPrompt ? (
        <div className="card auth-card">
          <img src="/logo-login.svg" alt="AkaAka" width={800} height={160} className="auth-logo" />
          <h1>{t('auth.signUp')}</h1>
          <p className="message">{t('auth.verificationSent')}</p>
          <p className="verification-email">{email}</p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0
              ? t('auth.resendCooldown', { seconds: String(resendCooldown) })
              : t('auth.resendVerification')}
          </button>
          <button type="button" onClick={() => { setShowVerificationPrompt(false); setIsSignUp(false); setMessage(''); navigate('/auth', { replace: true }) }}>
            {t('auth.backToSignIn')}
          </button>
          {message ? <p className="message">{message}</p> : null}
        </div>
      ) : (
      <form className="card auth-card" onSubmit={submit}>
        <h1>{isSignUp ? t('auth.signUp') : t('auth.signIn')}</h1>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          <button type="button" className="social-btn" onClick={() => signInWithSocial('google')} aria-label={t('auth.continueWithGoogle')}>
            <Icon href="/social-icons.svg" name="social-google" size={24} />
          </button>
          <button type="button" className="social-btn" onClick={() => signInWithSocial('facebook')} aria-label={t('auth.continueWithFacebook')}>
            <Icon href="/social-icons.svg" name="social-facebook" size={24} />
          </button>
          <button type="button" className="social-btn" onClick={() => signInWithSocial('x')} aria-label={t('auth.continueWithTwitter')}>
            <Icon href="/social-icons.svg" name="social-x" size={24} />
          </button>
        </div>
        <div className="social-divider">{t('auth.orContinueWith')}</div>
        <label className="form-field">
          <span className="form-label-row">
            <Icon href="/form-icons.svg" name="form-user" size={16} /> {t('common.email')}
          </span>
          <input
            aria-label={t('common.email')}
            type="email"
            value={email}
            autoComplete="email"
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
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
        </button>
        {!isSignUp ? (
          <button type="button" className="text-button" onClick={() => navigate('/auth/forgot-password')}>
            {t('auth.forgotPassword')}
          </button>
        ) : null}
        {turnstileSiteKey ? (
          <div className="auth-captcha" aria-describedby="auth-captcha-help">
            <TurnstileCaptcha
              siteKey={turnstileSiteKey}
              resetSignal={captchaResetSignal}
              onToken={setCaptchaToken}
              onError={(reason) => setMessage(reason === 'expired' ? t('auth.captchaExpired') : t('auth.captchaError'))}
            />
            <p id="auth-captcha-help" className="form-help" aria-live="polite">
              {captchaToken ? t('auth.captchaVerified') : t('auth.captchaHelp')}
            </p>
          </div>
        ) : null}
        <button type="button" onClick={() => setIsSignUp((value) => !value)}>
          {isSignUp ? t('auth.haveAccount') : t('auth.needAccount')}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
      )}
    </Layout>
  )
}
