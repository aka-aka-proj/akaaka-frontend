import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingPage } from './OnboardingPage'

const mockUseAuth = vi.fn()
const insert = vi.fn()
const from = vi.fn()
const refreshProfile = vi.fn()
const enableWebPush = vi.fn()
const getWebPushState = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
  },
}))

vi.mock('../lib/web-push', () => ({
  enableWebPush: (...args: unknown[]) => enableWebPush(...args),
  getWebPushState: (...args: unknown[]) => getWebPushState(...args),
}))

describe('OnboardingPage', () => {
  const origShowModal = HTMLDialogElement.prototype.showModal
  const origClose = HTMLDialogElement.prototype.close

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
    }

    insert.mockReset()
    insert.mockResolvedValue({ error: null })
    refreshProfile.mockReset()
    refreshProfile.mockResolvedValue(undefined)
    enableWebPush.mockReset()
    enableWebPush.mockResolvedValue(undefined)
    getWebPushState.mockReset()
    getWebPushState.mockResolvedValue('unsubscribed')
    from.mockReset()
    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
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
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      refreshProfile,
    })
  })

  afterEach(() => {
    HTMLDialogElement.prototype.showModal = origShowModal
    HTMLDialogElement.prototype.close = origClose
  })

  it('shows safety compact modal automatically on mount', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('open')).not.toBeNull()
    expect(screen.queryByRole('button', { name: '完成導覽' })).toBeNull()
  })

  it('allows completion without any social links', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '我同意' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))

    expect(insert).toHaveBeenCalled()
  })

  it('offers Web Push after profile creation and enables it only after acceptance', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '我同意' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))

    expect(screen.getByRole('heading', { name: '要接收 BDSM 圈內揪通知嗎？' })).toBeTruthy()
    expect(enableWebPush).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '開啟通知' }))

    expect(enableWebPush).toHaveBeenCalledWith()
    expect(refreshProfile).toHaveBeenCalled()
  })

  it('allows postponing Web Push until Notification Settings', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '我同意' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))
    await user.click(screen.getByRole('button', { name: '稍後到通知設定' }))

    expect(enableWebPush).not.toHaveBeenCalled()
    expect(refreshProfile).toHaveBeenCalled()
  })

  it('allows selecting a preset avatar and persists it in metadata', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '我同意' }))
    const avatar = screen.getByRole('radio', { name: '內建頭像 1' })
    await user.click(avatar)
    await user.click(screen.getByRole('button', { name: '完成導覽' }))

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ avatar_path: expect.stringContaining('/avatar/') }),
      }),
    )
  })

  it('does not show social URL inputs during onboarding', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '我同意' }))

    expect(screen.queryByLabelText('社群網址 1')).toBeNull()
    expect(screen.getByText(/外部社群連結可稍後/)).toBeTruthy()
  })

  it('does not submit when disagreeing with safety compact', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '不同意，離開' }))

    expect(insert).not.toHaveBeenCalled()
  })

  it('hides form until safety compact is agreed', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: '完成導覽' })).toBeNull()
    expect(screen.queryByLabelText('顯示名稱')).toBeNull()
  })
})
