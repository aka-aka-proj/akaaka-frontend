import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FollowingPage } from './FollowingPage'

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

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function queryBuilder(response: { data?: unknown; error?: { message: string } | null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(response),
    in: vi.fn().mockResolvedValue(response),
    delete: vi.fn().mockReturnThis(),
  }
}

describe('FollowingPage', () => {
  beforeEach(() => {
    from.mockImplementation((table: string) => {
      if (table === 'user_follows') {
        return queryBuilder({ data: [{ followed_id: 'user-a' }, { followed_id: 'user-b' }], error: null })
      }
      return queryBuilder({
        data: [
          { id: 'user-a', display_name: 'Alice', role_status: 'general', external_social_links: [], metadata: {}, reputation_score: 0 },
          { id: 'user-b', display_name: 'Bob', role_status: 'general', external_social_links: [], metadata: {}, reputation_score: 0 },
        ],
        error: null,
      })
    })
  })

  it('searches followed users and batch unfollows selected results', async () => {
    render(<MemoryRouter><FollowingPage /></MemoryRouter>)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    await user.type(screen.getByRole('searchbox'), 'Alice')
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.queryByText('Bob')).toBeNull()

    await user.click(screen.getByRole('checkbox', { name: 'Select Alice' }))
    await user.click(screen.getByRole('button', { name: 'Unfollow selected (1)' }))

    await waitFor(() => expect(screen.getByText('Selected users were unfollowed.')).toBeTruthy())
    expect(screen.queryByText('Alice')).toBeNull()
  })
})
