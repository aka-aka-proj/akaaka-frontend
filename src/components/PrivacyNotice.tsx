import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../hooks/useT'

export function PrivacyNotice() {
  const { t } = useT()
  const [open, setOpen] = useState(false)

  return (
    <div className="privacy-notice" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="privacy-notice__trigger"
        aria-label={t('privacyNotice.label')}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        title={t('privacyNotice.label')}
      >
        i
      </button>
      {open ? (
        <div className="privacy-notice__popover" role="status">
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
