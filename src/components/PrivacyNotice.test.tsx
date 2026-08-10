import { fireEvent, render, screen } from '@testing-library/react'
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
    fireEvent.click(trigger)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Security & Privacy Center' }).getAttribute('href')).toBe('/settings/security-privacy')

    trigger.focus()
    await user.keyboard(' ')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
