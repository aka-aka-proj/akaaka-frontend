import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../hooks/useT'

export function PrivacyNotice() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const popoverId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const openedByHoverRef = useRef(false)
  const toggleOpen = () => setOpen((value) => !value)

  return (
    <div
      ref={containerRef}
      className="privacy-notice"
      onMouseLeave={() => {
        if (containerRef.current?.contains(document.activeElement)) return
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
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 10.5v5.25M12 7.75h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
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
