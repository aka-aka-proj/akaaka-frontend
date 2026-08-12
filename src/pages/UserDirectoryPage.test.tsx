import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserDirectoryPage } from './UserDirectoryPage'

const from = vi.fn()
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer-user' } }) }))
vi.mock('../context/LanguageContext', () => ({ useLanguage: () => ({ locale: 'en', setLocale: () => {} }) }))
vi.mock('../supabaseClient', () => ({ supabase: { from: (...args: unknown[]) => from(...args) } }))
vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: ReactNode }) => <div>{children}</div> }))

describe('UserDirectoryPage', () => {
  beforeEach(() => from.mockReturnValue({ select: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ id: 'user-a', display_name: 'Alice', avatar_path: null }], error: null }) }))
  it('browses other profiles', async () => {
    render(<MemoryRouter><UserDirectoryPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    expect(screen.getByRole('link', { name: 'Alice' }).getAttribute('href')).toBe('/profile/user-a')
  })
})
