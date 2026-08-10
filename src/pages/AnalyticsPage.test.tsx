import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsPage } from './AnalyticsPage'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  showError: vi.fn(),
}))
const { invoke, showError } = mocks

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'zh-TW', setLocale: () => {} }),
}))

vi.mock('../context/ErrorContext', () => ({
  useError: () => ({ showError: mocks.showError }),
}))

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../components/ShareToXModal', () => ({
  ShareToXModal: () => null,
}))

vi.mock('../supabaseClient', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

const stats = {
  hostedEvents: 2,
  hostedTags: ['SM'],
  totalRegistrations: 4,
  totalApproved: 3,
  approvalRate: 75,
  waitlistConversions: 0,
  checkedInRegistrations: 3,
  attendanceRate: 100,
  eventsParticipated: 1,
  approvedParticipations: 1,
  reputationGained: 2,
  reportCount: 0,
  exploredTags: ['SM'],
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    invoke.mockReset()
    showError.mockReset()
    invoke.mockResolvedValue({ data: { success: true, stats }, error: null })
  })

  it('shows a 100% attendance ring and enables relevant share actions', async () => {
    render(<AnalyticsPage />)

    expect(await screen.findByText('100%')).toBeTruthy()
    expect((screen.getByRole('button', { name: '分享主辦摘要' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '分享參與摘要' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('reloads stats when the period changes', async () => {
    const user = userEvent.setup()
    render(<AnalyticsPage />)
    await screen.findByText('100%')
    await user.click(screen.getByRole('button', { name: '本週' }))

    await waitFor(() => expect(invoke).toHaveBeenLastCalledWith('get-user-analytics', { body: { user_id: 'user-1', period: 'weekly' } }))
  })

  it('shows empty state and reports load errors', async () => {
    invoke.mockResolvedValue({ data: { success: false }, error: null })
    render(<AnalyticsPage />)
    await waitFor(() => expect(showError).toHaveBeenCalled())
    expect(await screen.findByText('尚無統計資料')).toBeTruthy()
  })
})
