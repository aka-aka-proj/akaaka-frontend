import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationsPage } from './NotificationsPage'

const mockUseAuth = vi.fn()
const from = vi.fn()
const update = vi.fn()

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

describe('NotificationsPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    update.mockReturnValue({
      eq: vi.fn().mockImplementation((column: string) => {
        if (column === 'recipient_profile_id') {
          return { is: vi.fn().mockResolvedValue({ error: null }) }
        }
        return Promise.resolve({ error: null })
      }),
    })
    from.mockImplementation((table: string) => {
      if (table === 'notifications') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'notification-1', notification_type: 'new_event', event_id: 'event-1', issue_id: null, title: 'Fallback title', read_at: null, created_at: '2026-08-10T00:00:00Z' },
                { id: 'notification-2', notification_type: 'new_issue', event_id: null, issue_id: 'issue-1', title: 'New issue report', read_at: null, created_at: '2026-08-10T01:00:00Z' },
                { id: 'notification-3', notification_type: 'new_follow', event_id: null, issue_id: null, actor_profile_id: 'user-2', title: 'New follower', read_at: null, created_at: '2026-08-10T02:00:00Z' },
              ],
              error: null,
            }),
          }),
          update,
        }
      }
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ id: 'event-1', title: 'Board game night' }], error: null }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ id: 'user-2', display_name: 'Alice' }], error: null }),
          }),
        }
      }
      if (table === 'user_follows') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {}
    })
  })

  it('loads notifications and resolves the event title', async () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)

    expect(await screen.findByText('Board game night')).toBeTruthy()
    expect(document.querySelector('.notification-item.unread')).toBeTruthy()
  })

  it('renders issue notifications without an event link', async () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)

    expect(await screen.findByText('新問題回報')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('marks all unread notifications as read', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)

    const button = await screen.findByRole('button', { name: '全部標為已讀' })
    await user.click(button)

    await waitFor(() => expect(update).toHaveBeenCalledWith({ read_at: expect.any(String) }))
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('lets the recipient follow back from a follow notification', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '回追' }))

    await waitFor(() => expect(screen.getByText('已回追此使用者。')).toBeTruthy())
    expect((screen.getByRole('button', { name: '已回追' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('can ignore a follow notification by marking it read', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '忽略' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith({ read_at: expect.any(String) }))
  })
})
