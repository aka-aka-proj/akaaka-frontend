import { useCallback, useEffect, useRef, useState } from 'react'
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
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, handleClickOutside])

  const fieldKey = FIELD_KEYS[fieldName] ?? 'fieldBio'

  return (
    <span className="visibility-tooltip-wrapper" style={{ position: 'relative', display: 'inline-flex', marginLeft: 6, verticalAlign: 'middle' }}>
      <button
        ref={triggerRef}
        type="button"
        className="visibility-tooltip-trigger"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={t('visibilityTooltip.rlsProtection')}
        style={{
          background: 'none',
          border: '1px solid #ccc',
          borderRadius: '50%',
          width: 18,
          height: 18,
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          lineHeight: 1,
          color: '#888',
          fontStyle: 'italic',
        }}
      >
        i
      </button>
      {open && (
        <div
          ref={tooltipRef}
          className="visibility-tooltip-content"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            zIndex: 100,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '12px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 260,
            maxWidth: 320,
            fontSize: 13,
            lineHeight: 1.5,
            color: '#333',
            pointerEvents: 'auto',
          }}
        >
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>{t('visibilityTooltip.rlsProtection')}</strong>
          </p>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#666' }}>
            {t('visibilityTooltip.connectionsOnlyExplanation')}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            {t(`visibilityTooltip.${fieldKey}` as any)}
          </p>
        </div>
      )}
    </span>
  )
}