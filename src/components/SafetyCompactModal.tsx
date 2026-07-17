import { useEffect, useRef } from 'react'
import { useT } from '../hooks/useT'

interface SafetyCompactModalProps {
  open: boolean
  onClose: () => void
  onAgree: () => void
}

export function SafetyCompactModal({ open, onClose, onAgree }: SafetyCompactModalProps) {
  const { t } = useT()
  const dialogRef = useRef<HTMLDialogElement>(null)

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

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handleClose = () => onClose()
    el.addEventListener('close', handleClose)
    return () => el.removeEventListener('close', handleClose)
  }, [onClose])

  return (
    <dialog ref={dialogRef} className="modal" aria-label={t('onboarding.compactTitle')}>
      <div className="modal-content">
        <h2>{t('onboarding.compactTitle')}</h2>
        <div className="modal-body">
          <p>{t('onboarding.compactIntro')}</p>

          <h3>{t('onboarding.compactConsentTitle')}</h3>
          <p>{t('onboarding.compactConsentBody')}</p>

          <h3>{t('onboarding.compactBoundariesTitle')}</h3>
          <p>{t('onboarding.compactBoundariesBody')}</p>

          <h3>{t('onboarding.compactSafetyTitle')}</h3>
          <p>{t('onboarding.compactSafetyBody')}</p>

          <h3>{t('onboarding.compactOfflineTitle')}</h3>
          <p>{t('onboarding.compactOfflineBody')}</p>

          <h3>{t('onboarding.compactZeroToleranceTitle')}</h3>
          <p>{t('onboarding.compactZeroToleranceBody')}</p>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t('onboarding.compactClose')}
          </button>
          <button type="button" className="primary" onClick={onAgree}>
            {t('onboarding.compactAgree')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
