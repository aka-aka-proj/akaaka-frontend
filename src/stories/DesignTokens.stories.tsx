import type { Meta, StoryObj } from '@storybook/react-vite'

function DesignTokenShowcase() {
  return (
    <section style={{ display: 'grid', gap: 'var(--space-4)', maxWidth: 720, padding: 'var(--space-5)', background: 'var(--color-surface-muted)', color: 'var(--color-text)' }}>
      <div>
        <p style={{ color: 'var(--color-text-muted)' }}>AkaAka shared design tokens</p>
        <h1 style={{ color: 'var(--color-text-strong)' }}>States and semantic colors</h1>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <button type="button">Primary action</button>
        <button type="button" disabled>Disabled</button>
        <button type="button" aria-busy="true">Loading…</button>
        <button type="button" style={{ color: 'var(--color-danger)' }}>Danger action</button>
      </div>
      <p role="status" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', background: 'var(--color-surface)' }}>
        Success and error feedback keep text semantics; color is not the only signal.
      </p>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Focus a control to review the shared focus ring. Interactive controls use the 44px touch target baseline.</p>
    </section>
  )
}

const meta = {
  title: 'AkaAka/Design Tokens',
  component: DesignTokenShowcase,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DesignTokenShowcase>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
