export interface SeriesDraftFields {
  title: string
  description: string
  isWholeSeriesRequired: boolean
}
const prefix = 'akaaka:series-draft:v1:'
const lifetime = 24 * 60 * 60 * 1000
export function readSeriesDraft(key: string): SeriesDraftFields | null {
  try {
    const raw = localStorage.getItem(prefix + key)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!Number.isFinite(value.savedAt) || Date.now() - value.savedAt >= lifetime || value.savedAt > Date.now()
      || typeof value.fields?.title !== 'string' || typeof value.fields?.description !== 'string'
      || typeof value.fields?.isWholeSeriesRequired !== 'boolean') {
      removeSeriesDraft(key)
      return null
    }
    return { title: value.fields.title, description: value.fields.description, isWholeSeriesRequired: value.fields.isWholeSeriesRequired }
  } catch { return null }
}
export function writeSeriesDraft(key: string, fields: SeriesDraftFields): boolean {
  try { localStorage.setItem(prefix + key, JSON.stringify({ savedAt: Date.now(), fields })); return true }
  catch { return false }
}
export function removeSeriesDraft(key: string): boolean {
  try { localStorage.removeItem(prefix + key); return true } catch { return false }
}
export function clearSeriesDrafts(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) localStorage.removeItem(key)
    }
  } catch { /* Storage can be unavailable; Auth sign-out must still complete. */ }
}
