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

    await user.click(screen.getByRole('button', { name: '提交檢舉' }))
    expect(screen.getByText('類別和詳細說明為必填。')).toBeTruthy()
  })

  it('shows success on submit', async () => {
    const user = userEvent.setup()
    render(<ReportForm targetProfileId="target-user" />)

    await user.selectOptions(screen.getByLabelText('類別'), 'spam')
    await user.type(screen.getByLabelText('詳細說明'), 'Spam account details')
    await user.click(screen.getByRole('button', { name: '提交檢舉' }))

    expect(insert).toHaveBeenCalled()
    expect(screen.getByText('檢舉已成功提交。')).toBeTruthy()
  })
})
