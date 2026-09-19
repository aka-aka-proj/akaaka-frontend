import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventSchedulingPollPage } from './EventSchedulingPollPage'

const fromMock = vi.fn()
const insertMock = vi.fn(() => Promise.resolve({ error: null }))
let eventResult: { data: Record<string, unknown> | null; error: { message: string } | null }

vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner-1' } }) }))
vi.mock('../hooks/useT', () => ({ useT: () => ({ t: (key: string) => ({
  'common.back': '返回上一頁', 'common.loading': '載入中...', 'schedulingPoll.title': '日期／地點投票',
  'schedulingPoll.permissionDenied': '你沒有權限查看這個投票。',
  'schedulingPoll.emptyOwner': '尚未建立投票。建立後即可加入候選日期、地點與投票者。',
  'schedulingPoll.create': '建立投票', 'schedulingPoll.created': '投票已建立。',
}[key] ?? key), locale: 'zh-TW' }) }))
vi.mock('../supabaseClient', () => ({ supabase: { from: (table: string) => fromMock(table), rpc: vi.fn() } }))

function renderPage() {
  render(<MemoryRouter initialEntries={['/events/event-1/scheduling-poll']}><Routes><Route path="/events/:id/scheduling-poll" element={<EventSchedulingPollPage />} /></Routes></MemoryRouter>)
}

describe('EventSchedulingPollPage', () => {
  beforeEach(() => {
    insertMock.mockClear()
    eventResult = { data: { title: '草稿活動', creator_id: 'owner-1', lifecycle_status: 'draft' }, error: null }
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(eventResult) }) }) }
      if (table === 'event_scheduling_polls') return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: insertMock,
      }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('shows an explicit permission state when the event cannot be read', async () => {
    eventResult = { data: null, error: { message: 'denied' } }
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toContain('你沒有權限查看這個投票。')
  })

  it('lets a draft owner create the poll from the empty state', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: '建立投票' }))
    await waitFor(() => expect(insertMock).toHaveBeenCalledWith({ event_id: 'event-1', creator_id: 'owner-1' }))
    expect((await screen.findByRole('status')).textContent).toContain('投票已建立。')
  })
})
