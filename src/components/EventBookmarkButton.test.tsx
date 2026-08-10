import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBookmarkButton } from './EventBookmarkButton'

const from = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'viewer-user' } }),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: () => {} }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => from(...args) },
}))

function queryBuilder() {
  return {
    upsert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  }
}

describe('EventBookmarkButton', () => {
  beforeEach(() => {
    from.mockReset()
    from.mockImplementation(() => queryBuilder())
  })

  it('optimistically saves and removes an event with an accessible pressed state', async () => {
    const onChange = vi.fn()
    render(<EventBookmarkButton eventId="event-1" isBookmarked={false} onChange={onChange} />)
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Save' })

    expect(button.getAttribute('aria-pressed')).toBe('false')
    await user.click(button)

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true))
    expect(from).toHaveBeenCalledWith('event_bookmarks')
  })
})
