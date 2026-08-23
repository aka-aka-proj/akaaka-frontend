import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventAnnouncements } from './EventAnnouncements'

const from = vi.fn()
const rpc = vi.fn()

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

const publishedAnnouncement = {
  id: 'announcement-1',
  event_id: 'event-1',
  title: '場地變更',
  body_markdown: '請從後門入場。',
  status: 'published',
  publish_at: null,
  published_at: '2026-08-23T01:00:00Z',
  created_at: '2026-08-23T01:00:00Z',
  updated_at: '2026-08-23T01:00:00Z',
}

describe('EventAnnouncements', () => {
  beforeEach(() => {
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [publishedAnnouncement], error: null }),
          }),
        }),
      }),
    })
    rpc.mockResolvedValue({ data: publishedAnnouncement, error: null })
  })

  it('shows published history to an attendee without host controls', async () => {
    render(<EventAnnouncements eventId="event-1" isHost={false} nativeRegistration />)

    expect(await screen.findByRole('heading', { name: '場地變更' })).toBeTruthy()
    expect(screen.getByText('請從後門入場。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '新增公告' })).toBeNull()
  })

  it('publishes a draft through the constrained RPC', async () => {
    const user = userEvent.setup()
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ ...publishedAnnouncement, status: 'draft', published_at: null }],
              error: null,
            }),
          }),
        }),
      }),
    })
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration />)

    await user.click(await screen.findByRole('button', { name: '立即發布' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('publish_event_announcement', {
      p_announcement_id: 'announcement-1',
    }))
  })
})
