import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventSchedulingPollPage } from './EventSchedulingPollPage'

const fromMock = vi.fn()
const rpcMock = vi.fn()
const insertMock = vi.fn(() => Promise.resolve({ error: null }))
let eventResult: { data: Record<string, unknown> | null; error: { message: string } | null }
let pollResult: { data: Record<string, unknown> | null; error: { message: string } | null }

vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../context/AuthContext', () => { const user = { id: 'owner-1' }; return { useAuth: () => ({ user }) } })
vi.mock('../hooks/useT', () => {
  const t = (key: string) => ({
    'common.back': '返回上一頁', 'common.loading': '載入中...', 'schedulingPoll.title': '日期／地點投票',
    'schedulingPoll.permissionDenied': '你沒有權限查看這個投票。',
    'schedulingPoll.emptyOwner': '尚未建立投票。建立後即可加入候選日期、地點與投票者。',
    'schedulingPoll.create': '建立投票', 'schedulingPoll.created': '投票已建立。',
    'schedulingPoll.manage': '管理投票', 'schedulingPoll.dateCandidate': '候選日期',
    'schedulingPoll.locationCandidate': '候選地點', 'schedulingPoll.findVoter': '尋找投票者',
    'schedulingPoll.add': '新增', 'schedulingPoll.search': '搜尋', 'schedulingPoll.eligibleCount': '0 位符合資格的投票者',
    'schedulingPoll.finalize': '確認結果', 'schedulingPoll.noVotes': '目前沒有投票',
    'schedulingPoll.confirmAndFinalize': '確認並完成', 'schedulingPoll.choose': '請選擇',
    'schedulingPoll.dates': '日期', 'schedulingPoll.locations': '地點', 'schedulingPoll.noCandidates': '尚無候選項目',
    'schedulingPoll.mutationError': '操作失敗',
  }[key] ?? key)
  return { useT: () => ({ t, locale: 'zh-TW' }) }
})
vi.mock('../supabaseClient', () => ({ supabase: { from: (table: string) => fromMock(table), rpc: (...args: unknown[]) => rpcMock(...args) } }))

function renderPage() {
  render(<MemoryRouter initialEntries={['/events/event-1/scheduling-poll']}><Routes><Route path="/events/:id/scheduling-poll" element={<EventSchedulingPollPage />} /></Routes></MemoryRouter>)
}

describe('EventSchedulingPollPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    insertMock.mockClear()
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: [], error: null })
    eventResult = { data: { title: '草稿活動', creator_id: 'owner-1', lifecycle_status: 'draft' }, error: null }
    pollResult = { data: null, error: null }
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(eventResult) }) }) }
      if (table === 'event_scheduling_polls') return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(pollResult) }) }),
        insert: insertMock,
      }
      if (table === 'event_scheduling_poll_options') return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }), insert: insertMock }
      if (table === 'event_scheduling_poll_votes') return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }
      if (table === 'event_scheduling_poll_voters') return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
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

  it('warns before a configuration change that would clear existing votes', async () => {
    pollResult = { data: { id: 'poll-1', event_id: 'event-1', creator_id: 'owner-1', status: 'open', closed_at: null }, error: null }
    rpcMock.mockImplementation((name: string) => Promise.resolve(name === 'get_event_scheduling_poll_results'
      ? { data: [{ option_id: 'existing-option', vote_count: 2 }], error: null }
      : { data: [], error: null }))
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const user = userEvent.setup()
    renderPage()

    const locationInput = await screen.findByLabelText('候選地點')
    await user.type(locationInput, '台北車站')
    const addButtons = await screen.findAllByRole('button', { name: '新增' })
    const addLocationButton = addButtons[1]

    await user.click(addLocationButton)
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(insertMock).not.toHaveBeenCalled()

    await user.click(addLocationButton)
    await waitFor(() => expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ poll_id: 'poll-1', kind: 'location', location_label: '台北車站' })))
    expect(confirmMock).toHaveBeenCalledTimes(2)
  })

  it('refreshes vote counts before configuration mutation to catch votes added by another session', async () => {
    pollResult = { data: { id: 'poll-1', event_id: 'event-1', creator_id: 'owner-1', status: 'open', closed_at: null }, error: null }
    let resultReads = 0
    rpcMock.mockImplementation((name: string) => {
      if (name !== 'get_event_scheduling_poll_results') return Promise.resolve({ data: [], error: null })
      resultReads += 1
      return Promise.resolve(resultReads === 1
        ? { data: [], error: null }
        : { data: [{ option_id: 'new-vote', vote_count: 1 }], error: null })
    })
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderPage()

    const locationInput = await screen.findByLabelText('候選地點')
    await user.type(locationInput, '台北車站')
    const addLocationButton = (await screen.findAllByRole('button', { name: '新增' }))[1]

    await user.click(addLocationButton)
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(resultReads).toBeGreaterThanOrEqual(2)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('requires confirmation before an organizer resets all votes and reloads after success', async () => {
    pollResult = { data: { id: 'poll-1', event_id: 'event-1', creator_id: 'owner-1', status: 'open', closed_at: null }, error: null }
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const user = userEvent.setup()
    renderPage()

    const resetButton = await screen.findByRole('button', { name: '清空所有投票' })
    await user.click(resetButton)
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).not.toHaveBeenCalledWith('reset_event_scheduling_poll_votes', expect.anything())

    const pollReadsBeforeReset = fromMock.mock.calls.filter(([table]) => table === 'event_scheduling_polls').length
    await user.click(resetButton)
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('reset_event_scheduling_poll_votes', { p_poll_id: 'poll-1' }))
    expect((await screen.findByRole('status')).textContent).toContain('所有投票已清空')
    await waitFor(() => {
      const pollReadsAfterReset = fromMock.mock.calls.filter(([table]) => table === 'event_scheduling_polls').length
      expect(pollReadsAfterReset).toBeGreaterThan(pollReadsBeforeReset)
    })
  })
})
