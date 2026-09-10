import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditEventPage } from './EditEventPage'

const mockUseAuth = vi.fn()
const fromMock = vi.fn()
const rpcMock = vi.fn((..._args: unknown[]) => Promise.resolve({ data: null, error: null }))
const eventUpdateEqMock = vi.fn(() => Promise.resolve({ data: null, error: null }))
const eventUpdateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: eventUpdateEqMock }))

let currentEvent: Record<string, unknown> | null = null
let seriesChildren: Record<string, unknown>[] = []

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
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

describe('EditEventPage edit lock', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'creator-1' }, profile: { role_status: 'general' } })
    fromMock.mockReset()
    rpcMock.mockClear()
    eventUpdateMock.mockClear()
    eventUpdateEqMock.mockClear()
    seriesChildren = []
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: (column: string) => column === 'series_id'
              ? Promise.resolve({ data: seriesChildren, error: null })
              : ({ maybeSingle: () => Promise.resolve({ data: currentEvent, error: null }) }),
          }),
          update: eventUpdateMock,
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

  it('hides publication schedule controls for drafts', async () => {
    currentEvent = { ...baseEvent, lifecycle_status: 'draft', publication_status: 'closed', publish_at: '2026-09-01T12:00:00.000Z' }
    render(
      <MemoryRouter initialEntries={["/events/event-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('button', { name: '儲存變更' })).toBeTruthy())
    expect(screen.queryByLabelText('自動公開時間（選填）')).toBeNull()
    expect(screen.queryByLabelText('自動下架時間（選填）')).toBeNull()
  })

  it('shows publication schedule controls once the event is not a draft', async () => {
    currentEvent = { ...baseEvent, lifecycle_status: 'published', start_time: '2099-01-01T12:00:00.000Z', publish_at: null }
    render(
      <MemoryRouter initialEntries={["/events/event-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('button', { name: '儲存變更' })).toBeTruthy())
    expect(screen.getByLabelText('自動公開時間（選填）')).toBeTruthy()
    expect(screen.getByLabelText('自動下架時間（選填）')).toBeTruthy()
  })

  it('submits null schedule times when saving a draft that still carries stale schedules', async () => {
    currentEvent = { ...baseEvent, lifecycle_status: 'draft', publication_status: 'closed', publish_at: '2026-09-01T12:00:00.000Z' }
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={["/events/event-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('button', { name: '儲存變更' })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '儲存變更' }))
    await waitFor(() => expect(rpcMock).toHaveBeenCalled())
    const publicationCall = rpcMock.mock.calls.find(([name]) => name === 'set_event_publication')
    expect(publicationCall).toBeTruthy()
    const args = publicationCall![1] as { p_publish_at: unknown; p_unpublish_at: unknown }
    expect(args.p_publish_at).toBeNull()
    expect(args.p_unpublish_at).toBeNull()
  })

  it('allows a future recurring occurrence to change start time in single scope only', async () => {
    currentEvent = {
      ...baseEvent,
      id: 'instance-1',
      series_id: 'parent-1',
      start_time: '2099-01-01T12:00:00.000Z',
    }
    seriesChildren = [
      { id: 'instance-1', start_time: '2099-01-01T12:00:00.000Z', lifecycle_status: 'published', title: '本場' },
      { id: 'instance-2', start_time: '2099-01-08T12:00:00.000Z', lifecycle_status: 'published', title: '下一場' },
    ]
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={["/events/instance-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    const startInput = await screen.findByLabelText('開始時間')
    expect((startInput as HTMLInputElement).disabled).toBe(false)
    expect(screen.getByText('只會影響此場，不會變更其他定期場次。')).toBeTruthy()

    await user.clear(startInput)
    await user.type(startInput, '2099-01-02T20:00')
    expect(screen.getByText('開始時間已變更；報名截止不會自動調整，請確認目前設定仍合理。')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '儲存變更' }))

    await waitFor(() => expect(eventUpdateMock).toHaveBeenCalled())
    expect(eventUpdateMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      start_time: new Date('2099-01-02T20:00').toISOString(),
      registration_deadline: null,
    }))
  })

  it('disables recurring occurrence start time outside single scope', async () => {
    currentEvent = {
      ...baseEvent,
      id: 'instance-1',
      series_id: 'parent-1',
      start_time: '2099-01-01T12:00:00.000Z',
    }
    seriesChildren = [
      { id: 'instance-1', start_time: '2099-01-01T12:00:00.000Z', lifecycle_status: 'published', title: '本場' },
      { id: 'instance-2', start_time: '2099-01-08T12:00:00.000Z', lifecycle_status: 'published', title: '下一場' },
    ]
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={["/events/instance-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('radio', { name: '此場與後續場次' }))
    expect((screen.getByLabelText('開始時間') as HTMLInputElement).disabled).toBe(true)
  })

  it('rejects moving a recurring occurrence start time into the past before writing', async () => {
    currentEvent = {
      ...baseEvent,
      id: 'instance-1',
      series_id: 'parent-1',
      start_time: '2099-01-01T12:00:00.000Z',
    }
    seriesChildren = [
      { id: 'instance-1', start_time: '2099-01-01T12:00:00.000Z', lifecycle_status: 'published', title: '本場' },
    ]
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={["/events/instance-1/edit"]}>
        <Routes>
          <Route path="/events/:id/edit" element={<EditEventPage />} />
        </Routes>
      </MemoryRouter>
    )

    const startInput = await screen.findByLabelText('開始時間')
    await user.clear(startInput)
    await user.type(startInput, '2020-01-01T12:00')
    await user.click(screen.getByRole('button', { name: '儲存變更' }))

    expect(await screen.findByText('新的開始時間必須晚於目前時間。')).toBeTruthy()
    expect(eventUpdateMock).not.toHaveBeenCalled()
  })
})
