import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { locales, type Locale } from '../i18n'
import { supabase } from '../supabaseClient'
import { useT } from '../hooks/useT'
import { Icon } from './Icon'
import { MoreMenuDrawer } from './MoreMenuDrawer'
import { PrivacyNotice } from './PrivacyNotice'
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount'

const BOTTOM_NAV_ITEMS = [
  { to: '/events', icon: 'nav-events', labelKey: 'nav.events', isMore: false },
  { to: '/virtual-lovers', icon: 'nav-heart', labelKey: 'virtualLover.title', isMore: false },
  { to: '/profile/me', icon: 'nav-profile', labelKey: 'nav.myProfile', isMore: false },
  { to: null, icon: 'nav-more', labelKey: 'nav.more', isMore: true },
] as const

const DESKTOP_MORE_ITEMS = [
  { to: '/following', icon: 'nav-profile', labelKey: 'nav.following' },
  { to: '/notifications', icon: 'nav-bell', labelKey: 'nav.notifications' },
  { to: '/settings/notifications', icon: 'nav-bell', labelKey: 'nav.notificationSettings' },
  { to: '/registrations/me', icon: 'nav-calendar', labelKey: 'nav.myRegistrations' },
  { to: '/issues', icon: 'nav-flag', labelKey: 'nav.myIssues' },
  { to: '/reports/me', icon: 'nav-shield', labelKey: 'nav.myReports' },
  { to: '/settings/analytics', icon: 'nav-chart', labelKey: 'nav.analytics' },
  { to: '/settings/security-privacy', icon: 'nav-lock', labelKey: 'nav.securityPrivacy' },
] as const

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { locale, setLocale } = useLanguage()
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false)
  const unreadNotificationCount = useUnreadNotificationCount(user?.id)
  const desktopMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(e.target as Node)) {
        setDesktopMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
            <img src="/icons/icon-whole.png" alt="AkaAka" className="logo-img" style={{ width: '800px' }} />
          </Link>
        </div>
        {user ? (
          <nav className="nav desktop-nav">
            <Link to="/events"><Icon href="/nav-icons.svg" name="nav-events" size={16} /> {t('nav.events')}</Link>
            <Link to="/virtual-lovers"><Icon href="/nav-icons.svg" name="nav-heart" size={16} /> {t('virtualLover.title')}</Link>
            <Link to="/profile/me"><Icon href="/nav-icons.svg" name="nav-profile" size={16} /> {t('nav.myProfile')}</Link>

            <div className="desktop-more-wrapper" ref={desktopMoreRef}>
              <button
                type="button"
                className={`desktop-nav-more-btn${desktopMoreOpen ? ' active' : ''}`}
                onClick={() => setDesktopMoreOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={desktopMoreOpen}
              >
                <Icon href="/nav-icons.svg" name="nav-more" size={16} /> {t('nav.more')}
              </button>
              {desktopMoreOpen && (
                <div className="desktop-more-dropdown" role="menu">
                  {DESKTOP_MORE_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="desktop-more-dropdown-item"
                      role="menuitem"
                      onClick={() => setDesktopMoreOpen(false)}
                    >
                      <Icon href="/nav-icons.svg" name={item.icon} size={16} />
                      <span>
                        {t(item.labelKey)}
                        {item.to === '/notifications' && unreadNotificationCount > 0 ? (
                          <span className="notification-count" aria-label={`${unreadNotificationCount} unread`}>
                            {unreadNotificationCount}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ))}
                  <div className="desktop-more-divider" />
                  <div className="desktop-more-dropdown-item desktop-more-lang">
                    <Icon href="/nav-icons.svg" name="nav-language" size={16} />
                    <select
                      value={locale}
                      onChange={(e) => setLocale(e.target.value as Locale)}
                      aria-label="Language"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {locales.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="desktop-more-dropdown-item desktop-more-signout"
                    role="menuitem"
                    onClick={() => { void handleSignOut(); setDesktopMoreOpen(false) }}
                  >
                    <Icon href="/nav-icons.svg" name="nav-logout" size={16} />
                    <span>{t('nav.signOut')}</span>
                  </button>
                </div>
              )}
            </div>
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
      {user ? <PrivacyNotice /> : null}
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
      <MoreMenuDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        unreadNotificationCount={unreadNotificationCount}
      />
    </main>
  )
}
