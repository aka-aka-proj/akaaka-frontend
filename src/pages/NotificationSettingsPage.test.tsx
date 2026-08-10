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
      if (table !== 'event_notification_subscriptions') return {}
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: [{ event_type: 'Dining' }], error: null }),
          }),
        }),
        insert,
        delete: deleteSubscription,
      }
    })
  })

  it('loads current type subscriptions', async () => {
    render(<NotificationSettingsPage />)

    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Dining' }) as HTMLInputElement).checked).toBe(true))
    expect((screen.getByRole('checkbox', { name: 'BBQ' }) as HTMLInputElement).checked).toBe(false)
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
})
