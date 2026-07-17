import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { locales, type Locale } from '../i18n'
import { supabase } from '../supabaseClient'
import { useT } from '../hooks/useT'
import { Icon } from './Icon'

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useAuth()
  const { locale, setLocale } = useLanguage()
  const { t } = useT()
  const navigate = useNavigate()

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
            <img src="/logo.svg" alt="AkaAka" width={120} height={40} />
          </Link>
          <span className="topbar-title">{title}</span>
        </div>
        {user ? (
          <nav className="nav">
            <Link to="/events"><Icon href="/nav-icons.svg" name="nav-events" size={16} /> {t('nav.events')}</Link>
            <Link to="/events/new"><Icon href="/nav-icons.svg" name="nav-create" size={16} /> {t('nav.createEvent')}</Link>
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
        )}
      </header>
      {children}
    </main>
  )
}
