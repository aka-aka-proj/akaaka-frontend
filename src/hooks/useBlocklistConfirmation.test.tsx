import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useBlocklistConfirmation } from './useBlocklistConfirmation'

const invoke = vi.fn()
vi.mock('../supabaseClient', () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }))
const warning = () => ({ error: { message: 'HTTP error', context: new Response(JSON.stringify({ error: { code: 'blocklist_confirmation_required', details: { host_profile_id: 'host' } } }), { status: 409 }) } })
beforeEach(() => { invoke.mockReset() })

it('cancel makes no second request; consent resends the original answers exactly once', async () => {
  invoke.mockResolvedValueOnce(warning()).mockResolvedValueOnce(warning()).mockResolvedValueOnce({ data: {}, error: null })
  const success = vi.fn(), onError = vi.fn()
  const { result } = renderHook(() => useBlocklistConfirmation('event-a'))
  const body = { event_id: 'event-a', form_responses: { answer: 'original' } }
  const request = { name: 'create-registration' as const, kind: 'register' as const, body, onSuccess: success, onError }
  await act(() => result.current.run(request))
  expect(result.current.confirmation?.hostId).toBe('host')
  act(() => result.current.cancel())
  expect(invoke).toHaveBeenCalledTimes(1)
  expect(success).not.toHaveBeenCalled()
  await act(() => result.current.run(request))
  body.form_responses.answer = 'changed after warning'
  await act(async () => { await Promise.all([result.current.confirm(), result.current.confirm()]) })
  expect(invoke).toHaveBeenCalledTimes(3)
  expect(invoke.mock.calls[2][1].body).toEqual({ event_id: 'event-a', form_responses: { answer: 'original' }, acknowledge_blocklist_conflict: true })
  expect(success).toHaveBeenCalledTimes(1)
  expect(onError).not.toHaveBeenCalled()
})

it('discards a delayed warning after changing event or signed-in user', async () => {
  let resolve!: (value: ReturnType<typeof warning>) => void
  invoke.mockImplementation(() => new Promise(r => { resolve = r }))
  const { result, rerender } = renderHook(({ scope }) => useBlocklistConfirmation(scope), { initialProps: { scope: 'user:event-a' } })
  let task!: Promise<void>
  act(() => { task = result.current.run({ name: 'create-registration', kind: 'register', body: { event_id: 'event-a' }, onSuccess: vi.fn(), onError: vi.fn() }) })
  rerender({ scope: 'other:event-b' })
  await act(async () => { resolve(warning()); await task })
  expect(result.current.confirmation).toBeNull()
  await act(() => result.current.confirm())
  expect(invoke).toHaveBeenCalledTimes(1)
})

it('does not interpret an unrelated 409 as blocklist consent', async () => {
  const error = { message: 'capacity', context: new Response('{"error":"capacity_reached"}', { status: 409 }) }
  invoke.mockResolvedValue({ error })
  const onError = vi.fn()
  const { result } = renderHook(() => useBlocklistConfirmation('event-a'))
  await act(() => result.current.run({ name: 'review-registration', kind: 'review', body: {}, onSuccess: vi.fn(), onError }))
  expect(result.current.confirmation).toBeNull()
  expect(onError).toHaveBeenCalledWith(error)
})

it("resends the server series snapshot when the first request omitted it", async () => {
  invoke.mockResolvedValueOnce({ error: { context: new Response(JSON.stringify({ error: {
    code: "blocklist_confirmation_required", details: { host_profile_id: "host", expected_event_ids: ["first", "second"] },
  } }), { status: 409 }) } }).mockResolvedValueOnce({ data: {}, error: null })
  const { result } = renderHook(() => useBlocklistConfirmation("user:series"))
  await act(() => result.current.run({ name: "register-for-event-series", kind: "series", body: { series_id: "series" }, onSuccess: vi.fn(), onError: vi.fn() }))
  await act(() => result.current.confirm())
  expect(invoke.mock.calls[1][1].body).toEqual({ series_id: "series", expected_event_ids: ["first", "second"], acknowledge_blocklist_conflict: true })
})
