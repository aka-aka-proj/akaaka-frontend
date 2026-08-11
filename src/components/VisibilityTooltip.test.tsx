import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VisibilityTooltip } from './VisibilityTooltip'

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => ({
      'visibilityTooltip.rlsProtection': 'Visibility is protected by database policy',
      'visibilityTooltip.connectionsOnlyExplanation': 'Only the selected audience can view this field.',
      'visibilityTooltip.fieldBio': 'Bio visibility follows the selected audience.',
    }[key] ?? key),
  }),
}))

describe('VisibilityTooltip', () => {
  it('opens from a real pointer click without focus/click race and exposes its relationship', async () => {
    const user = userEvent.setup()
    render(<VisibilityTooltip fieldName="bio" />)
    const trigger = screen.getByRole('button', { name: 'Visibility is protected by database policy' })

    await user.click(trigger)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(trigger.getAttribute('aria-controls')).toBeTruthy()
    await user.click(trigger)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('opens on keyboard focus and closes with Escape', async () => {
    const user = userEvent.setup()
    render(<VisibilityTooltip fieldName="gender_identity" />)

    await user.tab()
    expect(screen.getByRole('status')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
