import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIconTheme, getIconSrc } from '../context/IconThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { locales, type Locale } from '../i18n'
import { supabase } from '../supabaseClient'
import { useT } from '../hooks/useT'
import { Icon } from './Icon'

const BOTTOM_NAV_ITEMS = [
  { to: '/events', icon: 'nav-events', labelKey: 'nav.events' },
  { to: '/events/new', icon: 'nav-create', labelKey: 'nav.createEvent' },
  { to: '/registrations/me', icon: 'nav-events', labelKey: 'nav.myRegistrations' },
  { to: '/profile/me', icon: 'nav-profile', labelKey: 'nav.myProfile' },
  { to: '/reports/me', icon: 'nav-reports', labelKey: 'nav.myReports' },
  { to: '/issues', icon: 'nav-reports', labelKey: 'nav.myIssues' },
] as const

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useAuth()
  const { iconTheme } = useIconTheme()
  const { locale, setLocale } = useLanguage()
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      // session 可能已失效，強制清除本地狀態並導向登入頁
    }
    navigate('/auth', { replace: true })
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-brand">
          <Link to="/">
            <img src={getIconSrc(iconTheme, 'logo')} alt="AkaAka" width={120} height={40} />
          </Link>
          <span className="topbar-title">{title}</span>
        </div>
        {user ? (
          <nav className="nav desktop-nav">
            <Link to="/events"><Icon href="/nav-icons.svg" name="nav-events" size={16} /> {t('nav.events')}</Link>
            <Link to="/events/new"><Icon href="/nav-icons.svg" name="nav-create" size={16} /> {t('nav.createEvent')}</Link>
            <Link to="/registrations/me"><Icon href="/nav-icons.svg" name="nav-events" size={16} /> {t('nav.myRegistrations')}</Link>
            <Link to="/profile/me"><Icon href="/nav-icons.svg" name="nav-profile" size={16} /> {t('nav.myProfile')}</Link>
            <Link to="/reports/me"><Icon href="/nav-icons.svg" name="nav-reports" size={16} /> {t('nav.myReports')}</Link>
            <Link to="/issues"><Icon href="/nav-icons.svg" name="nav-reports" size={16} /> {t('nav.myIssues')}</Link>
            <label className="lang-switch">
              <Icon href="/nav-icons.svg" name="nav-language" size={16} />
              <select
                aria-label="Language"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
              >
                {locales.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void handleSignOut()}>
              <Icon href="/nav-icons.svg" name="nav-logout" size={16} /> {t('nav.signOut')}
            </button>
          </nav>
        ) : (
          <label className="lang-switch desktop-only">
            <Icon href="/nav-icons.svg" name="nav-language" size={16} />
            <select
              aria-label="Language"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              {locales.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {children}
      {user ? (
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`bottom-nav-item${location.pathname === item.to || (item.to !== '/events' && location.pathname.startsWith(item.to)) ? ' active' : ''}`}
            >
              <Icon href="/nav-icons.svg" name={item.icon} size={20} />
              <span>{t(item.labelKey)}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </main>
  )
}
