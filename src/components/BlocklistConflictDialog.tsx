import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../hooks/useT'
import styles from './BlocklistConflictDialog.module.css'

interface Props {
  open: boolean
  kind: 'register' | 'series' | 'review'
  hostId?: string
  returnFocus?: HTMLElement
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function BlocklistConflictDialog({ open, kind, hostId, returnFocus, busy, onConfirm, onCancel }: Props) {
  const { t } = useT()
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLElement | undefined>(undefined)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) { trigger.current = returnFocus; element.showModal(); cancel.current?.focus() }
    if (!open && element.open) { element.close(); if (trigger.current?.isConnected) trigger.current.focus() }
  }, [open, returnFocus])
  return (
    <dialog ref={dialog} className={`modal ${styles.dialog}`} role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
      <div className="modal-content">
        <h2 id={`${id}-title`}>{t('blocklist.warningTitle')}</h2>
        <div className="modal-body">
          <p id={`${id}-description`}>{t(kind === 'review' ? 'blocklist.reviewWarning' : kind === 'series' ? 'blocklist.seriesWarning' : 'blocklist.registrationWarning')}</p>
          {kind !== 'review' && hostId ? <>
            <p><Link to={`/messages/new?user=${encodeURIComponent(hostId)}`} onClick={onCancel}>{t('blocklist.contactHost')}</Link></p>
            <p>{t('blocklist.chatRequirement')} <Link to={`/profile/${encodeURIComponent(hostId)}`} onClick={onCancel}>{t('blocklist.hostProfile')}</Link></p>
          </> : null}
          {kind === 'review' ? <p>{t('blocklist.reviewPrivacy')}</p> : null}
        </div>
        <div className="modal-actions">
          <button ref={cancel} type="button" disabled={busy} onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" className={styles.confirm} disabled={busy} onClick={onConfirm}>
            {busy ? t('common.processing') : t(kind === 'review' ? 'blocklist.approveAnyway' : 'blocklist.agree')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
