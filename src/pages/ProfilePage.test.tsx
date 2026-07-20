import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const mockUseAuth = vi.fn()
const from = vi.fn()
const functionsInvoke = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: () => {} }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    functions: {
      invoke: (...args: unknown[]) => functionsInvoke(...args),
    },
  },
}))

type QueryResponse = { data?: unknown; error?: { message: string } | null; count?: number | null }

function queryBuilder(response: QueryResponse) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
    insert: vi.fn().mockResolvedValue(response),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  }
}

describe('ProfilePage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'viewer-user' },
      refreshProfile: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('blocks self recommendation actions on own profile', async () => {
    const profilesQuery = queryBuilder({
      data: {
        id: 'viewer-user',
        role_status: 'general',
        display_name: 'Self User',
        bio: 'Own bio',
        external_social_links: [{ platform: 'x', url: 'https://x.com/self' }],
        metadata: { visibility: { bio: 'public' } },
        reputation_score: 1,
      },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profilesQuery
      }
      if (table === 'blocks') {
        return blocksQuery
      }
      return queryBuilder({ data: null, error: null })
    })

    render(
      <MemoryRouter initialEntries={['/profile/me']}>
        <Routes>
          <Route path="/profile/me" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Self User')).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: 'Give Recommendation' })).toBeNull()
  })

  it('hides private bio for non-owner viewer', async () => {
    const profilesQuery = queryBuilder({
      data: {
        id: 'target-user',
        role_status: 'general',
        display_name: 'Target User',
        bio: 'Sensitive bio text',
        external_social_links: [{ platform: 'x', url: 'https://x.com/target' }],
        metadata: { visibility: { bio: 'private' } },
        reputation_score: 3,
      },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profilesQuery
      }
      if (table === 'blocks') {
        return blocksQuery
      }
      return queryBuilder({ data: null, error: null })
    })

    render(
      <MemoryRouter initialEntries={['/profile/target-user']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Target User')).toBeTruthy()
    })
    expect(screen.getByText('Bio: Hidden (private)')).toBeTruthy()
  })

  it('shows rate limit message when Edge Function returns 429', async () => {
    const profilesQuery = queryBuilder({
      data: {
        id: 'target-user',
        role_status: 'general',
        display_name: 'Target User',
        bio: 'Public bio',
        external_social_links: [{ platform: 'x', url: 'https://x.com/target' }],
        metadata: { visibility: { bio: 'public' } },
        reputation_score: 8,
      },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profilesQuery
      }
      if (table === 'blocks') {
        return blocksQuery
      }
      return queryBuilder({ data: null, error: null })
    })

    functionsInvoke.mockResolvedValue({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
      response: { status: 429 },
    })

    render(
      <MemoryRouter initialEntries={['/profile/target-user']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Give Recommendation' })).toBeTruthy()
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Give Recommendation' }))

    await waitFor(() => {
      expect(screen.getByText('You can only recommend this person once every 24 hours.')).toBeTruthy()
    })
  })

  it('shows success message when recommendation is submitted via Edge Function', async () => {
    const profilesQuery = queryBuilder({
      data: {
        id: 'target-user',
        role_status: 'general',
        display_name: 'Target User',
        bio: 'Public bio',
        external_social_links: [],
        metadata: { visibility: { bio: 'public' } },
        reputation_score: 5,
      },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profilesQuery
      }
      if (table === 'blocks') {
        return blocksQuery
      }
      return queryBuilder({ data: null, error: null })
    })

    functionsInvoke.mockResolvedValue({
      data: { success: true, recommendation_id: 'rec-uuid-1' },
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/profile/target-user']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Give Recommendation' })).toBeTruthy()
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Give Recommendation' }))

    await waitFor(() => {
      expect(screen.getByText('Recommendation submitted.')).toBeTruthy()
    })
  })
})
