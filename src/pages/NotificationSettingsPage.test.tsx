import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationSettingsPage } from './NotificationSettingsPage'

const mockUseAuth = vi.fn()
const from = vi.fn()
const insert = vi.fn()
const deleteSubscription = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}))

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    insert.mockResolvedValue({ error: null })
    deleteSubscription.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    from.mockImplementation((table: string) => {
      if (table === 'event_notification_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ event_type: 'Dining', creator_profile_id: 'user-a' }], error: null }),
          }),
          insert,
          delete: deleteSubscription,
        }
      }
      if (table === 'user_follows') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [{ followed_id: 'user-a' }, { followed_id: 'user-b' }], error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'user-a', display_name: 'Alice' }, { id: 'user-b', display_name: 'Bob' }],
            error: null,
          }),
        }),
      }
    })
  })

  it('loads current type subscriptions', async () => {
    render(<NotificationSettingsPage />)

    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Dining' }) as HTMLInputElement).checked).toBe(true))
    expect((screen.getByRole('checkbox', { name: 'BBQ' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: 'Alice' }) as HTMLInputElement).checked).toBe(true)
  })

  it('creates and removes type subscriptions', async () => {
    const user = userEvent.setup()
    render(<NotificationSettingsPage />)

    const dining = await screen.findByRole('checkbox', { name: 'Dining' })
    const bbq = screen.getByRole('checkbox', { name: 'BBQ' })
    await user.click(dining)
    await user.click(bbq)

    expect(deleteSubscription).toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith({ profile_id: 'user-1', event_type: 'BBQ' })
  })

  it('manages followed-people subscriptions independently from event types', async () => {
    const user = userEvent.setup()
    render(<NotificationSettingsPage />)

    const alice = await screen.findByRole('checkbox', { name: 'Alice' })
    const bob = screen.getByRole('checkbox', { name: 'Bob' })
    expect((alice as HTMLInputElement).checked).toBe(true)

    await user.click(alice)
    await user.click(bob)

    expect(deleteSubscription).toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith({ profile_id: 'user-1', creator_profile_id: 'user-b' })
  })

  it('searches types and supports bulk selection feedback', async () => {
    const user = userEvent.setup()
    render(<NotificationSettingsPage />)

    const search = screen.getByRole('textbox', { name: '搜尋活動類型或追蹤的人' })
    await user.type(search, 'Movie')

    expect(screen.getByRole('checkbox', { name: 'Movie' })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'BBQ' })).toBeNull()

    await user.clear(search)
    await user.click(screen.getByRole('button', { name: '全部選取' }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('設定已更新'))
    expect(insert).toHaveBeenCalledWith({ profile_id: 'user-1', event_type: 'BBQ' })
  })
})
