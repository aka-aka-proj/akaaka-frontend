import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { useT } from '../hooks/useT'
import styles from './CreateEventMenu.module.css'

export function CreateEventMenu() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([])

  useEffect(() => {
    if (!open) return

    optionRefs.current[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }

      const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement)
      if (currentIndex < 0) return

      const nextIndex = event.key === 'ArrowDown'
        ? (currentIndex + 1) % optionRefs.current.length
        : event.key === 'ArrowUp'
          ? (currentIndex - 1 + optionRefs.current.length) % optionRefs.current.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? optionRefs.current.length - 1
              : -1
      if (nextIndex >= 0) {
        event.preventDefault()
        optionRefs.current[nextIndex]?.focus()
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={styles.root}>
      {open && (
        <div className={styles.menu} role="menu" aria-label={t('events.createEvent')}>
          <Link ref={(element) => { optionRefs.current[0] = element }} className={styles.option} to="/events/new" role="menuitem" onClick={() => setOpen(false)}>
            {t('events.createEvent')}
          </Link>
          <Link ref={(element) => { optionRefs.current[1] = element }} className={styles.option} to="/events/series/new" role="menuitem" onClick={() => setOpen(false)}>
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
