import { useEffect, useRef } from 'react'
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
  const drawerRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
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

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    const focusCloseButton = () => closeButtonRef.current?.focus()
    const focusInitialControl = window.requestAnimationFrame
      ? window.requestAnimationFrame(focusCloseButton)
      : window.setTimeout(focusCloseButton, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const drawer = drawerRef.current
      if (!drawer) return
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (window.cancelAnimationFrame && typeof focusInitialControl === 'number') {
        window.cancelAnimationFrame(focusInitialControl)
      } else {
        window.clearTimeout(focusInitialControl)
      }
      const previous = previousActiveElementRef.current
      if (previous && document.contains(previous)) previous.focus()
      previousActiveElementRef.current = null
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="more-drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        ref={drawerRef}
        className="more-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-drawer-title"
      >
        <div className="more-drawer-header">
          <h2 id="more-drawer-title">{t('nav.more')}</h2>
          <button
            type="button"
            ref={closeButtonRef}
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
          <Link to="/events/bookmarks" onClick={onClose} className="more-drawer-item">
            <Icon href="/nav-icons.svg" name="nav-heart" size={20} />
            <span>{t('nav.bookmarks')}</span>
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
