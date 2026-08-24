import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditEventPage } from './EditEventPage'

const mockUseAuth = vi.fn()
const fromMock = vi.fn()

let currentEvent: Record<string, unknown> | null = null

const baseEvent = {
  id: 'event-1',
  creator_id: 'creator-1',
  title: '測試活動',
  description: null,
  category: 'Social',
  lifecycle_status: 'published',
  publication_status: 'published',
  publish_at: null,
  unpublish_at: null,
  attendance_fee_type: 'free',
  attendance_fee_amount: null,
  event_type: JSON.stringify(['Movie']),
  is_venue_hosted: false,
  visibility_settings: { type: 'public' },
  registration_form_config: null,
  recurrence_rule: null,
  series_id: null,
  start_time: '2020-01-01T12:00:00.000Z',
  location_region: 'Online',
  location_detail: null,
  max_capacity: null,
  registration_deadline: null,
  external_registration_url: null,
  source_url: null,
  created_at: '2019-12-01T00:00:00.000Z',
}

const LOCKED_TITLE = '此活動已鎖定，無法編輯'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../components/MarkdownEditor', () => ({
  MarkdownEditor: () => <textarea aria-label="描述" readOnly />,
}))

vi.mock('../components/RegistrationFormBuilder', () => ({
  RegistrationFormBuilder: () => null,
}))

vi.mock('../components/PrivacyDisclosure', () => ({
  PrivacyDisclosure: () => null,
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}))

describe('EditEventPage edit lock', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'creator-1' }, profile: { role_status: 'general' } })
    fromMock.mockReset()
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: currentEvent, error: null }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }
    })
  })

  it('shows the lock notice without a form when a started non-draft event is opened directly', async () => {
    currentEvent = { ...baseEvent }
    render(
      <MemoryRouter initialEntries={["/events/event-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(LOCKED_TITLE)).toBeTruthy())
    expect(screen.queryByRole('button', { name: '儲存變更' })).toBeNull()
  })

  it('locks terminal lifecycle states even before start_time', async () => {
    currentEvent = { ...baseEvent, lifecycle_status: 'cancelled', start_time: '2099-01-01T12:00:00.000Z' }
    render(
      <MemoryRouter initialEntries={["/events/event-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(LOCKED_TITLE)).toBeTruthy())
    expect(screen.queryByRole('button', { name: '儲存變更' })).toBeNull()
  })

  it('keeps drafts editable even when their start_time has passed', async () => {
    currentEvent = { ...baseEvent, lifecycle_status: 'draft', publication_status: 'closed' }
    render(
      <MemoryRouter initialEntries={["/events/event-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('button', { name: '儲存變更' })).toBeTruthy())
    expect(screen.queryByText(LOCKED_TITLE)).toBeNull()
  })

  it('keeps future non-draft events editable', async () => {
    currentEvent = { ...baseEvent, start_time: '2099-01-01T12:00:00.000Z' }
    render(
      <MemoryRouter initialEntries={["/events/event-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('button', { name: '儲存變更' })).toBeTruthy())
    expect(screen.queryByText(LOCKED_TITLE)).toBeNull()
  })
})
