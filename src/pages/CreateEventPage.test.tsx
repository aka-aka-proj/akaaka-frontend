import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateEventPage } from './CreateEventPage'

const mockUseAuth = vi.fn()
const from = vi.fn()
const insert = vi.fn()
const select = vi.fn()
const single = vi.fn()
const update = vi.fn()
const eq = vi.fn()
const inFn = vi.fn()
const functionsInvoke = vi.fn()
const rpc = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

describe('CreateEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    functionsInvoke.mockResolvedValue({ data: null, error: null })
    rpc.mockResolvedValue({ data: null, error: null })
    single.mockResolvedValue({ data: { id: 'event-1' }, error: null })
    select.mockReturnValue({ single })
    insert.mockReturnValue({ select })
    eq.mockResolvedValue({ error: null })
    inFn.mockResolvedValue({ error: null })
    update.mockReturnValue({ eq, in: inFn })
    from.mockImplementation((table: string) => {
      if (table === 'events') {
        return { insert, update }
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

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'My Event')
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

  it('shows series deadline modes only for recurring events', async () => {
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

    expect(screen.queryByRole('group', { name: '系列場次的報名截止方式' })).toBeNull()
    await user.click(screen.getByRole('checkbox', { name: '設定重複舉辦' }))

    expect(screen.getByRole('group', { name: '系列場次的報名截止方式' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /每場開始前固定時間/ })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /所有場次使用同一固定時間/ })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '不設定報名截止' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: /不變更/ })).toBeNull()
  })

  it('creates a recurring series with one fixed deadline for all occurrences', async () => {
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

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Fixed Deadline Series')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('checkbox', { name: '設定重複舉辦' }))
    await user.click(screen.getByRole('radio', { name: /所有場次使用同一固定時間/ }))
    const deadlineInput = screen.getByRole('group', { name: '系列場次的報名截止方式' }).querySelector('input[type="datetime-local"]') as HTMLInputElement
    fireEvent.change(deadlineInput, { target: { value: '2026-07-16T12:00' } })
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    const [payload] = insert.mock.calls[0][0] as [{
      registration_deadline: string
      recurrence_rule: Record<string, unknown>
    }]

    expect(new Date(payload.registration_deadline).toISOString()).toBe(
      new Date('2026-07-16T12:00').toISOString(),
    )
    expect(payload.recurrence_rule).not.toHaveProperty('registration_deadline_offset_minutes')
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

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Approved Event')
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

    await user.click(screen.getByRole('button', { name: '使用 AI／來源工具' }))
    await user.type(screen.getByLabelText('活動發想'), '週末桌遊聚會\n台北北部一起認識新朋友')
    await user.click(screen.getByRole('button', { name: 'AI 整理' }))

    expect((screen.getAllByRole('textbox', { name: '標題' })[0] as HTMLInputElement).value).toBe('週末桌遊聚會')
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

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], '問卷活動')
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

  it('creates an event with a Google Form as external registration', async () => {
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

    await user.click(screen.getByRole('radio', { name: /外部報名/ }))
    fireEvent.change(screen.getByLabelText('外部報名網址（選填）'), { target: { value: 'https://docs.google.com/forms/d/e/1FAIpQLSdSNh1EbK-smx53wUFvxCgX7odDvoJXw4Q87Iiu7PueQwofVg/viewform' } })
    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Google Form 活動')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        external_registration_url: 'https://docs.google.com/forms/d/e/1FAIpQLSdSNh1EbK-smx53wUFvxCgX7odDvoJXw4Q87Iiu7PueQwofVg/viewform',
        registration_form_config: null,
        max_capacity: null,
      }),
    ])
  })

  it('previews a BDSM calendar URL and applies editable metadata', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke.mockResolvedValue({
      data: {
        source_url: 'https://todo.smertw.com/events/6382',
        provider: 'todo.smertw.com',
        preview: { title: '來源活動', description: '來源描述' },
      },
      error: null,
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '使用 AI／來源工具' }))
    await user.type(screen.getByLabelText('公開活動來源網址'), 'https://todo.smertw.com/events/6382')
    await user.click(screen.getByRole('button', { name: '預覽來源' }))

    expect(functionsInvoke).toHaveBeenCalledWith('import-event-source', { body: { source_url: 'https://todo.smertw.com/events/6382' } })
    expect((screen.getAllByRole('textbox', { name: '標題' })[0] as HTMLInputElement).value).toBe('來源活動')
    expect(screen.getByRole('textbox', { name: '描述' }).textContent?.trim()).toBe('來源描述')
    expect(screen.getByRole('status').textContent).toContain('todo.smertw.com')
  })

  it('imports a Google Form as an external registration source', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke.mockResolvedValue({
      data: {
        source_url: 'https://docs.google.com/forms/d/e/example/viewform',
        provider: 'docs.google.com',
        preview: { title: 'Google 表單活動', description: '請填寫報名表單' },
      },
      error: null,
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '使用 AI／來源工具' }))
    await user.type(screen.getByLabelText('公開活動來源網址'), 'https://docs.google.com/forms/d/e/example/viewform')
    await user.click(screen.getByRole('button', { name: '預覽來源' }))

    expect((screen.getByLabelText('外部報名網址（選填）') as HTMLInputElement).value).toBe('https://docs.google.com/forms/d/e/example/viewform')
    expect((screen.getByRole('radio', { name: /外部報名/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('disables save-and-publish until imported content is saved as a draft', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke.mockResolvedValue({
      data: {
        source_url: 'https://todo.smertw.com/events/6382',
        provider: 'todo.smertw.com',
        preview: { title: '來源活動', description: '來源描述' },
      },
      error: null,
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    const publishButton = () => screen.getByRole('button', { name: '儲存並發布' }) as HTMLButtonElement
    expect(publishButton().disabled).toBe(false)

    await user.click(screen.getByRole('button', { name: '使用 AI／來源工具' }))
    await user.type(screen.getByLabelText('公開活動來源網址'), 'https://todo.smertw.com/events/6382')
    await user.click(screen.getByRole('button', { name: '預覽來源' }))

    await waitFor(() => expect((screen.getAllByRole('textbox', { name: '標題' })[0] as HTMLInputElement).value).toBe('來源活動'))
    expect(publishButton().disabled).toBe(true)
    expect(screen.getByText('外部來源匯入的內容需先儲存為草稿檢查後才能發布。')).toBeTruthy()
  })

  it('disables save-and-publish while an external-source import is still in flight', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke.mockImplementation(() => new Promise<void>(() => {}))
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    const publishButton = () => screen.getByRole('button', { name: '儲存並發布' }) as HTMLButtonElement
    expect(publishButton().disabled).toBe(false)

    await user.click(screen.getByRole('button', { name: '使用 AI／來源工具' }))
    await user.type(screen.getByLabelText('公開活動來源網址'), 'https://todo.smertw.com/events/6382')
    await user.click(screen.getByRole('button', { name: '預覽來源' }))

    expect(functionsInvoke).toHaveBeenCalledWith('import-event-source', { body: { source_url: 'https://todo.smertw.com/events/6382' } })
    expect((screen.getByRole('button', { name: '讀取來源中…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(publishButton().disabled).toBe(true)
  })

  it('syncs edited content to persisted recurring instances on retry', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke.mockResolvedValue({
      data: { success: true, parent_id: 'event-1', instance_count: 3, created_instance_count: 2, failed_instance_count: 0, instance_ids: ['event-1', 'inst-2', 'inst-3'] },
      error: null,
    })
    rpc.mockImplementation(async (_fn: string, args: Record<string, unknown>) => {
      if (args.p_event_id === 'inst-3') return { data: null, error: { message: 'publication denied' } }
      return { data: null, error: null }
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Original Title')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('radio', { name: '固定金額' }))
    await user.type(screen.getByLabelText('金額（新台幣）'), '500')
    await user.click(screen.getByRole('checkbox', { name: '設定重複舉辦' }))
    await user.click(screen.getByRole('button', { name: '儲存並發布' }))
    await waitFor(() => expect(screen.getByText('有 1 個場次發布失敗；已成功發布的場次不受影響，可稍後從各活動頁重試。')).toBeTruthy())

    const titleInput = screen.getAllByRole('textbox', { name: '標題' })[0] as HTMLInputElement
    await user.clear(titleInput)
    await user.type(titleInput, 'Edited Title')
    const feeAmountInput = screen.getByLabelText('金額（新台幣）') as HTMLInputElement
    await user.clear(feeAmountInput)
    await user.type(feeAmountInput, '300')
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(functionsInvoke).toHaveBeenCalledTimes(1)
    expect(eq).toHaveBeenCalledWith('id', 'event-1')
    expect(inFn).toHaveBeenCalledWith('id', ['inst-2', 'inst-3'])
    const [parentPayload] = update.mock.calls[0]
    expect(parentPayload).toEqual(expect.objectContaining({
      title: 'Edited Title',
      attendance_fee_type: 'fixed',
      attendance_fee_amount: 300,
      start_time: expect.any(String),
      recurrence_rule: expect.objectContaining({ frequency: 'weekly' }),
    }))
    const [childPayload] = update.mock.calls[1]
    expect(childPayload).toEqual(expect.objectContaining({
      title: 'Edited Title',
      attendance_fee_type: 'fixed',
      attendance_fee_amount: 300,
    }))
    expect(Object.keys(childPayload)).not.toContain('start_time')
    expect(Object.keys(childPayload)).not.toContain('recurrence_rule')
  })

  it('blocks retry when the start time of an existing series changed', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke.mockResolvedValue({
      data: { success: true, parent_id: 'event-1', instance_count: 3, created_instance_count: 2, failed_instance_count: 0, instance_ids: ['event-1', 'inst-2', 'inst-3'] },
      error: null,
    })
    rpc.mockImplementation(async (_fn: string, args: Record<string, unknown>) => {
      if (args.p_event_id === 'inst-3') return { data: null, error: { message: 'publication denied' } }
      return { data: null, error: null }
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Original Title')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('checkbox', { name: '設定重複舉辦' }))
    await user.click(screen.getByRole('button', { name: '儲存並發布' }))
    await waitFor(() => expect(screen.getByText('有 1 個場次發布失敗；已成功發布的場次不受影響，可稍後從各活動頁重試。')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('開始時間'), { target: { value: '2026-07-18T12:00' } })
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    await waitFor(() => expect(screen.getByText('週期場次已建立，重試時無法變更開始時間或週期規則；請還原原始排程後再送出。')).toBeTruthy())
    expect(update).not.toHaveBeenCalled()
    expect(functionsInvoke).toHaveBeenCalledTimes(1)
  })

  it('blocks retry when the recurrence rule of an existing series changed', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke.mockResolvedValue({
      data: { success: true, parent_id: 'event-1', instance_count: 3, created_instance_count: 2, failed_instance_count: 0, instance_ids: ['event-1', 'inst-2', 'inst-3'] },
      error: null,
    })
    rpc.mockImplementation(async (_fn: string, args: Record<string, unknown>) => {
      if (args.p_event_id === 'inst-3') return { data: null, error: { message: 'publication denied' } }
      return { data: null, error: null }
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Original Title')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('checkbox', { name: '設定重複舉辦' }))
    await user.click(screen.getByRole('button', { name: '儲存並發布' }))
    await waitFor(() => expect(screen.getByText('有 1 個場次發布失敗；已成功發布的場次不受影響，可稍後從各活動頁重試。')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: '一' }))
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    await waitFor(() => expect(screen.getByText('週期場次已建立，重試時無法變更開始時間或週期規則；請還原原始排程後再送出。')).toBeTruthy())
    expect(update).not.toHaveBeenCalled()
    expect(functionsInvoke).toHaveBeenCalledTimes(1)
  })

  it('surfaces partial instance-creation failures instead of treating them as full success', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke.mockResolvedValue({
      data: { success: false, parent_id: 'event-1', instance_count: 3, created_instance_count: 2, failed_instance_count: 1, instance_ids: ['event-1', 'inst-2'] },
      error: null,
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Partial Title')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('checkbox', { name: '設定重複舉辦' }))
    await user.click(screen.getByRole('button', { name: '儲存並發布' }))

    await waitFor(() =>
      expect(screen.getByText('活動已建立，但已建立 2 個週期場次、1 個建立失敗。')).toBeTruthy(),
    )
    expect(rpc).not.toHaveBeenCalled()
    expect(functionsInvoke).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: '儲存並發布' }))
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(functionsInvoke).toHaveBeenCalledTimes(1)
  })

  it('keeps a zero-created failure retryable so resubmit recreates the series', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke
      .mockResolvedValueOnce({
        data: { success: false, parent_id: 'event-1', instance_count: 3, created_instance_count: 0, failed_instance_count: 2, instance_ids: ['event-1'] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, parent_id: 'event-1', instance_count: 3, created_instance_count: 2, failed_instance_count: 0, instance_ids: ['event-1', 'inst-2', 'inst-3'] },
        error: null,
      })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Zero Created Title')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('checkbox', { name: '設定重複舉辦' }))
    await user.click(screen.getByRole('button', { name: '儲存並發布' }))

    await waitFor(() =>
      expect(screen.getByText('活動已建立，但週期場次建立失敗；請再按一次「儲存並發布」完成場次建立。')).toBeTruthy(),
    )
    expect(rpc).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '儲存並發布' }))
    await waitFor(() => expect(functionsInvoke).toHaveBeenCalledTimes(2))
  })

  it('keeps draft intent on zero-created retry instead of prompting to publish', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role_status: 'general' },
    })
    functionsInvoke
      .mockResolvedValueOnce({
        data: { success: false, parent_id: 'event-1', instance_count: 3, created_instance_count: 0, failed_instance_count: 2, instance_ids: ['event-1'] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, parent_id: 'event-1', instance_count: 3, created_instance_count: 2, failed_instance_count: 0, instance_ids: ['event-1', 'inst-2', 'inst-3'] },
        error: null,
      })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    )

    await user.type(screen.getAllByRole('textbox', { name: '標題' })[0], 'Draft Intent Title')
    await user.type(screen.getByLabelText('開始時間'), '2026-07-17T12:00')
    await user.selectOptions(screen.getByLabelText('活動地區'), 'North')
    await user.click(screen.getByRole('checkbox', { name: '設定重複舉辦' }))
    await user.click(screen.getByRole('button', { name: '儲存草稿' }))

    await waitFor(() =>
      expect(screen.getByText('活動已建立，但週期場次建立失敗；請再按一次「儲存草稿」完成場次建立。')).toBeTruthy(),
    )

    await user.click(screen.getByRole('button', { name: '儲存草稿' }))
    await waitFor(() => expect(functionsInvoke).toHaveBeenCalledTimes(2))
    expect(rpc).not.toHaveBeenCalled()
  })
})
