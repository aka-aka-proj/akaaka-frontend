import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useError } from '../context/ErrorContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

export function ErrorPopup() {
  const { error, clearError } = useError()
  const { user } = useAuth()
  const { t } = useT()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const open = error !== null

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) {
      if (typeof el.showModal === 'function') {
        el.showModal()
      }
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  // Reset local submission states when popup opens/closes
  useEffect(() => {
    if (open) {
      setSubmitting(false)
      setSubmitSuccess(false)
      setSubmitError('')
    }
  }, [open])

  if (!open || !error) return null

  const handleReportIssue = async () => {
    setSubmitting(true)
    setSubmitError('')

    const titleStr = `[Auto Error Report] ${error.title || 'App Error'}`
    const descriptionParts = [
      `Message: ${error.message}`,
      `Response: ${error.response ? JSON.stringify(error.response, null, 2) : 'None'}`,
      `Debug Info: ${error.debugInfo ? JSON.stringify(error.debugInfo, null, 2) : 'None'}`,
      `User ID: ${user?.id || 'Anonymous'}`,
      `URL: ${window.location.href}`,
      `Timestamp: ${new Date().toISOString()}`,
    ]
    const descriptionStr = descriptionParts.join('\n\n')

    try {
      const { error: invokeError } = await supabase.functions.invoke('create-issue', {
        body: {
          title: titleStr,
          description: descriptionStr,
        },
      })

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to submit issue')
      }

      setSubmitSuccess(true)
    } catch (err: any) {
      setSubmitError(err.message || 'Network error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <dialog ref={dialogRef} className="modal" aria-label={t('errorPopup.title')}>
      <div className="modal-content" style={{ maxWidth: '100%' }}>
        <h2 style={{ color: '#b42318' }}>{t('errorPopup.title')}</h2>
        <div className="modal-body" tabIndex={0} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <p style={{ fontWeight: 'bold', fontSize: '1.05rem', margin: '0 0 0.5rem' }}>
            {error.message}
          </p>

          {error.response && (
            <div style={{ marginTop: '0.75rem' }}>
              <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.25rem' }}>{t('errorPopup.response')}</h3>
              <pre
                style={{
                  background: '#f6f8fa',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                  overflowX: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {typeof error.response === 'object'
                  ? JSON.stringify(error.response, null, 2)
                  : String(error.response)}
              </pre>
            </div>
          )}

          {error.debugInfo && (
            <div style={{ marginTop: '0.75rem' }}>
              <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.25rem' }}>{t('errorPopup.debugInfo')}</h3>
              <pre
                style={{
                  background: '#f6f8fa',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                  overflowX: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {typeof error.debugInfo === 'object'
                  ? JSON.stringify(error.debugInfo, null, 2)
                  : String(error.debugInfo)}
              </pre>
            </div>
          )}

          {submitSuccess && (
            <p style={{ color: '#027a48', fontWeight: 'bold', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
              {t('errorPopup.submitSuccess')}
            </p>
          )}

          {submitError && (
            <p style={{ color: '#b42318', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
              {t('errorPopup.submitError', { error: submitError })}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={clearError}>
            {t('errorPopup.close')}
          </button>
          {!submitSuccess && (
            <button
              type="button"
              className="primary animate-pulse"
              disabled={submitting}
              onClick={handleReportIssue}
              style={{
                background: '#0d6efd',
                borderColor: '#0d6efd',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {submitting ? t('errorPopup.submitting') : t('errorPopup.reportIssue')}
            </button>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
