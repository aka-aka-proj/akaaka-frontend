import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminModerationPanel } from './AdminModerationPanel'

const { mockUseAuth, rpc } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'admin.moderation.target': 'Target',
        'admin.moderation.viewProfile': 'View profile',
        'admin.moderation.submitted': 'Submitted',
        'admin.moderation.noReports': 'No reports',
        'admin.moderation.actionLabel': 'Action',
        'admin.moderation.actionType': 'Action type',
        'admin.moderation.payloadLabel': 'Payload',
        'admin.moderation.payloadAria': 'Action payload',
        'admin.moderation.applyAction': 'Apply action',
        'admin.moderation.warn': 'Warn',
        'admin.moderation.suspend': 'Suspend',
        'admin.moderation.ban': 'Ban',
        'admin.moderation.roleUpgrade': 'Role Upgrade',
        'admin.moderation.roleRevoke': 'Role Revoke',
        'admin.moderation.note': 'Note',
      }
      return translations[key] ?? `${key}${params ? JSON.stringify(params) : ''}`
    },
  }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: { rpc },
}))

describe('AdminModerationPanel', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { app_metadata: { role: 'admin' } },
      loading: false,
    })
    rpc.mockResolvedValue({
      data: [
        {
          id: 'report-1',
          category: 'spam',
          status: 'open',
          target_profile_id: 'target-user-1',
          target_event_id: null,
          created_at: '2026-08-13T00:00:00Z',
        },
      ],
      error: null,
    })
  })

  it('keeps the target profile ID and links to the public profile page', async () => {
    render(
      <MemoryRouter>
        <AdminModerationPanel />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('target-user-1')).toBeTruthy())

    expect(screen.getByRole('link', { name: 'View profile' }).getAttribute('href')).toBe('/profile/target-user-1')
  })

  it('does not render a profile link for an event-only report', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          id: 'report-2',
          category: 'spam',
          status: 'open',
          target_profile_id: null,
          target_event_id: 'event-1',
          created_at: '2026-08-13T00:00:00Z',
        },
      ],
      error: null,
    })

    render(
      <MemoryRouter>
        <AdminModerationPanel />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('event-1')).toBeTruthy())

    expect(screen.queryByRole('link', { name: 'View profile' })).toBeNull()
  })
})
