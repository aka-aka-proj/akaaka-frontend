import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditProfilePage } from './EditProfilePage'

const mockUseAuth = vi.fn()
const from = vi.fn()
const refreshProfile = vi.fn().mockResolvedValue(undefined)

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: () => {} }),
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}))

type QueryResponse = { data?: unknown; error?: { message: string } | null }

function queryBuilder(response: QueryResponse) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
    update: vi.fn().mockReturnThis(),
  }
}

describe('EditProfilePage', () => {
  beforeEach(() => {
    refreshProfile.mockClear()
    from.mockReset()
    mockUseAuth.mockReturnValue({
      user: { id: 'viewer-user' },
      refreshProfile,
    })
  })

  it('loads existing profile fields on the dedicated edit page', async () => {
    const loadQuery = queryBuilder({
      data: {
        id: 'viewer-user',
        role_status: 'general',
        display_name: 'Self User',
        bio: 'Own bio',
        external_social_links: [],
        metadata: {
          visibility: { bio: 'private', gender_identity: 'connections_only', bdsm_roles: 'public' },
          gender_identity: 'non_binary',
          bdsm_roles: ['switch'],
          avatar_path: '/avatar/Creative_studio_20260806_202218.jpg',
        },
        reputation_score: 1,
      },
      error: null,
    })

    from.mockReturnValue(loadQuery)

    render(
      <MemoryRouter initialEntries={['/profile/me/edit']}>
        <Routes>
          <Route path="/profile/me/edit" element={<EditProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Self User')).toBeTruthy()
    })
    expect(screen.getByDisplayValue('Own bio')).toBeTruthy()
    expect((screen.getByLabelText('Bio visibility') as HTMLSelectElement).value).toBe('private')
    expect((screen.getByLabelText('Gender identity') as HTMLSelectElement).value).toBe('non_binary')
  })

  it('saves profile changes and returns to the profile page', async () => {
    const loadQuery = queryBuilder({
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
    const metadataQuery = queryBuilder({
      data: {
        metadata: { external_social_links: [{ platform: 'x', url: 'https://x.com/self' }] },
      },
      error: null,
    })
    const updateQuery = queryBuilder({ data: null, error: null })

    from
      .mockReturnValueOnce(loadQuery)
      .mockReturnValueOnce(metadataQuery)
      .mockReturnValueOnce(updateQuery)

    render(
      <MemoryRouter initialEntries={['/profile/me/edit']}>
        <Routes>
          <Route path="/profile/me/edit" element={<EditProfilePage />} />
          <Route path="/profile/me" element={<div>Profile destination</div>} />
        </Routes>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Self User')).toBeTruthy()
    })

    await user.clear(screen.getByLabelText('Display name'))
    await user.type(screen.getByLabelText('Display name'), 'Updated User')
    await user.clear(screen.getByLabelText('Bio'))
    await user.type(screen.getByLabelText('Bio'), 'Updated bio')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => {
      expect(updateQuery.update).toHaveBeenCalledWith({
        display_name: 'Updated User',
        bio: 'Updated bio',
        metadata: {
          external_social_links: [{ platform: 'x', url: 'https://x.com/self' }],
          visibility: {
            bio: 'public',
            gender_identity: 'public',
            bdsm_roles: 'public',
          },
          avatar_path: null,
          gender_identity: null,
          bdsm_roles: null,
        },
      })
    })
    expect(refreshProfile).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('Profile destination')).toBeTruthy()
    })
  })
})
