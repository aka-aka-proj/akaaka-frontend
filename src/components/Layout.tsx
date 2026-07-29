import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { locales, type Locale } from '../i18n'
import { supabase } from '../supabaseClient'
import { useT } from '../hooks/useT'
import { Icon } from './Icon'
import { MoreMenuDrawer } from './MoreMenuDrawer'

const BOTTOM_NAV_ITEMS = [
  { to: '/events', icon: 'nav-events', labelKey: 'nav.events' },
  { to: '/virtual-lovers', icon: 'nav-heart', labelKey: 'virtualLover.title' },
  { to: '/profile/me', icon: 'nav-profile', labelKey: 'nav.myProfile' },
  { to: null, icon: 'nav-more', labelKey: 'nav.more', isMore: true },
] as const

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useAuth()
  const { locale, setLocale } = useLanguage()
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      // session 可能已失效，強制清除本地狀態並導向登入頁
    }
    navigate('/auth', { replace: true })
  }

  const isActive = (itemTo: string | null) => {
    if (!itemTo) return false
    if (itemTo === '/events') return location.pathname === '/events'
    return location.pathname === itemTo || location.pathname.startsWith(itemTo + '/')
  }

  return (
    <main className="page" role="main">
      <header className="topbar">
        <div className="topbar-brand">
          <Link to="/">
            <img src="/icons/icon-whole.png" alt="AkaAka" className="logo-img" />
          </Link>
          <span className="topbar-title">{title}</span>
        </div>
        {user ? (
          <nav className="nav desktop-nav">
            <Link to="/events"><Icon href="/nav-icons.svg" name="nav-events" size={16} /> {t('nav.events')}</Link>
            <Link to="/events/new"><Icon href="/nav-icons.svg" name="nav-create" size={16} /> {t('nav.createEvent')}</Link>
            <Link to="/virtual-lovers"><Icon href="/nav-icons.svg" name="nav-heart" size={16} /> {t('virtualLover.title')}</Link>
            <Link to="/registrations/me"><Icon href="/nav-icons.svg" name="nav-calendar" size={16} /> {t('nav.myRegistrations')}</Link>
            <Link to="/profile/me"><Icon href="/nav-icons.svg" name="nav-profile" size={16} /> {t('nav.myProfile')}</Link>
            <Link to="/reports/me"><Icon href="/nav-icons.svg" name="nav-shield" size={16} /> {t('nav.myReports')}</Link>
            <Link to="/issues"><Icon href="/nav-icons.svg" name="nav-flag" size={16} /> {t('nav.myIssues')}</Link>
            <Link to="/settings/security-privacy"><Icon href="/nav-icons.svg" name="nav-lock" size={16} /> {t('nav.securityPrivacy')}</Link>
            <label className="lang-switch">
              <Icon href="/nav-icons.svg" name="nav-language" size={16} />
              <select
                id="language-select-desktop"
                name="language"
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
              id="language-select-mobile"
              name="language"
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
          {BOTTOM_NAV_ITEMS.map((item) => {
            if (item.isMore) {
              return (
                <button
                  key="more"
                  type="button"
                  className={`bottom-nav-item${moreOpen ? ' active' : ''}`}
                  onClick={() => setMoreOpen(true)}
                  aria-label={t('nav.more')}
                >
                  <Icon href="/nav-icons.svg" name={item.icon} size={20} />
                  <span>{t(item.labelKey)}</span>
                </button>
              )
            }
            return (
              <Link
                key={item.to}
                to={item.to!}
                className={`bottom-nav-item${isActive(item.to) ? ' active' : ''}`}
              >
                <Icon href="/nav-icons.svg" name={item.icon} size={20} />
                <span>{t(item.labelKey)}</span>
              </Link>
            )
          })}
        </nav>
      ) : null}
      <MoreMenuDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </main>
  )
}