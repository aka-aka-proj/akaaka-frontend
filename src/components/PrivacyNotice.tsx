import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../hooks/useT'

export function PrivacyNotice() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const popoverId = useId()
  const openedByHoverRef = useRef(false)
  const toggleOpen = () => setOpen((value) => !value)

  return (
    <div
      className="privacy-notice"
      onMouseLeave={() => {
        openedByHoverRef.current = false
        setOpen(false)
      }}
    >
      <button
        type="button"
        className="privacy-notice__trigger"
        aria-label={t('privacyNotice.label')}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          if (openedByHoverRef.current) {
            openedByHoverRef.current = false
            setOpen(true)
            return
          }
          toggleOpen()
        }}
        onMouseEnter={() => {
          openedByHoverRef.current = true
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleOpen()
          }
        }}
        title={t('privacyNotice.label')}
      >
        i
      </button>
      {open ? (
        <div id={popoverId} className="privacy-notice__popover" role="status">
          <strong>{t('privacyNotice.title')}</strong>
          <p>{t('privacyNotice.body')}</p>
          <Link to="/settings/security-privacy" onClick={() => setOpen(false)}>
            {t('privacyNotice.learnMore')}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
