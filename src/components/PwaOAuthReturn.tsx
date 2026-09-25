import { useEffect, useRef } from 'react'
import { useT } from '../hooks/useT'
import styles from './PwaOAuthReturn.module.css'

export function PwaOAuthReturn({ intent, onContinue }: { intent: string | null; onContinue: () => void }) {
  const { t } = useT()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])

  return <section className={`card ${styles.panel}`} aria-labelledby="pwa-return-title">
    <h1 id="pwa-return-title" ref={heading} tabIndex={-1}>{t('auth.pwaReturnTitle')}</h1>
    <p>{t('auth.pwaReturnDescription')}</p>
    <p id="pwa-return-help">{t('auth.pwaReturnHelp')}</p>
    <div className={styles.actions}>
      {intent ? <a className={styles.openApp} href={intent} aria-describedby="pwa-return-help">{t('auth.pwaReturnOpen')}</a> : null}
      <button type="button" className="secondary" onClick={onContinue}>{t('auth.pwaReturnContinue')}</button>
    </div>
  </section>
}
