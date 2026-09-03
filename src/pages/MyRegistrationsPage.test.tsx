import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MyRegistrationsPage } from './MyRegistrationsPage'

const mockUseAuth = vi.fn()
const queryResults = new Map<string, { data: unknown[] | null; error: Error | null }>()

function queryFor(table: string) {
  const result = queryResults.get(table) ?? { data: [], error: null }
  const builder = Object.assign(Promise.resolve(result), {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    order: () => builder,
  })
  return builder
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, variables?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        'myRegistrations.title': '我的報名',
        'myRegistrations.noRegistrations': '尚未報名任何活動。',
        'myRegistrations.seriesProgressTitle': '活動系列進度',
        'myRegistrations.seriesProgressSummary': `已報名 ${variables?.registered}／${variables?.total} 場`,
        'myRegistrations.individualRegistrationsTitle': '單場報名記錄',
        'myRegistrations.notRegistered': '尚未報名',
        'myRegistrations.seriesLoadFailed': '活動系列進度載入失敗，請稍後再試。',
        'eventSeries.sessionNumber': `第${variables?.number}場`,
        'eventDetail.regApproved': '已核准',
        'eventDetail.regPending': '等待審核',
        'eventDetail.regRejected': '已拒絕',
        'eventDetail.regWaitlisted': '候補中',
        'eventDetail.regCancellationPending': '取消參加申請審核中...',
        'eventDetail.regCancellationRejected': '取消申請已被拒絕',
        'eventDetail.cancelRegistration': '取消報名',
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (table: string) => queryFor(table),
    functions: { invoke: vi.fn() },
  },
}))

describe('MyRegistrationsPage activity series progress', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    queryResults.clear()
    queryResults.set('event_registrations', {
      data: [
        { id: 'registration-1', event_id: 'event-1', profile_id: 'user-1', status: 'approved', waitlist_position: null, event: { id: 'event-1', title: '第一場', start_time: '2099-01-01T12:00:00.000Z' } },
        { id: 'registration-2', event_id: 'event-2', profile_id: 'user-1', status: 'pending', waitlist_position: null, event: { id: 'event-2', title: '第二場', start_time: '2099-02-01T12:00:00.000Z' } },
      ],
      error: null,
    })
    queryResults.set('event_series_registrations', {
      data: [{ id: 'series-registration-1', series_id: 'series-1', profile_id: 'user-1', status: 'approved', whole_series_registration: true, created_at: '2098-12-01T00:00:00.000Z' }],
      error: null,
    })
    queryResults.set('event_series', {
      data: [{ id: 'series-1', title: '完整課程系列' }],
      error: null,
    })
    queryResults.set('event_series_membership', {
      data: [
        { series_id: 'series-1', event_id: 'event-1', position: 1, event: [{ id: 'event-1', title: '第一場', start_time: '2099-01-01T12:00:00.000Z' }] },
        { series_id: 'series-1', event_id: 'event-2', position: 2, event: [{ id: 'event-2', title: '第二場', start_time: '2099-02-01T12:00:00.000Z' }] },
        { series_id: 'series-1', event_id: 'event-3', position: 3, event: { id: 'event-3', title: '第三場', start_time: '2099-03-01T12:00:00.000Z' } },
      ],
      error: null,
    })
  })

  it('shows series progress and each member registration status', async () => {
    render(<MemoryRouter><MyRegistrationsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('heading', { name: '活動系列進度' })).toBeTruthy())

    expect(screen.getByText('完整課程系列')).toBeTruthy()
    expect(screen.getByText('已報名 2／3 場')).toBeTruthy()
    expect(screen.getAllByText('已核准')).toHaveLength(3)
    expect(screen.getByText('尚未報名')).toBeTruthy()
    expect(screen.getByRole('link', { name: '第1場：第一場' }).getAttribute('href')).toBe('/events/event-1')
    expect(screen.getByRole('heading', { name: '單場報名記錄' })).toBeTruthy()
  })

  it('keeps the existing empty state when there are no registrations', async () => {
    queryResults.set('event_registrations', { data: [], error: null })
    queryResults.set('event_series_registrations', { data: [], error: null })

    render(<MemoryRouter><MyRegistrationsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('尚未報名任何活動。')).toBeTruthy())
    expect(screen.queryByRole('heading', { name: '活動系列進度' })).toBeNull()
  })

  it('shows a visible error when the series registration query fails', async () => {
    queryResults.set('event_series_registrations', { data: null, error: new Error('permission denied') })

    render(<MemoryRouter><MyRegistrationsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('permission denied')).toBeTruthy())
    expect(screen.getByRole('link', { name: '第一場' })).toBeTruthy()
  })
})
