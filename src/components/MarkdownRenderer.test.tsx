import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownRenderer } from './MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('keeps plain-text email content when links are disallowed', () => {
    const { container } = render(<MarkdownRenderer content="聯絡我：contact@example.com" allowLinks={false} />)

    expect(screen.getByText(/contact@example\.com/)).toBeTruthy()
    expect(container.querySelector('a')).toBeNull()
  })

  it('does not create real HTML elements from raw HTML when links are disallowed', () => {
    const { container } = render(<MarkdownRenderer content={"<script>alert('x')</script>\n\n一般文字"} allowLinks={false} />)

    expect(screen.getByText(/一般文字/)).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders links when allowed', () => {
    render(<MarkdownRenderer content="[AkaAka](https://akaaka.app)" allowLinks />)

    expect(screen.getByRole('link', { name: 'AkaAka' })).toBeTruthy()
  })
})
