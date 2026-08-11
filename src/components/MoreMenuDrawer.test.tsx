import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MoreMenuDrawer } from './MoreMenuDrawer'

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, onClick, ...props }: { children: ReactNode; to: string; onClick?: () => void }) => (
    <a href={to} onClick={onClick} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'zh-TW', setLocale: vi.fn() }),
}))

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => ({
      'nav.more': 'More',
      'common.close': 'Close',
      'common.language': 'Language',
      'nav.activityGroup': 'Activity',
      'nav.notificationsGroup': 'Notifications',
      'nav.notifications': 'Notifications',
      'nav.accountGroup': 'Account',
      'nav.supportGroup': 'Support',
      'nav.messages': 'Messages',
      'nav.following': 'Following',
      'nav.myRegistrations': 'My registrations',
      'nav.bookmarks': 'Bookmarks',
      'nav.analytics': 'Analytics',
      'nav.notificationSettings': 'Notification settings',
      'nav.securityPrivacy': 'Security & Privacy',
      'nav.myIssues': 'My issues',
      'nav.myReports': 'My reports',
      'nav.signOut': 'Sign out',
    }[key] ?? key),
  }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: { auth: { signOut } },
}))

vi.mock('./Icon', () => ({ Icon: () => null }))

describe('MoreMenuDrawer accessibility', () => {
  beforeEach(() => {
    signOut.mockClear()
  })

  it('moves focus into the dialog, traps its Tab boundary, and restores focus on close', async () => {
    const opener = document.createElement('button')
    opener.type = 'button'
    opener.textContent = 'Open more'
    document.body.appendChild(opener)
    opener.focus()

    const onClose = vi.fn()
    const view = render(<MoreMenuDrawer open onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'More' })
    const close = screen.getByRole('button', { name: 'Close' })
    const signOutButton = screen.getByRole('button', { name: 'Sign out' })

    expect(dialog).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(close))
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(signOutButton)
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    view.rerender(<MoreMenuDrawer open={false} onClose={onClose} />)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('keeps the dialog name and closes through the explicit close control', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<MoreMenuDrawer open onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: 'More' }).getAttribute('aria-modal')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exposes the notification list separately from notification settings', () => {
    render(<MoreMenuDrawer open onClose={vi.fn()} />)

    expect(screen.getByRole('link', { name: 'Notifications' }).getAttribute('href')).toBe('/notifications')
    expect(screen.getByRole('link', { name: 'Notification settings' }).getAttribute('href')).toBe('/settings/notifications')
  })
})
