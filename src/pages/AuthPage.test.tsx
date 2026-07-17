import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

const mockUseAuth = vi.fn()
const signInWithPassword = vi.fn()
const signUp = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signUp: (...args: unknown[]) => signUp(...args),
    },
  },
}))

describe('AuthPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null })
    signInWithPassword.mockResolvedValue({ error: null })
    signUp.mockResolvedValue({ error: null })
  })

  it('renders sign-in and shows validation error on empty submit', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Email and password are required.')).toBeTruthy()
  })

  it('renders sign-up and shows validation error on empty submit', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Need an account? Sign Up' }))
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Email and password are required.')).toBeTruthy()
  })
})
