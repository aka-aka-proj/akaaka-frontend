import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserSearchPage } from './UserSearchPage'

const from = vi.fn()
const rpc = vi.fn()

// Mock must keep `user` identity stable across renders, like AuthProvider.
const stableViewerUser = vi.hoisted(() => ({ id: 'viewer-user' }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: stableViewerUser }),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: () => {} }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => from(...args), rpc: (...args: unknown[]) => rpc(...args) },
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
    let followCall = 0
    rpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'user-a', role_status: 'general', display_name: 'Alice', metadata: {} },
        error: null,
      }),
    })
    from.mockImplementation((table: string) => table === 'user_follows'
      ? queryBuilder({ data: followCall++ === 0 ? [{ followed_id: 'user-a' }] : [{ follower_id: 'user-a' }], error: null }, true)
      : queryBuilder({
          data: [{ id: 'user-a', display_name: 'Alice', metadata: {} }],
          error: null,
        }))
  })

  it('loads profiles once and filters locally by display name', async () => {
    render(<MemoryRouter><UserSearchPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    expect(rpc).toHaveBeenCalledWith('get_profile_for_viewer', { target_profile_id: 'user-a' })
    expect(screen.getByRole('link', { name: 'Alice' }).getAttribute('href')).toBe('/messages/new?user=user-a')
    expect(screen.getByRole('link', { name: 'View profile' }).getAttribute('href')).toBe('/profile/user-a')

    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'Alice')
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
