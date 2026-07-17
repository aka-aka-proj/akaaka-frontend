import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  },
}))

describe('OnboardingPage', () => {
  beforeEach(() => {
    upsert.mockResolvedValue({ error: null })
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

  it('allows completion without any social links', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText('Agree to safety compact'))
    await user.click(screen.getByRole('button', { name: 'Complete onboarding' }))

    expect(upsert).toHaveBeenCalled()
  })

  it('accepts completion with at least one social link', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText('Agree to safety compact'))
    await user.type(screen.getByLabelText('Social url 1'), 'https://instagram.com/user')
    await user.click(screen.getByRole('button', { name: 'Complete onboarding' }))

    expect(upsert).toHaveBeenCalled()
  })
})
