import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventsPage } from './EventsPage'

const mockUseAuth = vi.fn()
const rpc = vi.fn()
const seriesQuery = vi.fn()

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const event = {
  id: 'event-1',
  creator_id: 'creator-1',
  title: '一般活動標題',
  description: '不包含搜尋字串',
  category: 'Social',
  lifecycle_status: 'published',
  publication_status: 'published',
  publish_at: null,
  unpublish_at: null,
  event_type: JSON.stringify(['Movie']),
  is_venue_hosted: false,
  visibility_settings: { type: 'public' },
  registration_form_config: null,
  recurrence_rule: null,
  series_id: null,
  start_time: '2099-01-01T12:00:00.000Z',
  location_region: 'Online',
  location_detail: null,
  max_capacity: null,
  registration_deadline: null,
  external_registration_url: null,
  source_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../components/EventBookmarkButton', () => ({
  EventBookmarkButton: () => <button type="button" aria-label="bookmark">bookmark</button>,
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => {
      const query = {
        select: () => query, eq: () => query, order: () => query, in: () => query,
        limit: () => seriesQuery(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      }
      return query
    },
  },
}))

describe('EventsPage server-side search contract', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'creator-1' } })
    rpc.mockReset().mockResolvedValue({ data: [event], error: null })
    seriesQuery.mockReset().mockResolvedValue({ data: [], error: null })
  })

  it('keeps an RPC result matched by event type instead of client re-filtering it', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><EventsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('link', { name: '一般活動標題' })).toBeTruthy())
    rpc.mockClear()

    await user.type(screen.getByRole('searchbox'), 'Movie')

    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('search_events', expect.objectContaining({
      p_search: 'Movie',
      p_limit: 50,
      p_offset: 0,
    })))
    expect(screen.getByRole('link', { name: '一般活動標題' })).toBeTruthy()
  })


  it('ignores an older search response after a newer result has completed', async () => {
    const old = deferred<{ data: typeof event[]; error: null }>()
    rpc.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: [{ ...event, id: 'new', title: '最新結果' }], error: null })
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'new' } })
    await screen.findByRole('link', { name: '最新結果' })
    await act(async () => old.resolve({ data: [event], error: null }))
    expect(screen.queryByRole('link', { name: '一般活動標題' })).toBeNull()
    expect(screen.getByRole('link', { name: '最新結果' })).toBeTruthy()
  })

  it('preserves usable results during refresh and lets a failed query retry', async () => {
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    await screen.findByRole('link', { name: '一般活動標題' })
    const pending = deferred<{ data: null; error: { message: string } }>()
    rpc.mockReturnValueOnce(pending.promise)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'new' } })
    expect(screen.getByRole('status').textContent).toContain('載入')
    expect(screen.getByRole('link', { name: '一般活動標題' })).toBeTruthy()
    await act(async () => pending.resolve({ data: null, error: { message: 'private backend detail' } }))
    expect(screen.getByRole('alert').textContent).not.toContain('private backend detail')
    expect(screen.getByRole('link', { name: '一般活動標題' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '重試' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(rpc).toHaveBeenLastCalledWith('search_events', expect.objectContaining({ p_search: 'new', p_offset: 0 }))
  })

  it('does not append an obsolete page after a search change', async () => {
    rpc.mockResolvedValueOnce({ data: Array.from({ length: 50 }, (_, i) => ({ ...event, id: `page-${i}`, title: `活動 ${i}` })), error: null })
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    await screen.findByRole('link', { name: '活動 0' })
    const page = deferred<{ data: typeof event[]; error: null }>()
    rpc.mockReturnValueOnce(page.promise)
    fireEvent.click(screen.getByRole('button', { name: '載入更多活動' }))
    rpc.mockResolvedValueOnce({ data: [{ ...event, id: 'new', title: '最新結果' }], error: null })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'new' } })
    await screen.findByRole('link', { name: '最新結果' })
    await act(async () => page.resolve({ data: [event], error: null }))
    expect(screen.queryByRole('link', { name: '一般活動標題' })).toBeNull()
  })

  it('prevents duplicate pagination requests while one page is pending', async () => {
    rpc.mockResolvedValueOnce({ data: Array.from({ length: 50 }, (_, i) => ({ ...event, id: `page-${i}` })), error: null })
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    const more = await screen.findByRole('button', { name: '載入更多活動' })
    const pending = deferred<{ data: typeof event[]; error: null }>()
    rpc.mockReturnValueOnce(pending.promise)
    fireEvent.click(more)
    fireEvent.click(more)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect((more as HTMLButtonElement).disabled).toBe(true)
    await act(async () => pending.resolve({ data: [], error: null }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('recovers from a rejected request without remaining pending', async () => {
    rpc.mockRejectedValueOnce(new Error('network failure'))
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    await screen.findByRole('alert')
    expect(screen.queryByRole('status')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '重試' }))
    await screen.findByRole('link', { name: '一般活動標題' })
  })

  it('ignores a series request after leaving the series tab', async () => {
    const old = deferred<{ data: null; error: { message: string } }>()
    seriesQuery.mockReturnValueOnce(old.promise)
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    await screen.findByRole('link', { name: '一般活動標題' })
    await userEvent.click(screen.getByRole('button', { name: '活動系列' }))
    await userEvent.click(screen.getAllByRole('button', { name: '全部' })[0])
    await act(async () => old.resolve({ data: null, error: { message: 'old failure' } }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('link', { name: '一般活動標題' })).toBeTruthy()
  })

  it('shows series loading instead of a false empty state, then offers retry', async () => {
    const pending = deferred<{ data: null; error: { message: string } }>()
    seriesQuery.mockReturnValueOnce(pending.promise)
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    await screen.findByRole('link', { name: '一般活動標題' })
    await userEvent.click(screen.getByRole('button', { name: '活動系列' }))
    expect(screen.getByRole('status').textContent).toContain('載入')
    await act(async () => pending.resolve({ data: null, error: { message: 'internal detail' } }))
    expect(screen.getByRole('alert').textContent).not.toContain('internal detail')
    await userEvent.click(screen.getByRole('button', { name: '重試' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(seriesQuery).toHaveBeenCalledTimes(2)
  })

  it('uses one accessible create menu for event and series creation', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><EventsPage /></MemoryRouter>)

    const trigger = screen.getByRole('button', { name: '建立活動' })
    await user.click(trigger)

    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '建立活動' }).getAttribute('href')).toBe('/events/new')
    expect(screen.getByRole('menuitem', { name: '建立活動系列' }).getAttribute('href')).toBe('/events/series/new')

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '建立活動系列' }))
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '建立活動' }))
    await user.click(screen.getByRole('heading', { name: '探索活動' }))
    expect(screen.queryByRole('menu')).toBeNull()

    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
