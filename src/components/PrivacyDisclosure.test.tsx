import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PrivacyDisclosure } from './PrivacyDisclosure'

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children: ReactNode; to: string; onClick?: () => void }) => <a href={props.to} onClick={props.onClick}>{children}</a>,
}))

describe('PrivacyDisclosure', () => {
  it('opens from click and keyboard focus without exposing user-specific content', async () => {
    const user = userEvent.setup()
    render(<PrivacyDisclosure label="View privacy details" description="Only participants can read this content." learnMore="Open Security & Privacy Center" />)
    const trigger = screen.getByRole('button', { name: 'View privacy details' })

    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('status').textContent).toContain('Only participants can read this content.')
    expect(screen.getByRole('link', { name: 'Open Security & Privacy Center' }).getAttribute('href')).toBe('/settings/security-privacy')

    fireEvent.click(trigger)
    expect(screen.queryByRole('status')).toBeNull()
    trigger.focus()
    await user.keyboard('{SPACE}')
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
