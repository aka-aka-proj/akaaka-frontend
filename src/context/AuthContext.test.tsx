import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const { getSession, onAuthStateChange, rpc } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: { getSession, onAuthStateChange },
    rpc,
  },
}))

vi.mock('../hooks/useWebPushSessionRefresh', () => ({
  useWebPushSessionRefresh: vi.fn(),
}))

function Probe() {
  const { profile, hasOnboarded } = useAuth()
  return <output>{JSON.stringify({ profile, hasOnboarded })}</output>
}

describe('AuthProvider profile loading', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', identities: [] } } },
      error: null,
    })
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    rpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          role_status: 'general',
          display_name: 'Existing user',
          bio: null,
          external_social_links: [],
          metadata: {},
          reputation_score: 0,
        },
        error: null,
      }),
    })
  })

  it('loads an existing profile through the viewer-aware resolver', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText(/Existing user/)).toBeTruthy())

    expect(rpc).toHaveBeenCalledWith('get_profile_for_viewer', { target_profile_id: 'user-1' })
  })
})
