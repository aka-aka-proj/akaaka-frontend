import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

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

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/events'} replace />
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
        setMessage(error.message)
        return
      }

      setMessage(t('auth.signUpSuccess'))
      navigate('/onboarding', { replace: true })
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }

    navigate('/events', { replace: true })
  }

  return (
    <Layout title={t('auth.title')}>
      <form className="card" onSubmit={submit}>
        <h2>{isSignUp ? t('auth.signUp') : t('auth.signIn')}</h2>
        <label>
          {t('common.email')}
          <input
            aria-label={t('common.email')}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          {t('common.password')}
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
