import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { t } = useT()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || !confirmation) {
      setMessage(t('auth.passwordRequired'))
      return
    }
    if (password !== confirmation) {
      setMessage(t('auth.passwordMismatch'))
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setLoading(false)
      setMessage(t('auth.passwordResetError'))
      return
    }
    await supabase.auth.signOut()
    setLoading(false)
    setMessage(t('auth.passwordResetSuccess'))
  }

  return (
    <Layout>
      <form className="card auth-card" onSubmit={submit}>
        <h1>{t('auth.resetPassword')}</h1>
        <p className="form-help">{t('auth.resetPasswordHelp')}</p>
        <label className="form-field">
          <span className="form-label-row">{t('common.password')}</span>
          <input aria-label={t('auth.newPassword')} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="form-field">
          <span className="form-label-row">{t('auth.confirmPassword')}</span>
          <input aria-label={t('auth.confirmPassword')} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        <button type="submit" disabled={loading}>{t('auth.saveNewPassword')}</button>
        {message ? <p className="message" role="status">{message}</p> : null}
        {!loading && message === t('auth.passwordResetSuccess') ? (
          <button type="button" className="text-button" onClick={() => navigate('/auth')}>{t('auth.backToSignIn')}</button>
        ) : null}
      </form>
    </Layout>
  )
}
