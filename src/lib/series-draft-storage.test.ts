import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readSeriesDraft, writeSeriesDraft, removeSeriesDraft, clearSeriesDrafts } from './series-draft-storage'
const fields = { title: '瑜珈課', description: '未儲存內容', isWholeSeriesRequired: true }
describe('series draft recovery', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
  it('restores only the same account and series', () => {
    expect(writeSeriesDraft('owner:series', fields)).toBe(true)
    expect(readSeriesDraft('owner:series')).toEqual(fields)
    expect(readSeriesDraft('other:series')).toBeNull()
    expect(readSeriesDraft('owner:other')).toBeNull()
  })
  it('expires after 24 hours', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    writeSeriesDraft('owner:series', fields)
    vi.spyOn(Date, 'now').mockReturnValue(1000 + 24 * 60 * 60 * 1000)
    expect(readSeriesDraft('owner:series')).toBeNull()
  })
  it('clears the saved draft while preserving other drafts', () => {
    writeSeriesDraft('owner:series', fields); writeSeriesDraft('owner:other', fields)
    removeSeriesDraft('owner:series')
    expect(readSeriesDraft('owner:series')).toBeNull()
    expect(readSeriesDraft('owner:other')).toEqual(fields)
  })
  it('clears all drafts on sign out without deleting unrelated storage', () => {
    writeSeriesDraft('owner:series', fields); localStorage.setItem('locale', 'en')
    clearSeriesDrafts()
    expect(readSeriesDraft('owner:series')).toBeNull()
    expect(localStorage.getItem('locale')).toBe('en')
  })
  it('ignores malformed and invalid snapshots', () => {
    localStorage.setItem('akaaka:series-draft:v1:owner:series', '{broken')
    expect(readSeriesDraft('owner:series')).toBeNull()
    localStorage.setItem('akaaka:series-draft:v1:owner:series', JSON.stringify({savedAt:Date.now(),fields:{title:123}}))
    expect(readSeriesDraft('owner:series')).toBeNull()
  })
  it('returns failure instead of claiming storage succeeded', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(writeSeriesDraft('owner:series', fields)).toBe(false)
  })
})
