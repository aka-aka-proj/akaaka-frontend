import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

interface PrivacyDisclosureProps {
  label: string
  description: string
  learnMore: string
}

/** A short, non-user-specific privacy boundary beside a sensitive control. */
export function PrivacyDisclosure({ label, description, learnMore }: PrivacyDisclosureProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openedByFocusRef = useRef(false)
  const popoverId = useId()

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !triggerRef.current?.parentElement?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  return (
    <span className="privacy-disclosure">
      <button
        ref={triggerRef}
        type="button"
        className="privacy-disclosure__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={(event) => {
          if (event.detail > 0 && openedByFocusRef.current) {
            openedByFocusRef.current = false
            setOpen(true)
            return
          }
          openedByFocusRef.current = false
          setOpen((current) => !current)
        }}
        onFocus={() => {
          openedByFocusRef.current = true
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            openedByFocusRef.current = false
            setOpen(false)
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openedByFocusRef.current = false
            setOpen((current) => !current)
          }
        }}
      >
        i
      </button>
      {open ? (
        <span id={popoverId} className="privacy-disclosure__popover" role="status">
          <strong>{label}</strong>
          <span>{description}</span>
          <Link to="/settings/security-privacy" onClick={() => setOpen(false)}>{learnMore}</Link>
        </span>
      ) : null}
    </span>
  )
}
