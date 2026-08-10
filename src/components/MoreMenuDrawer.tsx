import { useEffect } from 'react'
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

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

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
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <nav className="more-drawer-body">
          <h3 className="more-drawer-section-title">{t('nav.activityGroup')}</h3>
          <Link to="/messages" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-message" size={20} />
            <span>{t('nav.messages')}</span>
          </Link>
          <Link to="/following" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-profile" size={20} />
            <span>{t('nav.following')}</span>
          </Link>
          <Link to="/registrations/me" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-calendar" size={20} />
            <span>{t('nav.myRegistrations')}</span>
          </Link>
          <Link to="/settings/analytics" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-chart" size={20} />
            <span>{t('nav.analytics')}</span>
          </Link>

          <div className="more-drawer-divider" />
          <h3 className="more-drawer-section-title">{t('nav.notificationsGroup')}</h3>
          <Link to="/settings/notifications" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-bell" size={20} />
            <span>{t('nav.notificationSettings')}</span>
          </Link>

          <div className="more-drawer-divider" />
          <h3 className="more-drawer-section-title">{t('nav.accountGroup')}</h3>
          <div className="more-drawer-item more-drawer-lang">
            <Icon href="/nav-icons.svg" name="nav-language" size={20} />
            <span>{t('common.language')}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label={t('common.language')}
            >
              {locales.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <Link to="/settings/security-privacy" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-lock" size={20} />
            <span>{t('nav.securityPrivacy')}</span>
          </Link>

          <div className="more-drawer-divider" />
          <h3 className="more-drawer-section-title">{t('nav.supportGroup')}</h3>
          <Link to="/issues" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-flag" size={20} />
            <span>{t('nav.myIssues')}</span>
          </Link>

          <Link to="/reports/me" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-shield" size={20} />
            <span>{t('nav.myReports')}</span>
          </Link>

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
