import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportForm } from './ReportForm'

const mockUseAuth = vi.fn()
const from = vi.fn()
const insert = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}))

describe('ReportForm', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    insert.mockResolvedValue({ error: null })
    from.mockReturnValue({ insert })
  })

  it('requires category and details', async () => {
    const user = userEvent.setup()
    render(<ReportForm targetProfileId="target-user" />)

    await user.click(screen.getByRole('button', { name: 'Submit report' }))
    expect(screen.getByText('Category and details are required.')).toBeTruthy()
  })

  it('shows success on submit', async () => {
    const user = userEvent.setup()
    render(<ReportForm targetProfileId="target-user" />)

    await user.selectOptions(screen.getByLabelText('Category'), 'spam')
    await user.type(screen.getByLabelText('Details'), 'Spam account details')
    await user.click(screen.getByRole('button', { name: 'Submit report' }))

    expect(insert).toHaveBeenCalled()
    expect(screen.getByText('Report submitted successfully.')).toBeTruthy()
  })
})
