import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserDirectoryPage } from './UserDirectoryPage'

const from = vi.fn()
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer-user' } }) }))
vi.mock('../context/LanguageContext', () => ({ useLanguage: () => ({ locale: 'en', setLocale: () => {} }) }))
vi.mock('../supabaseClient', () => ({ supabase: { from: (...args: unknown[]) => from(...args) } }))
vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: ReactNode }) => <div>{children}</div> }))

describe('UserDirectoryPage', () => {
  beforeEach(() => {
    from.mockImplementation((table: string) => {
      const query = { select: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn(), eq: vi.fn().mockReturnThis(), insert: vi.fn(), delete: vi.fn().mockReturnThis() }
      if (table === 'public_profiles') query.limit.mockResolvedValue({ data: [{ id: 'user-a', display_name: 'Alice', avatar_path: null }], error: null })
      else if (table === 'user_follows') query.limit.mockResolvedValue({ data: [], error: null })
      else query.limit.mockResolvedValue({ data: [], error: null })
      query.insert.mockResolvedValue({ error: null })
      return query
    })
  })
  it('browses other profiles', async () => {
    render(<MemoryRouter><UserDirectoryPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    expect(screen.getByRole('link', { name: 'Alice' }).getAttribute('href')).toBe('/profile/user-a')
  })

  it('follows a user and enables their activity notifications independently', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><UserDirectoryPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Follow' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unfollow' })).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Notify me about this user’s new events' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop notifying me about this user’s new events' })).toBeTruthy())
  })
})
