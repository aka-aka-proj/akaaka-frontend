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
    render(<EventAnnouncements eventId="event-1" isHost={false} nativeRegistration />)

    expect(await screen.findByRole('heading', { name: '場地變更' })).toBeTruthy()
    expect(screen.getByText('請從後門入場。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '新增公告' })).toBeNull()
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
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration />)

    await user.click(await screen.findByRole('button', { name: '立即發布' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('publish_event_announcement', {
      p_announcement_id: 'announcement-1',
    }))
  })

  it('publishes an existing announcement after saving with the publish-now mode while editing', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(draftQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration />)

    await user.click(await screen.findByRole('button', { name: '編輯' }))
    await user.selectOptions(screen.getByLabelText('發布方式'), 'now')
    await user.click(screen.getByRole('button', { name: '儲存變更' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('update_event_announcement', expect.objectContaining({
      p_announcement_id: 'announcement-1',
      p_status: 'draft',
    })))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('publish_event_announcement', {
      p_announcement_id: 'announcement-1',
    }))
  })

  it('clears the edit state when starting a new announcement during editing', async () => {
    const user = userEvent.setup()
    from.mockReturnValue(draftQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration />)

    await user.click(await screen.findByRole('button', { name: '編輯' }))
    const titleInput = screen.getByLabelText(/公告標題/) as HTMLInputElement
    expect(titleInput.value).toBe('場地變更')

    await user.click(screen.getByRole('button', { name: '新增公告' }))
    expect((screen.getByLabelText(/公告標題/) as HTMLInputElement).value).toBe('')

    await user.type(screen.getByLabelText(/公告標題/), '新公告')
    await user.type(screen.getByRole('textbox', { name: '公告內容（支援 Markdown）' }), '全新內容')
    await user.click(screen.getByRole('button', { name: '儲存公告' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_event_announcement', expect.objectContaining({
      p_title: '新公告',
      p_publish_now: false,
    })))
    expect(rpc).not.toHaveBeenCalledWith('update_event_announcement', expect.anything())
  })

  it('shows a load error instead of an empty history when the query fails', async () => {
    from.mockReturnValue(failedQueryResult())
    render(<EventAnnouncements eventId="event-1" isHost nativeRegistration />)

    expect(await screen.findByText('公告載入失敗，請稍後再試。')).toBeTruthy()
    expect(screen.queryByText('目前沒有公告。')).toBeNull()
    expect(screen.queryByRole('button', { name: '新增公告' })).toBeNull()
  })
})

function draftQueryResult() {
  return {
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
