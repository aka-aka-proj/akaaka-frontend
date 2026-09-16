import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSeriesDraftRecovery } from './useSeriesDraftRecovery'
import { readSeriesDraft, writeSeriesDraft } from '../lib/series-draft-storage'
const fields = { title: 'local title', description: 'local description', isWholeSeriesRequired: true }
describe('series recovery actions', () => {
 beforeEach(() => localStorage.clear())
 it('requires explicit restore and keeps the snapshot until a successful save', () => {
   writeSeriesDraft('owner:series', fields)
   const { result } = renderHook(() => useSeriesDraftRecovery('owner:series', true))
   expect(result.current.pending).toEqual(fields)
   act(() => { expect(result.current.restore()).toEqual(fields) })
   expect(result.current.pending).toBeNull()
   expect(readSeriesDraft('owner:series')).toEqual(fields)
   act(() => result.current.saved())
   expect(readSeriesDraft('owner:series')).toBeNull()
 })
 it('discards the local snapshot without changing server data', () => {
   writeSeriesDraft('owner:series', fields)
   const { result } = renderHook(() => useSeriesDraftRecovery('owner:series', false))
   act(() => result.current.discard())
   expect(result.current.pending).toBeNull()
   expect(readSeriesDraft('owner:series')).toBeNull()
 })
 it('warns about leaving only while changes are unsaved', () => {
   const view = renderHook(({ dirty }) => useSeriesDraftRecovery('owner:series', dirty), { initialProps: { dirty: true } })
   const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event)
   expect(event.defaultPrevented).toBe(true)
   view.rerender({dirty:false})
   const saved = new Event('beforeunload', {cancelable:true}); window.dispatchEvent(saved)
   expect(saved.defaultPrevented).toBe(false)
 })
})
