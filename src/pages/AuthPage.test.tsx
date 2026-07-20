import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

const mockUseAuth = vi.fn()
const signInWithPassword = vi.fn()
const signUp = vi.fn()
const resend = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signUp: (...args: unknown[]) => signUp(...args),
      resend: (...args: unknown[]) => resend(...args),
    },
  },
}))

describe('AuthPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null })
    signInWithPassword.mockResolvedValue({ error: null })
    signUp.mockResolvedValue({ error: null })
    resend.mockResolvedValue({ error: null })
    vi.useRealTimers()
  })

  it('renders sign-in and shows validation error on empty submit', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '登入' }))
    expect(screen.getByText('請輸入電子郵件和密碼。')).toBeTruthy()
  })

  it('renders sign-up and shows validation error on empty submit', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '需要帳號？註冊' }))
    await user.click(screen.getByRole('button', { name: '建立帳號' }))

    expect(screen.getByText('請輸入電子郵件和密碼。')).toBeTruthy()
  })

  it('shows verification prompt after successful sign-up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '需要帳號？註冊' }))
    await user.type(screen.getByLabelText('電子郵件'), 'test@example.com')
    await user.type(screen.getByLabelText('密碼'), 'password123')
    await user.click(screen.getByRole('button', { name: '建立帳號' }))

    expect(screen.getByText('驗證信已發送至您的電子郵件，請點擊信中連結完成驗證。')).toBeTruthy()
    expect(screen.getByText('test@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: /重新發送/ })).toBeTruthy()
  })

  it('disables resend button during cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '需要帳號？註冊' }))
    await user.type(screen.getByLabelText('電子郵件'), 'test@example.com')
    await user.type(screen.getByLabelText('密碼'), 'password123')
    await user.click(screen.getByRole('button', { name: '建立帳號' }))

    const resendButton = screen.getByRole('button', { name: /重新發送/ })
    expect(resendButton).toHaveProperty('disabled', true)

    act(() => { vi.advanceTimersByTime(60000) })
    expect(screen.getByRole('button', { name: '重新發送驗證信' })).toHaveProperty('disabled', false)
  })

  it('calls resend API when resend button is clicked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '需要帳號？註冊' }))
    await user.type(screen.getByLabelText('電子郵件'), 'test@example.com')
    await user.type(screen.getByLabelText('密碼'), 'password123')
    await user.click(screen.getByRole('button', { name: '建立帳號' }))

    act(() => { vi.advanceTimersByTime(60000) })
    await user.click(screen.getByRole('button', { name: '重新發送驗證信' }))

    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'test@example.com' })
  })

  it('shows email not confirmed message when signIn returns invalid_login_credentials and resend succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid_login_credentials' } })
    resend.mockResolvedValue({ error: null })

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('電子郵件'), 'test@example.com')
    await user.type(screen.getByLabelText('密碼'), 'password123')
    await user.click(screen.getByRole('button', { name: '登入' }))

    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'test@example.com' })
    expect(screen.getByText('您的電子郵件尚未驗證，驗證信已重新發送，請至信箱點擊確認連結後再登入。')).toBeTruthy()
  })

  it('shows generic error when signIn returns invalid_login_credentials and resend also fails', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid_login_credentials' } })
    resend.mockResolvedValue({ error: { message: 'User not found' } })

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('電子郵件'), 'unknown@example.com')
    await user.type(screen.getByLabelText('密碼'), 'password123')
    await user.click(screen.getByRole('button', { name: '登入' }))

    expect(screen.getByText('電子郵件或密碼不正確')).toBeTruthy()
  })
})
