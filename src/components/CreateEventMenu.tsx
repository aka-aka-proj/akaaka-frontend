import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { useT } from '../hooks/useT'
import styles from './CreateEventMenu.module.css'

export function CreateEventMenu() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstOptionRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return

    firstOptionRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <div className={styles.root}>
      {open && (
        <div className={styles.menu} role="menu" aria-label={t('events.createEvent')}>
          <Link ref={firstOptionRef} className={styles.option} to="/events/new" role="menuitem" onClick={() => setOpen(false)}>
            {t('events.createEvent')}
          </Link>
          <Link className={styles.option} to="/events/series/new" role="menuitem" onClick={() => setOpen(false)}>
            {t('eventSeries.createSeriesTitle')}
          </Link>
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={t('events.createEvent')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon href="/nav-icons.svg" name="nav-create" size={20} />
        <span className={styles.triggerLabel}>{t('events.createEvent')}</span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </button>
    </div>
  )
}
