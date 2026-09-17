import { useEffect, useRef } from 'react'
import styles from './SafetyCompactModal.module.css'
import { useT } from '../hooks/useT'

interface SafetyCompactModalProps {
  open: boolean
  onClose: () => void
  onAgree: () => void
}

export function SafetyCompactModal({ open, onClose, onAgree }: SafetyCompactModalProps) {
  const { t } = useT()
  const bodyRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) {
      if (typeof el.showModal === 'function') {
        el.showModal()
        if (bodyRef.current) {
          bodyRef.current.scrollTop = 0
          bodyRef.current.focus()
        }
      }
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  const cancel = () => {
    dialogRef.current?.close()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={t('onboarding.compactTitle')}
      onCancel={(event) => {
        event.preventDefault()
        cancel()
      }}
    >
      <h2 className={styles.title}>{t('onboarding.compactTitle')}</h2>
      <div ref={bodyRef} className={styles.body} tabIndex={0}>
        <p>{t('onboarding.compactNextStep')}</p>
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

        <h3>{t('onboarding.compactPrivacyTitle')}</h3>
        <ul className="privacy-pledge-list">
          <li>{t('onboarding.compactPrivacyNoImages')}</li>
          <li>{t('onboarding.compactPrivacyVisibility')}</li>
          <li>{t('onboarding.compactPrivacyRLS')}</li>
          <li>{t('onboarding.compactPrivacyDeletion')}</li>
        </ul>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={cancel}>
          {t('onboarding.compactDisagree')}
        </button>
        <button type="button" className={styles.agree} onClick={onAgree}>
          {t('onboarding.compactAgree')}
        </button>
      </div>
    </dialog>
  )
}
