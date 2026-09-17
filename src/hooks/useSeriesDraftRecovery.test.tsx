import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSeriesDraftRecovery } from './useSeriesDraftRecovery'
import { readSeriesDraft, writeSeriesDraft } from '../lib/series-draft-storage'
const fields = { title: 'local title', description: 'local description', isWholeSeriesRequired: true }
describe('series recovery actions', () => {
 beforeEach(() => localStorage.clear())
 afterEach(() => vi.restoreAllMocks())
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
 it('preserves pending draft through a clean mount, rerender and remount', () => {
   writeSeriesDraft('owner:series', fields)
   const view = renderHook(() => useSeriesDraftRecovery('owner:series', false))
   view.rerender()
   act(() => view.result.current.persist({ title: '', description: '', isWholeSeriesRequired: false }, false))
   expect(view.result.current.pending).toEqual(fields)
   expect(readSeriesDraft('owner:series')).toEqual(fields)
   view.unmount()
   const reopened = renderHook(() => useSeriesDraftRecovery('owner:series', false))
   expect(reopened.result.current.pending).toEqual(fields)
 })
 it('clears a created draft when the last field is cleared in the same batch', () => {
   const view = renderHook(() => useSeriesDraftRecovery('owner:new', false))
   act(() => {
     view.result.current.persist(fields)
     view.result.current.persist({ title: '', description: '', isWholeSeriesRequired: false }, false)
   })
   expect(readSeriesDraft('owner:new')).toBeNull()
   expect(view.result.current.localCopy).toBeNull()
   view.unmount()
   const reopened = renderHook(() => useSeriesDraftRecovery('owner:new', false))
   expect(reopened.result.current.pending).toBeNull()
 })
 it('clears the stale snapshot when edits return to server values', () => {
   const view = renderHook(({ dirty }) => useSeriesDraftRecovery('owner:series', dirty), { initialProps: { dirty: false } })
   act(() => view.result.current.persist(fields))
   view.rerender({ dirty: true })
   expect(readSeriesDraft('owner:series')).toEqual(fields)
   view.rerender({ dirty: false })
   expect(readSeriesDraft('owner:series')).toBeNull()
   expect(view.result.current.pending).toBeNull()
   expect(view.result.current.localCopy).toBeNull()
 })
 it.each(['explicit clear', 'dirty transition'])('reports removal failure after %s', (mode) => {
   const view = renderHook(({ dirty }) => useSeriesDraftRecovery('owner:series', dirty), { initialProps: { dirty: false } })
   act(() => view.result.current.persist(fields))
   view.rerender({ dirty: true })
   vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage unavailable') })
   if (mode === 'explicit clear') act(() => view.result.current.persist(fields, false))
   else view.rerender({ dirty: false })
   expect(readSeriesDraft('owner:series')).toEqual(fields)
   expect(view.result.current.localCopy).toBe(false)
 })

})
