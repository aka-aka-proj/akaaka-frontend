import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { locales, type Locale } from '../i18n'
import { supabase } from '../supabaseClient'
import { useT } from '../hooks/useT'
import { Icon } from './Icon'

interface MoreMenuDrawerProps {
  open: boolean
  onClose: () => void
}

export function MoreMenuDrawer({ open, onClose }: MoreMenuDrawerProps) {
  const { user } = useAuth()
  const { locale, setLocale } = useLanguage()
  const { t } = useT()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      // session 可能已失效，強制清除
    }
    onClose()
    navigate('/auth', { replace: true })
  }

  if (!open) return null

  return (
    <>
      <div className="more-drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="more-drawer" aria-label={t('nav.more')} role="dialog" aria-modal="true">
        <div className="more-drawer-header">
          <h2>{t('nav.more')}</h2>
          <button
            type="button"
            className="more-drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <nav className="more-drawer-body">
          <Link to="/registrations/me" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-calendar" size={20} />
            <span>{t('nav.myRegistrations')}</span>
          </Link>

          <Link to="/issues" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-flag" size={20} />
            <span>{t('nav.myIssues')}</span>
          </Link>

          <Link to="/reports/me" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-shield" size={20} />
            <span>{t('nav.myReports')}</span>
          </Link>

          <Link to="/settings/security-privacy" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-lock" size={20} />
            <span>{t('nav.securityPrivacy')}</span>
          </Link>

          <div className="more-drawer-divider" />

          <div className="more-drawer-item more-drawer-lang">
            <Icon href="/nav-icons.svg" name="nav-language" size={20} />
            <span>{t('common.language')}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label="Language"
            >
              {locales.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="more-drawer-divider" />

          {user ? (
            <button type="button" onClick={() => void handleSignOut()} className="more-drawer-item more-drawer-signout">
              <Icon href="/nav-icons.svg" name="nav-logout" size={20} />
              <span>{t('nav.signOut')}</span>
            </button>
          ) : null}
        </nav>
      </aside>
    </>
  )
}