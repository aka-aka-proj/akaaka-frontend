import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingPage } from './OnboardingPage'

const mockUseAuth = vi.fn()
const upsert = vi.fn()
const from = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
  },
}))

describe('OnboardingPage', () => {
  const origShowModal = HTMLDialogElement.prototype.showModal
  const origClose = HTMLDialogElement.prototype.close

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    } as any
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    } as any

    upsert.mockReset()
    upsert.mockResolvedValue({ error: null })
    from.mockReset()
    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { upsert }
      }
      return {}
    })
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      refreshProfile: vi.fn().mockResolvedValue(undefined),
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

    expect(upsert).toHaveBeenCalled()
  })

  it('accepts completion with at least one social link', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '我同意' }))
    await user.click(screen.getByRole('button', { name: '新增社群連結' }))
    await user.type(screen.getByLabelText('社群網址 1'), 'https://instagram.com/user')
    await user.click(screen.getByRole('button', { name: '完成導覽' }))

    expect(upsert).toHaveBeenCalled()
  })

  it('does not submit when disagreeing with safety compact', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '不同意，離開' }))

    expect(upsert).not.toHaveBeenCalled()
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
