import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const mockUseAuth = vi.fn()
const from = vi.fn()
const functionsInvoke = vi.fn()
const unlinkIdentity = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: () => {} }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    auth: {
      unlinkIdentity: (...args: unknown[]) => unlinkIdentity(...args),
    },
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
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue(response),
    lt: vi.fn().mockResolvedValue(response),
    order: vi.fn().mockResolvedValue(response),
    gte: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
    insert: vi.fn().mockResolvedValue(response),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  }
}

describe('ProfilePage', () => {
  beforeEach(() => {
    unlinkIdentity.mockReset()
    mockUseAuth.mockReturnValue({
      user: { id: 'viewer-user' },
      refreshProfile: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('keeps the original identity and allows unlinking a secondary identity', async () => {
    const profilesQuery = queryBuilder({
      data: {
        id: 'viewer-user',
        role_status: 'general',
        display_name: 'Self User',
        bio: 'Own bio',
        external_social_links: [],
        metadata: { visibility: { bio: 'public' } },
        reputation_score: 1,
      },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })
    const primary = { identity_id: 'primary', provider: 'google', created_at: '2026-01-01T00:00:00Z' }
    const secondary = { identity_id: 'secondary', provider: 'x', created_at: '2026-02-01T00:00:00Z' }
    mockUseAuth.mockReturnValue({
      user: { id: 'viewer-user' },
      identities: [primary, secondary],
      refreshProfile: vi.fn().mockResolvedValue(undefined),
    })
    from.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesQuery
      if (table === 'blocks') return blocksQuery
      return queryBuilder({ data: null, error: null })
    })
    unlinkIdentity.mockResolvedValue({ error: null })
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open')
    }

    render(
      <MemoryRouter initialEntries={['/profile/me']}>
        <Routes>
          <Route path="/profile/me" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Self User')).toBeTruthy())
    expect(screen.getByText('Main sign-in account · cannot unlink')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Unlink x account' }))
    await userEvent.click(screen.getByRole('button', { name: 'Unlink' }))

    await waitFor(() => expect(unlinkIdentity).toHaveBeenCalledWith(secondary))
    expect(screen.queryByRole('button', { name: 'Unlink x account' })).toBeNull()
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
    expect(screen.queryByLabelText('Display name')).toBeNull()
    expect(screen.getByRole('link', { name: 'Edit profile' }).getAttribute('href')).toBe('/profile/me/edit')
  })

  it('opens the profile share dialog for the owner', async () => {
    const profilesQuery = queryBuilder({
      data: {
        id: 'viewer-user',
        role_status: 'general',
        display_name: 'Self User',
        bio: 'Own bio',
        external_social_links: [],
        metadata: { visibility: { bio: 'public' } },
        reputation_score: 1,
      },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesQuery
      if (table === 'blocks') return blocksQuery
      return queryBuilder({ data: null, error: null })
    })

    render(
      <MemoryRouter initialEntries={['/profile/me']}>
        <Routes>
          <Route path="/profile/me" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'Share my profile' })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: 'Share my profile' }))

    expect(screen.getByRole('dialog', { name: 'Share profile' })).toBeTruthy()
    expect(screen.getByText(`${window.location.origin}/profile/viewer-user`)).toBeTruthy()
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

  it('follows another user from their profile', async () => {
    const profilesQuery = queryBuilder({
      data: {
        id: 'target-user',
        role_status: 'general',
        display_name: 'Target User',
        bio: 'Public bio',
        external_social_links: [],
        metadata: { visibility: { bio: 'public' } },
        reputation_score: 3,
      },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })
    const followsQuery = queryBuilder({ data: null, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesQuery
      if (table === 'blocks') return blocksQuery
      if (table === 'user_follows') return followsQuery
      return queryBuilder({ data: null, error: null })
    })

    render(
      <MemoryRouter initialEntries={['/profile/target-user']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: 'Follow' }))

    expect(followsQuery.insert).toHaveBeenCalledWith({
      follower_id: 'viewer-user',
      followed_id: 'target-user',
    })
    expect(await screen.findByText('User followed.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unfollow' })).toBeTruthy()
  })

  it('keeps secondary profile actions in the more menu', async () => {
    const profilesQuery = queryBuilder({
      data: {
        id: 'target-user',
        role_status: 'general',
        display_name: 'Target User',
        bio: 'Public bio',
        external_social_links: [],
        metadata: { visibility: { bio: 'public' } },
        reputation_score: 3,
      },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesQuery
      if (table === 'blocks') return blocksQuery
      return queryBuilder({ data: null, error: null })
    })

    render(
      <MemoryRouter initialEntries={['/profile/target-user']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'More options' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Notify me about this user’s new events' }).querySelector('svg')).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Block user' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Report user' })).toBeTruthy()
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

  it('displays report count from profile_report_stats', async () => {
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
    const reportStatsQuery = queryBuilder({
      data: { report_count: 3 },
      error: null,
    })
    const blocksQuery = queryBuilder({ data: null, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profilesQuery
      }
      if (table === 'profile_report_stats') {
        return reportStatsQuery
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
    expect(screen.getByRole('link', { name: 'Reports: 3' })).toBeTruthy()
  })
})
