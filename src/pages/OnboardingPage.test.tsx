import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingPage } from './OnboardingPage'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

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
    refreshProfile.mockResolvedValue(true)
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
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    HTMLDialogElement.prototype.showModal = origShowModal
    HTMLDialogElement.prototype.close = origClose
  })

  function androidMode(standalone = false) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome')
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: standalone && query === '(display-mode: standalone)', addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  }

  it.each(['Android Chrome', 'iPhone Safari', 'Desktop Firefox'])('holds existing-profile navigation on %s until continue', async (ua) => {
    androidMode()
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, profile: { id: 'user-1' }, refreshProfile })
    render(<MemoryRouter initialEntries={['/onboarding?pwa_return=1&from=%2Fevents%2Fmine']}><Routes><Route path="/onboarding" element={<OnboardingPage />} /><Route path="*" element={<div />} /></Routes><LocationProbe /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '登入成功' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('location').textContent).toContain('pwa_return=1')
    await userEvent.setup().click(screen.getByRole('button', { name: '繼續使用此視窗' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/events/mine'))
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns a new user to the safety compact without creating a profile', async () => {
    androidMode()
    render(<MemoryRouter initialEntries={['/onboarding?pwa_return=1&from=%2Fevents%2Fmine']}><Routes><Route path="/onboarding" element={<OnboardingPage />} /><Route path="*" element={<div />} /></Routes><LocationProbe /></MemoryRouter>)
    expect(screen.queryByRole('heading', { name: '登入成功' })).toBeNull()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/onboarding?pwa_return=1&from=%2Fevents%2Fmine')
    expect(insert).not.toHaveBeenCalled()
  })

  it.each([
    '?pwa_return=1&error=access_denied',
    '?pwa_return=1&error_code=oauth_state_mismatch',
    '?pwa_return=1&error_description=PKCE%20verification%20failed',
    '?pwa_return=1#error=access_denied',
  ])('does not show success for a failed callback even with an existing session: %s', (search) => {
    androidMode()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, profile: { id: 'user-1' }, refreshProfile })
    render(<MemoryRouter initialEntries={[`/onboarding${search}`]}><OnboardingPage /></MemoryRouter>)
    expect(screen.queryByRole('heading', { name: '登入成功' })).toBeNull()
  })

  it('skips the handoff when already inside the standalone PWA', () => {
    androidMode(true)
    render(<MemoryRouter initialEntries={['/onboarding?pwa_return=1']}><OnboardingPage /></MemoryRouter>)
    expect(screen.queryByRole('heading', { name: '登入成功' })).toBeNull()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('does not treat the marker as proof of authentication', () => {
    androidMode()
    mockUseAuth.mockReturnValue({ user: null, refreshProfile })
    render(<MemoryRouter initialEntries={['/onboarding?pwa_return=1']}><OnboardingPage /></MemoryRouter>)
    expect(screen.queryByRole('heading', { name: '登入成功' })).toBeNull()
  })

  it.each(['unsupported', 'skip', 'accept'])('keeps new X users at the return panel after %s notification completion', async (mode) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari')
    getWebPushState.mockResolvedValue(mode === 'unsupported' ? 'unsupported' : 'unsubscribed')
    let savedProfile: { id: string } | null = null
    mockUseAuth.mockImplementation(() => ({ user: { id: 'user-1' }, profile: savedProfile, refreshProfile }))
    refreshProfile.mockImplementation(async () => { savedProfile = { id: 'user-1' }; return true })
    const tree = <MemoryRouter initialEntries={['/onboarding?pwa_return=1&from=%2Fevents%2Fmine']}><Routes><Route path="/onboarding" element={<OnboardingPage />} /><Route path="*" element={<div />} /></Routes><LocationProbe /></MemoryRouter>
    const view = render(tree)
    const user = userEvent.setup()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '登入成功' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))
    if (mode !== 'unsupported') {
      expect(screen.queryByRole('heading', { name: '登入成功' })).toBeNull()
      await user.click(screen.getByRole('button', { name: mode === 'skip' ? '稍後到通知設定' : '開啟通知' }))
    }
    await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('location').textContent).toContain('pwa_return=1')
    view.rerender(<MemoryRouter><Routes><Route path="/onboarding" element={<OnboardingPage />} /><Route path="*" element={<div />} /></Routes><LocationProbe /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '登入成功' })).toBeTruthy()
    expect(document.querySelector('a[href^="intent:"]')).toBeNull()
    await user.click(screen.getByRole('button', { name: '繼續使用此視窗' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/events/mine'))
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it.each(['unsupported', 'skip'])('keeps saved onboarding visible during a delayed retry after %s', async (mode) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari')
    getWebPushState.mockResolvedValue(mode === 'unsupported' ? 'unsupported' : 'unsubscribed')
    let completeRetry!: (loaded: boolean) => void
    refreshProfile.mockResolvedValueOnce(false).mockImplementationOnce(() => new Promise<boolean>(resolve => { completeRetry = resolve }))
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/onboarding?pwa_return=1&from=%2Fevents%2Fmine']}><OnboardingPage /><LocationProbe /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))
    if (mode === 'skip') await user.click(screen.getByRole('button', { name: '稍後到通知設定' }))
    expect(await screen.findByRole('heading', { name: '個人資料已儲存' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toContain('/onboarding')
    expect(insert).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: '重新載入個人資料' }))
    await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('heading', { name: '個人資料已儲存' })).toBeTruthy()
    const retry = screen.getByRole('button', { name: '載入中...' })
    expect(retry.hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('button', { name: '稍後到通知設定' })).toBeNull()
    await user.click(retry)
    expect(refreshProfile).toHaveBeenCalledTimes(2)
    await act(async () => completeRetry(false))
    expect(screen.getByRole('button', { name: '重新載入個人資料' }).hasAttribute('disabled')).toBe(false)
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('shows progress while the notification capability probe is pending', async () => {
    let completeProbe!: (state: string) => void
    getWebPushState.mockImplementationOnce(() => new Promise<string>(resolve => { completeProbe = resolve }))
    const user = userEvent.setup()
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))
    expect(screen.getByRole('status').textContent).toBe('載入中...')
    expect(insert).toHaveBeenCalledTimes(1)
    expect(refreshProfile).not.toHaveBeenCalled()
    await act(async () => completeProbe('unsubscribed'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: '稍後到通知設定' })).toBeTruthy()
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

    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
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

    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
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

    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
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

    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
    const avatar = screen.getByRole('radio', { name: '內建頭像 1' })
    await user.click(avatar)
    await user.click(screen.getByRole('button', { name: '完成導覽' }))

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ avatar_path: expect.stringContaining('/avatar/') }),
      }),
    )
  })

  it('keeps the agreed form available when profile saving fails', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'Profile save failed' } })
    const user = userEvent.setup()
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))
    expect(screen.getByRole('alert').textContent).toBe('Profile save failed')
    expect(screen.getByRole('button', { name: '完成導覽' }).hasAttribute('disabled')).toBe(false)
    expect(refreshProfile).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '完成導覽' }))
    expect(insert).toHaveBeenCalledTimes(2)
  })

  it('does not show social URL inputs during onboarding', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '同意並繼續' }))

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
  it.each(['unsupported', 'skip', 'accept'])('preserves OAuth query source after %s Push completion without navigation state', async (mode) => {
    getWebPushState.mockResolvedValue(mode === 'unsupported' ? 'unsupported' : 'unsubscribed')
    const destination = '/events/mine?type=series&status=published'
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[`/onboarding?from=${encodeURIComponent(destination)}`]}>
      <OnboardingPage /><LocationProbe />
    </MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))
    if (mode !== 'unsupported') await user.click(screen.getByRole('button', { name: mode === 'skip' ? '稍後到通知設定' : '開啟通知' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(destination))
    expect(refreshProfile).toHaveBeenCalledTimes(1)
  })

  it.each([
    { query: '/events/mine?type=series&status=published', state: '/events?category=old', expected: '/events/mine?type=series&status=published' },
    { query: null, state: '/events/mine?type=events&status=draft', expected: '/events/mine?type=events&status=draft' },
    { query: null, state: null, expected: '/events' },
  ])('uses consistent return-source precedence: $expected', async ({ query, state, expected }) => {
    getWebPushState.mockResolvedValue('unsupported')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[{ pathname: '/onboarding', search: query ? `?from=${encodeURIComponent(query)}` : '', state: state ? { from: state } : null }]}>
      <OnboardingPage /><LocationProbe />
    </MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '同意並繼續' }))
    await user.click(screen.getByRole('button', { name: '完成導覽' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(expected))
  })

})
