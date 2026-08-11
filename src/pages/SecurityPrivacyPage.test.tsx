import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SecurityPrivacyPage } from './SecurityPrivacyPage'

const mockUseAuth = vi.fn()
const listFactors = vi.fn()
const getAuthenticatorAssuranceLevel = vi.fn()
const enroll = vi.fn()
const challenge = vi.fn()
const verify = vi.fn()
const unenroll = vi.fn()
const auditLimit = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: (...args: unknown[]) => listFactors(...args),
        getAuthenticatorAssuranceLevel: (...args: unknown[]) => getAuthenticatorAssuranceLevel(...args),
        enroll: (...args: unknown[]) => enroll(...args),
        challenge: (...args: unknown[]) => challenge(...args),
        verify: (...args: unknown[]) => verify(...args),
        unenroll: (...args: unknown[]) => unenroll(...args),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: (...args: unknown[]) => auditLimit(...args) }),
        }),
      }),
    }),
  },
}))

describe('SecurityPrivacyPage MFA', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    listFactors.mockReset()
    listFactors
      .mockResolvedValueOnce({ data: { all: [] }, error: null })
      .mockResolvedValue({ data: { all: [{ id: 'factor-1', status: 'verified', factor_type: 'totp' }] }, error: null })
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null })
    enroll.mockResolvedValue({
      data: { id: 'factor-1', totp: { qr_code: 'data:image/png;base64,qr', secret: 'secret' } },
      error: null,
    })
    challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    verify.mockResolvedValue({ error: null })
    unenroll.mockResolvedValue({ error: null })
    auditLimit.mockResolvedValue({ data: [], error: null })
  })

  it('completes TOTP enrollment through challenge and verification', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><SecurityPrivacyPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '設定驗證器' }))
    expect(screen.getByRole('img', { name: 'TOTP 驗證器設定 QR code' })).toBeTruthy()

    await user.type(screen.getByLabelText('一次性驗證碼'), '123456')
    await user.click(screen.getByRole('button', { name: '驗證並啟用' }))

    await waitFor(() => expect(verify).toHaveBeenCalledWith({
      factorId: 'factor-1',
      challengeId: 'challenge-1',
      code: '123456',
    }))
    expect(enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'AkaAka Authenticator' })
    expect(challenge).toHaveBeenCalledWith({ factorId: 'factor-1' })
    expect(screen.getByText('雙重驗證已啟用。')).toBeTruthy()
  })
})
