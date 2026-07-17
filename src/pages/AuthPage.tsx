import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

export function AuthPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
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
      setMessage('Email and password are required.')
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

      setMessage('Sign up successful.')
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
    <Layout title="AkaAka Auth">
      <form className="card" onSubmit={submit}>
        <h2>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
        <label>
          Email
          <input
            aria-label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            aria-label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {isSignUp ? 'Create account' : 'Sign in'}
        </button>
        <button type="button" onClick={() => setIsSignUp((value) => !value)}>
          {isSignUp ? 'Have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
