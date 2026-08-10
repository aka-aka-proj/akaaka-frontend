import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateEventPage } from './CreateEventPage'

const mockUseAuth = vi.fn()
const from = vi.fn()
const insert = vi.fn()
const select = vi.fn()
const single = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}))

describe('CreateEventPage', () => {
  beforeEach(() => {
    single.mockResolvedValue({ data: { id: 'event-1' }, error: null })
    select.mockReturnValue({ single })
    insert.mockReturnValue({ select })
    from.mockImplementation((table: string) => {
      if (table === 'events') {
        return { insert }
      }
      if (table === 'notifications') {
        const query = {
          select: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ count: 0 }),
        }
        return query
      }
      return {}
    })
  })

  it('creates non-venue-hosted event for general user', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('標題'), 'My Event')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'My Event',
        lifecycle_status: 'draft',
        is_venue_hosted: false,
        location_region: 'North',
      }),
    ])
  })

  it('creates venue-hosted event for venue approved user', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'venue_approved' },
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('標題'), 'Approved Event')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByLabelText('場地主辦'))
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Approved Event',
        lifecycle_status: 'draft',
        is_venue_hosted: true,
        location_region: 'North',
      }),
    ])
  })

  it('organizes a rough idea into editable fields without publishing', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('活動發想'), '週末桌遊聚會\n台北北部一起認識新朋友')
    await user.click(screen.getByRole('button', { name: 'AI 整理' }))

    expect((screen.getByLabelText('標題') as HTMLInputElement).value).toBe('週末桌遊聚會')
    expect((screen.getByLabelText('活動地區') as HTMLSelectElement).value).toBe('North')
    expect(screen.getByRole('button', { name: '儲存草稿' })).toBeTruthy()
  })

  it('builds a typed questionnaire field without browser prompts', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: '新增欄位' }), 'radio')
    await user.type(screen.getByLabelText('欄位標題'), '飲食習慣')
    await user.type(screen.getByLabelText('選項 1'), '葷食')
    await user.click(screen.getByRole('button', { name: '+ 新增選項' }))
    await user.type(screen.getByLabelText('選項 2'), '素食')
    await user.click(screen.getByLabelText('必填'))

    await user.type(screen.getByLabelText('標題'), '問卷活動')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        registration_form_config: [expect.objectContaining({
          type: 'radio',
          label: '飲食習慣',
          required: true,
          options: ['葷食', '素食'],
        })],
      }),
    ])
  })
})
