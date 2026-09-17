import { useEffect, useRef, useState } from 'react'
import { readSeriesDraft, writeSeriesDraft, removeSeriesDraft, type SeriesDraftFields } from '../lib/series-draft-storage'

// Callers key their form by account and series so old requests/state cannot cross identities.
export function useSeriesDraftRecovery(key: string, dirty: boolean) {
  const [pending, setPending] = useState(() => readSeriesDraft(key))
  const [localCopy, setLocalCopy] = useState<boolean | null>(null)
  const wasDirty = useRef(false)

  useEffect(() => {
    if (wasDirty.current && !dirty) {
      const removed = removeSeriesDraft(key)
      setPending(null)
      setLocalCopy(removed ? null : false)
    }
    wasDirty.current = dirty
  }, [key, dirty])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return {
    pending, localCopy,
    persist(fields: SeriesDraftFields, isDirty = true) {
      if (!isDirty) {
        if (wasDirty.current) {
          const removed = removeSeriesDraft(key)
          setPending(null)
          setLocalCopy(removed ? null : false)
        }
        return
      }
      wasDirty.current = true
      setLocalCopy(writeSeriesDraft(key, fields))
    },
    restore() { setPending(null); setLocalCopy(true); return pending },
    discard() { setPending(null); setLocalCopy(removeSeriesDraft(key) ? null : false) },
    saved() { setPending(null); setLocalCopy(removeSeriesDraft(key) ? null : false) },
  }
}
