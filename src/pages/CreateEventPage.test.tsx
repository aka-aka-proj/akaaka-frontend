import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateEventPage } from './CreateEventPage'

const mockUseAuth = vi.fn()
const from = vi.fn()
const insert = vi.fn()
const select = vi.fn()
const single = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}))

describe('CreateEventPage', () => {
  beforeEach(() => {
    single.mockResolvedValue({ data: { id: 'event-1' }, error: null })
    select.mockReturnValue({ single })
    insert.mockReturnValue({ select })
    from.mockImplementation((table: string) => {
      if (table === 'events') {
        return { insert }
      }
      return {}
    })
  })

  it('creates non-venue-hosted event for general user', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('標題'), 'My Event')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.click(screen.getByRole('button', { name: '儲存活動' }))

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'My Event',
        is_venue_hosted: false,
      }),
    ])
  })

  it('creates venue-hosted event for venue approved user', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'venue_approved' },
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('標題'), 'Approved Event')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.click(screen.getByRole('button', { name: '儲存活動' }))

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Approved Event',
        is_venue_hosted: true,
      }),
    ])
  })
})
