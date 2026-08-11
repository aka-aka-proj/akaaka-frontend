import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventsPage } from './EventsPage'

const mockUseAuth = vi.fn()
const rpc = vi.fn()

const event = {
  id: 'event-1',
  creator_id: 'creator-1',
  title: '一般活動標題',
  description: '不包含搜尋字串',
  category: 'Social',
  lifecycle_status: 'published',
  publication_status: 'published',
  publish_at: null,
  unpublish_at: null,
  event_type: JSON.stringify(['Movie']),
  is_venue_hosted: false,
  visibility_settings: { type: 'public' },
  registration_form_config: null,
  recurrence_rule: null,
  series_id: null,
  start_time: '2099-01-01T12:00:00.000Z',
  location_region: 'Online',
  location_detail: null,
  max_capacity: null,
  registration_deadline: null,
  external_registration_url: null,
  source_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../components/EventBookmarkButton', () => ({
  EventBookmarkButton: () => <button type="button" aria-label="bookmark">bookmark</button>,
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}))

describe('EventsPage server-side search contract', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'creator-1' } })
    rpc.mockResolvedValue({ data: [event], error: null })
  })

  it('keeps an RPC result matched by event type instead of client re-filtering it', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><EventsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('link', { name: '一般活動標題' })).toBeTruthy())
    rpc.mockClear()

    await user.type(screen.getByRole('searchbox'), 'Movie')

    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('search_events', expect.objectContaining({
      p_search: 'Movie',
      p_limit: 50,
      p_offset: 0,
    })))
    expect(screen.getByRole('link', { name: '一般活動標題' })).toBeTruthy()
  })
})
