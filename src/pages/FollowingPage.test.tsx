import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FollowingPage } from './FollowingPage'

const from = vi.fn()
const rpc = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
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
    from.mockClear()
    rpc.mockClear()
    mockUseAuth.mockReturnValue({ user: { id: 'viewer-user' } })
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
    rpc.mockImplementation((_name: string, args: { target_profile_id?: string }) => ({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: args.target_profile_id,
          display_name: args.target_profile_id === 'user-a' ? 'Alice' : 'Bob',
          role_status: 'general',
          external_social_links: [],
          metadata: {},
          reputation_score: 0,
        },
        error: null,
      }),
    }))
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
    expect(screen.getByText('Are you sure you want to unfollow Alice?')).toBeTruthy()
    expect(from).toHaveBeenCalledTimes(1)
    const dialog = screen.getByText('Confirm unfollow').closest('dialog')!
    await user.click(within(dialog).getByRole('button', { name: 'Unfollow', hidden: true }))

    await waitFor(() => expect(screen.getByText('Selected users were unfollowed.')).toBeTruthy())
    expect(screen.queryByText('Alice')).toBeNull()
  })

  it('requires confirmation before unfollowing a single user', async () => {
    render(<MemoryRouter><FollowingPage /></MemoryRouter>)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    await user.click(screen.getAllByRole('button', { name: 'Unfollow' })[0])

    expect(screen.getByText('Are you sure you want to unfollow Alice?')).toBeTruthy()
    await user.click(screen.getByText('取消'))
    expect(screen.queryByText('Are you sure you want to unfollow Alice?')).toBeNull()
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('resolves followed profiles for an admin through the public profile resolver', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'viewer-user', app_metadata: { role: 'admin' } } })
    rpc.mockImplementation((_name: string, args: { target_profile_id?: string }) => ({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: args.target_profile_id, display_name: args.target_profile_id === 'user-a' ? 'Alice' : 'Bob', role_status: 'general', external_social_links: [], metadata: {}, reputation_score: 0 },
        error: null,
      }),
    }))

    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    expect(rpc).toHaveBeenCalledWith('get_public_profile', { target_profile_id: 'user-a' })
    expect(screen.getByRole('link', { name: 'Alice' }).getAttribute('href')).toBe('/profile/user-a')
  })
})
