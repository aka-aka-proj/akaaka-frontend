import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useT } from '../hooks/useT'

interface VisibilityTooltipProps {
  fieldName: string
}

const FIELD_KEYS: Record<string, string> = {
  bio: 'fieldBio',
  gender_identity: 'fieldGenderIdentity',
  bdsm_roles: 'fieldBdsmRoles',
}

export function VisibilityTooltip({ fieldName }: VisibilityTooltipProps) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openedByFocusRef = useRef(false)
  const openedByHoverRef = useRef(false)
  const tooltipId = useId()

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      tooltipRef.current &&
      !tooltipRef.current.contains(e.target as Node) &&
      triggerRef.current &&
      !triggerRef.current.contains(e.target as Node)
    ) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener('pointerdown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [open, handleClickOutside])

  const fieldKey = FIELD_KEYS[fieldName] ?? 'fieldBio'

  return (
    <span className="visibility-tooltip-wrapper" style={{ position: 'relative', display: 'inline-flex', marginLeft: 6, verticalAlign: 'middle' }}>
      <button
        ref={triggerRef}
        type="button"
        className="visibility-tooltip-trigger"
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={(event) => {
          if (event.detail > 0 && (openedByFocusRef.current || openedByHoverRef.current)) {
            openedByFocusRef.current = false
            openedByHoverRef.current = false
            setOpen(true)
            return
          }
          openedByFocusRef.current = false
          setOpen((prev) => !prev)
        }}
        onFocus={() => {
          openedByFocusRef.current = true
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            openedByFocusRef.current = false
            openedByHoverRef.current = false
            setOpen(false)
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openedByFocusRef.current = false
            setOpen((prev) => !prev)
          }
        }}
        onMouseEnter={() => {
          openedByHoverRef.current = true
          setOpen(true)
        }}
        onMouseLeave={() => {
          openedByHoverRef.current = false
          setOpen(false)
        }}
        aria-label={t('visibilityTooltip.rlsProtection')}
        style={{
          background: 'none',
          border: '1px solid var(--color-border)',
          borderRadius: '50%',
          width: 'var(--touch-target)',
          height: 'var(--touch-target)',
          minWidth: 'var(--touch-target)',
          minHeight: 'var(--touch-target)',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          lineHeight: 1,
          color: 'var(--color-text-muted)',
          fontStyle: 'italic',
        }}
      >
        i
      </button>
      {open && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          className="visibility-tooltip-content"
          role="status"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            zIndex: 100,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            boxShadow: 'var(--shadow-popover)',
            minWidth: 260,
            maxWidth: 320,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--color-text)',
            pointerEvents: 'auto',
          }}
        >
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>{t('visibilityTooltip.rlsProtection')}</strong>
          </p>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t('visibilityTooltip.connectionsOnlyExplanation')}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t(`visibilityTooltip.${fieldKey}`)}
          </p>
        </div>
      )}
    </span>
  )
}
