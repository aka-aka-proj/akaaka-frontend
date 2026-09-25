import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { BlocklistPage } from './BlocklistPage'

const from = vi.fn()
vi.mock('../supabaseClient', () => ({ supabase: { from: (...args: unknown[]) => from(...args) } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
vi.mock('../context/LanguageContext', () => ({ useLanguage: () => ({ locale: 'en' }) }))
vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
beforeEach(() => { from.mockReset() })

it('loads owner blocks, can reach later pages, and removes only the selected outgoing block', async () => {
  const eq = vi.fn().mockReturnThis(), range = vi.fn()
  let deleted = false
  range.mockImplementation((start: number) => Promise.resolve({ data: deleted ? [] : start === 0
    ? Array.from({ length: 21 }, (_, i) => ({ blocked_id: `person-${i}`, created_at: '2026-09-01T00:00:00Z' }))
    : [{ blocked_id: 'person-last', created_at: '2026-08-01T00:00:00Z' }], error: null }))
  const removeEq = vi.fn().mockReturnThis()
  const remove = { eq: removeEq, then: (resolve: (value: unknown) => void) => { deleted = true; resolve({ error: null }) } }
  from.mockImplementation((table: string) => table === 'blocks'
    ? { select: vi.fn().mockReturnThis(), eq, order: vi.fn().mockReturnThis(), range, delete: () => remove }
    : { select: vi.fn().mockReturnThis(), in: (_field: string, ids: string[]) => Promise.resolve({ data: ids.map(id => ({ id, display_name: id === 'person-last' ? 'Last Person' : 'Blocked Person', avatar_path: null })), error: null }) })
  render(<MemoryRouter><BlocklistPage /></MemoryRouter>)
  await screen.findAllByText('Blocked Person')
  expect(eq).toHaveBeenCalledWith('blocker_id', 'owner')
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('Last Person')
  expect(range).toHaveBeenLastCalledWith(20, 40)
  await userEvent.click(screen.getByRole('button', { name: 'Unblock Last Person' }))
  await waitFor(() => expect(removeEq).toHaveBeenCalledWith('blocker_id', 'owner'))
  expect(removeEq).toHaveBeenCalledWith('blocked_id', 'person-last')
  await screen.findByText('Your blocklist is empty.')
})

it('shows a retryable error without claiming the blocklist is empty', async () => {
  const range = vi.fn().mockResolvedValueOnce({ error: { message: 'private internal failure' } }).mockResolvedValueOnce({ data: [], error: null })
  from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range })
  render(<MemoryRouter><BlocklistPage /></MemoryRouter>)
  await screen.findByRole('alert')
  expect(screen.queryByText('Your blocklist is empty.')).toBeNull()
  expect(screen.queryByText('private internal failure')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('Your blocklist is empty.')
})
