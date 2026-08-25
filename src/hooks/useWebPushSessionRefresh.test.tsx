import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWebPushSessionRefresh } from './useWebPushSessionRefresh'

const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/web-push', () => ({
  refreshWebPushSubscription: refreshMock,
}))

describe('useWebPushSessionRefresh', () => {
  beforeEach(() => {
    refreshMock.mockReset()
    refreshMock.mockResolvedValue(true)
  })

  function renderSessionHook(initialUserId: string | null) {
    return renderHook(({ userId }) => useWebPushSessionRefresh(userId), {
      initialProps: { userId: initialUserId },
    })
  }

  it('refreshes once per signed-in session and skips re-renders of the same user', async () => {
    const { rerender } = renderSessionHook('user-1')
    await act(async () => {})
    rerender({ userId: 'user-1' })
    await act(async () => {})

    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(refreshMock).toHaveBeenCalledWith('user-1')
  })

  it('does nothing while signed out', async () => {
    renderSessionHook(null)
    await act(async () => {})

    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('re-arms after sign-out so signing back in with the same account refreshes again', async () => {
    const { rerender } = renderSessionHook('user-1')
    await act(async () => {})
    expect(refreshMock).toHaveBeenCalledTimes(1)

    rerender({ userId: null })
    await act(async () => {})
    rerender({ userId: 'user-1' })
    await act(async () => {})

    expect(refreshMock).toHaveBeenCalledTimes(2)
  })

  it('treats a different account as a fresh session', async () => {
    const { rerender } = renderSessionHook('user-1')
    await act(async () => {})
    rerender({ userId: 'user-2' })
    await act(async () => {})

    expect(refreshMock).toHaveBeenNthCalledWith(2, 'user-2')
  })
})
