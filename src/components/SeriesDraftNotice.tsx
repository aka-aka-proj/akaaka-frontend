import { useT } from '../hooks/useT'
import type { useSeriesDraftRecovery } from '../hooks/useSeriesDraftRecovery'
import styles from './SeriesDraftNotice.module.css'
export function SeriesDraftNotice({ recovery, dirty, saving, onRestore }: {
  recovery: ReturnType<typeof useSeriesDraftRecovery>; dirty: boolean; saving: boolean; onRestore: () => void
}) {
  const { t } = useT()
  return <div className={styles.notice}>
    {recovery.pending ? <><p role="status">{t('seriesDraft.found')}</p><div className={styles.actions}>
      <button type="button" className="secondary-action" onClick={onRestore} disabled={saving}>{t('seriesDraft.restore')}</button>
      <button type="button" className="secondary-action" onClick={recovery.discard} disabled={saving}>{t('seriesDraft.discard')}</button>
    </div></> : <p role="status">{t(saving ? 'seriesDraft.saving' : dirty ? recovery.localCopy === true ? 'seriesDraft.local' : 'seriesDraft.unsaved' : 'seriesDraft.saved')}</p>}
    {recovery.localCopy === false && <p role="alert">{t('seriesDraft.unavailable')}</p>}
  </div>
}
