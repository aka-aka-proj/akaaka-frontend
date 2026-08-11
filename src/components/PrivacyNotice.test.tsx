import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PrivacyNotice } from './PrivacyNotice'

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: () => {} }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children: ReactNode; to: string; onClick?: () => void }) => <a href={props.to} onClick={props.onClick}>{children}</a>,
}))

describe('PrivacyNotice', () => {
  it('opens with click and keyboard activation without exposing private data', async () => {
    const user = userEvent.setup()
    render(<PrivacyNotice />)
    const trigger = screen.getByRole('button', { name: 'View privacy commitment' })

    expect(screen.queryByRole('status')).toBeNull()
    expect(trigger.className).toContain('privacy-notice__trigger')
    expect(trigger.querySelector('svg')).toBeTruthy()
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    await user.click(trigger)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Security & Privacy Center' }).getAttribute('href')).toBe('/settings/security-privacy')

    trigger.focus()
    await user.keyboard(' ')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('opens on keyboard focus and closes with Escape', async () => {
    const user = userEvent.setup()
    render(<PrivacyNotice />)
    const trigger = screen.getByRole('button', { name: 'View privacy commitment' })

    await user.tab()
    expect(screen.getByRole('status')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('status')).toBeNull()
    expect(trigger.getAttribute('aria-controls')).toBeTruthy()
  })
})
