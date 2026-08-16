import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}))

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'zh-TW', setLocale: vi.fn() }),
}))

vi.mock('../hooks/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: () => 0,
}))

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => ({
      'nav.notifications': 'Notifications',
      'nav.events': 'Events',
      'virtualLover.title': 'Virtual Lover',
      'nav.myProfile': 'My profile',
      'nav.more': 'More',
      'nav.activityGroup': 'Activity',
      'nav.notificationsGroup': 'Notifications',
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
      'nav.techSupportEmail': 'Technical support: akaaka.events@gmail.com',
      'nav.techSupportX': 'Follow @AkaAkaEvents on X',
      'nav.signOut': 'Sign out',
      'common.language': 'Language',
    }[key] ?? key),
  }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

vi.mock('./Icon', () => ({ Icon: () => null }))
vi.mock('./PrivacyNotice', () => ({ PrivacyNotice: () => null }))
vi.mock('./MoreMenuDrawer', () => ({ MoreMenuDrawer: () => null }))

describe('Layout desktop More menu accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('focuses the first menu item and returns focus after Escape', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/events']}>
        <Layout><p>Content</p></Layout>
      </MemoryRouter>,
    )

    const moreButton = screen.getAllByRole('button', { name: 'More' })[0]
    await user.click(moreButton)
    const menu = screen.getByRole('menu')
    const firstItem = screen.getByRole('menuitem', { name: 'Messages' })
    expect(screen.getByRole('menuitem', { name: 'Notifications' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Notification settings' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(firstItem))
    expect(moreButton.getAttribute('aria-expanded')).toBe('true')
    expect(moreButton.getAttribute('aria-controls')).toBe('desktop-more-menu')
    expect(menu).toBeTruthy()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(moreButton.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(moreButton)
  })

  it('shows the notification icon entry with a visible label', () => {
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Layout><p>Content</p></Layout>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Notifications' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Notifications' }).textContent).toContain('Notifications')
  })

  it('shows technical support contacts in the desktop support menu', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/events']}>
        <Layout><p>Content</p></Layout>
      </MemoryRouter>,
    )

    await user.click(screen.getAllByRole('button', { name: 'More' })[0])
    expect(screen.getByRole('menuitem', { name: 'Technical support: akaaka.events@gmail.com' }).getAttribute('href')).toBe('mailto:akaaka.events@gmail.com')
    const xLink = screen.getByRole('menuitem', { name: 'Follow @AkaAkaEvents on X' })
    expect(xLink.getAttribute('href')).toBe('https://x.com/AkaAkaEvents')
    expect(xLink.getAttribute('target')).toBe('_blank')
    expect(xLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('can hide the global back button when a page owns its own navigation', () => {
    render(
      <MemoryRouter initialEntries={['/messages/conversation-1']}>
        <Layout showPageBack={false}><p>Content</p></Layout>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: /back/i })).toBeNull()
  })
})
