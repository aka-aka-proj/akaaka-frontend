import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventAnnouncements } from './EventAnnouncements'

const from = vi.fn()
const rpc = vi.fn()

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

const publishedAnnouncement = {
  id: 'announcement-1',
  event_id: 'event-1',
  title: '場地變更',
  body_markdown: '請從後門入場。',
  status: 'published',
  publish_at: null,
  published_at: '2026-08-23T01:00:00Z',
  created_at: '2026-08-23T01:00:00Z',
  updated_at: '2026-08-23T01:00:00Z',
}

describe('EventAnnouncements', () => {
  beforeEach(() => {
    from.mockClear()
    rpc.mockClear()
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [publishedAnnouncement], error: null }),
          }),
        }),
      }),
    })
    rpc.mockResolvedValue({ data: publishedAnnouncement, error: null })
  })

  it('shows published history to an attendee without host controls', async () => {
    render(<EventAnnouncements eventId="event-1" isHost={false} nativeRegistration isAuthenticated />)

    expect(await screen.findByRole('heading', { name: '場地變更' })).toBeTruthy()
    expect(screen.getByText('請從後門入場。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '新增公告' })).toBeNull()
  })

  it('hides the announcement limits until the host attempts to add a sixth announcement', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(announcementQueryResult(Array.from({ length: 5 }, (_, index) => ({
      ...publishedAnnouncement,
      id: `announcement-${index + 1}`,
    }))))
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    expect((await screen.findAllByRole('heading', { name: '場地變更' })).length).toBe(5)
    expect(screen.queryByText('每個活動最多 5 則公告，已發布公告至少間隔 12 小時。已發布公告不可編輯或刪除。')).toBeNull()

    await user.click(screen.getByRole('button', { name: '新增公告' }))

    expect((await screen.findByRole('alert')).textContent).toContain('此活動已有 5 則公告，無法再新增。')
    expect(screen.queryByLabelText(/公告標題/)).toBeNull()
  })

  it('keeps an unsaved editor open when adding another announcement is no longer allowed', async () => {
    const user = userEvent.setup()
    const fiveAnnouncements = Array.from({ length: 5 }, (_, index) => ({
      ...publishedAnnouncement,
      id: `announcement-${index + 1}`,
      ...(index === 0 ? { status: 'draft', published_at: null } : {}),
    }))
    from.mockReturnValue(announcementQueryResult(fiveAnnouncements))
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '編輯' }))
    const titleInput = screen.getByLabelText(/公告標題/) as HTMLInputElement
    await user.clear(titleInput)
    await user.type(titleInput, '尚未儲存的標題')

    await user.click(screen.getByRole('button', { name: '新增公告' }))

    expect((screen.getByRole('alert')).textContent).toContain('此活動已有 5 則公告，無法再新增。')
    expect((screen.getByLabelText(/公告標題/) as HTMLInputElement).value).toBe('尚未儲存的標題')
  })

  it('publishes a draft through the constrained RPC', async () => {
    const user = userEvent.setup()
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ ...publishedAnnouncement, status: 'draft', published_at: null }],
              error: null,
            }),
          }),
        }),
      }),
    })
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '立即發布' }))
    await user.click(screen.getByRole('dialog').querySelector('.danger-action') as HTMLElement)

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('publish_event_announcement', {
      p_announcement_id: 'announcement-1',
    }))
  })

  it('applies edit + publish-now through the single atomic RPC while editing', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(draftQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '編輯' }))
    await user.click(screen.getByRole('radio', { name: /立即發布/ }))
    await user.click(screen.getByRole('button', { name: '儲存並立即發布' }))

    expect(screen.getByRole('dialog', { name: '確定要立即發布這則公告嗎？' })).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
    await user.click(screen.getByRole('dialog').querySelector('.danger-action') as HTMLElement)

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('update_and_publish_announcement', {
      p_announcement_id: 'announcement-1',
      p_title: '場地變更',
      p_body_markdown: '請從後門入場。',
    }))
    expect(rpc).not.toHaveBeenCalledWith('update_event_announcement', expect.anything())
    expect(rpc).not.toHaveBeenCalledWith('publish_event_announcement', expect.anything())
  })

  it('keeps the scheduled row untouched and surfaces the error when the atomic RPC fails', async () => {
    const user = userEvent.setup()
    rpc.mockImplementation((name: string) =>
      name === 'update_and_publish_announcement'
        ? Promise.resolve({ data: null, error: { message: 'rate_limited' } })
        : Promise.resolve({ data: publishedAnnouncement, error: null }),
    )
    from.mockReturnValue(draftQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '編輯' }))
    await user.click(screen.getByRole('radio', { name: /立即發布/ }))
    await user.click(screen.getByRole('button', { name: '儲存並立即發布' }))
    await user.click(screen.getByRole('dialog').querySelector('.danger-action') as HTMLElement)

    expect(await screen.findByText('距離上一則已發布公告未滿 12 小時，請稍後再試。')).toBeTruthy()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('update_and_publish_announcement', expect.anything())
  })

  it('saves an edited announcement back to draft through update_event_announcement', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(draftQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '編輯' }))
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('update_event_announcement', expect.objectContaining({
      p_announcement_id: 'announcement-1',
      p_status: 'draft',
    })))
    expect(rpc).not.toHaveBeenCalledWith('update_and_publish_announcement', expect.anything())
  })

  it('uses explicit actions for draft, scheduled, and immediate publishing', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(announcementQueryResult([]))
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '新增公告' }))
    expect(screen.getByRole('button', { name: '儲存草稿' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '儲存公告' })).toBeNull()

    await user.click(screen.getByRole('radio', { name: /排程發布/ }))
    expect(screen.getByLabelText('發布時間')).toBeTruthy()
    expect(screen.getByRole('button', { name: '確認排程發布' })).toBeTruthy()
  })

  it('lets the host return to editing from the immediate publish confirmation', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(announcementQueryResult([]))
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '新增公告' }))
    await user.type(screen.getByLabelText(/公告標題/), '需要確認')
    await user.type(screen.getByRole('textbox', { name: '公告內容（支援 Markdown）' }), '公告內容')
    await user.click(screen.getByRole('radio', { name: /立即發布/ }))
    await user.click(screen.getByRole('button', { name: '確認並立即發布' }))

    expect(screen.getByRole('dialog', { name: '確定要立即發布這則公告嗎？' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '返回編輯' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText(/公告標題/)).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('restores focus to the announcement card trigger when the editor is also open', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(draftQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '編輯' }))
    const publishButton = screen.getByRole('button', { name: '立即發布' })
    await user.click(publishButton)
    await user.click(screen.getByRole('button', { name: '返回編輯' }))

    expect(document.activeElement).toBe(publishButton)
  })

  it('clears the edit state when starting a new announcement during editing', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(draftQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    await user.click(await screen.findByRole('button', { name: '編輯' }))
    const titleInput = screen.getByLabelText(/公告標題/) as HTMLInputElement
    expect(titleInput.value).toBe('場地變更')

    await user.click(screen.getByRole('button', { name: '新增公告' }))
    expect((screen.getByLabelText(/公告標題/) as HTMLInputElement).value).toBe('')

    await user.type(screen.getByLabelText(/公告標題/), '新公告')
    await user.type(screen.getByRole('textbox', { name: '公告內容（支援 Markdown）' }), '全新內容')
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_event_announcement', expect.objectContaining({
      p_title: '新公告',
      p_publish_now: false,
    })))
    expect(rpc).not.toHaveBeenCalledWith('update_event_announcement', expect.anything())
  })

  it('shows a load error instead of an empty history when the query fails', async () => {
    from.mockReturnValue(failedQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration isAuthenticated />)

    expect(await screen.findByText('公告載入失敗，請稍後再試。')).toBeTruthy()
    expect(screen.queryByText('目前沒有公告。')).toBeNull()
    expect(screen.queryByRole('button', { name: '新增公告' })).toBeNull()
  })

  it('hides the whole section for a logged-out visitor and does not attempt to load', async () => {
    const { container } = render(
      <EventAnnouncements eventId="event-1" isHost={false} nativeRegistration isAuthenticated={false} />,
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('heading', { name: '活動公告' })).toBeNull()
    expect(screen.queryByText('公告載入失敗，請稍後再試。')).toBeNull()
    expect(container.firstChild).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('offers a retry action on load failure and reloads successfully', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(failedQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost={false} nativeRegistration isAuthenticated />)

    expect(await screen.findByText('公告載入失敗，請稍後再試。')).toBeTruthy()
    const retry = screen.getByRole('button', { name: '重試' })

    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [publishedAnnouncement], error: null }),
          }),
        }),
      }),
    })
    await user.click(retry)

    expect(await screen.findByRole('heading', { name: '場地變更' })).toBeTruthy()
    expect(screen.queryByText('公告載入失敗，請稍後再試。')).toBeNull()
  })

  it('disables the retry button while a reload is in flight', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(failedQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost={false} nativeRegistration isAuthenticated />)
    expect(await screen.findByText('公告載入失敗，請稍後再試。')).toBeTruthy()

    const pending = new Promise<never>(() => {})
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(pending),
          }),
        }),
      }),
    })
    await user.click(screen.getByRole('button', { name: '重試' }))
    expect((screen.getByRole('button', { name: '載入中...' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

function draftQueryResult() {
  return announcementQueryResult([{ ...publishedAnnouncement, status: 'draft', published_at: null }])
}

function announcementQueryResult(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  }
}

function failedQueryResult() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'network error' } }),
        }),
      }),
    }),
  }
}
