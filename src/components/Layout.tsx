import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { locales, type Locale } from '../i18n'
import { supabase } from '../supabaseClient'
import { useT } from '../hooks/useT'

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useAuth()
  const { locale, setLocale } = useLanguage()
  const { t } = useT()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{title}</h1>
        {user ? (
          <nav className="nav">
            <Link to="/events">{t('nav.events')}</Link>
            <Link to="/events/new">{t('nav.createEvent')}</Link>
            <Link to="/profile/me">{t('nav.myProfile')}</Link>
            <Link to="/reports/me">{t('nav.myReports')}</Link>
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
            <button type="button" onClick={() => void handleSignOut()}>
              {t('nav.signOut')}
            </button>
          </nav>
        ) : (
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
        )}
      </header>
      {children}
    </main>
  )
}
