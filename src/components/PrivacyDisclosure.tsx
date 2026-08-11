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
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
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
