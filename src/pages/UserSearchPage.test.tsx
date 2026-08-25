import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserSearchPage } from './UserSearchPage'

const from = vi.fn()

// Mock must keep `user` identity stable across renders, like AuthProvider.
const stableViewerUser = vi.hoisted(() => ({ id: 'viewer-user' }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: stableViewerUser }),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: () => {} }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => from(...args) },
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function queryBuilder(response: { data?: unknown; error?: { message: string } | null }, terminalEq = false) {
  return {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(response),
    ilike: vi.fn().mockReturnThis(),
    eq: terminalEq ? vi.fn().mockResolvedValue(response) : vi.fn().mockReturnThis(),
  }
}

describe('UserSearchPage', () => {
  beforeEach(() => {
    from.mockImplementation((table: string) => table === 'user_follows'
      ? queryBuilder({ data: [{ followed_id: 'user-a' }, { follower_id: 'user-a' }], error: null }, true)
      : queryBuilder({
          data: [{ id: 'user-a', display_name: 'Alice', metadata: {} }],
          error: null,
        }))
  })

  it('lists other profiles and filters by display name', async () => {
    render(<MemoryRouter><UserSearchPage /></MemoryRouter>)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    expect(screen.getByRole('link', { name: 'Alice' }).getAttribute('href')).toBe('/messages/new?user=user-a')
    expect(screen.getByRole('link', { name: 'View profile' }).getAttribute('href')).toBe('/profile/user-a')

    await user.type(screen.getByRole('searchbox'), 'Alice')
    await waitFor(() => expect(from).toHaveBeenCalled())
    expect(screen.getByText('Alice')).toBeTruthy()
  })
})
