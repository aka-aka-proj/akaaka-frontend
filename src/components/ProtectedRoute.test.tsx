import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'

const useAuth = vi.hoisted(() => vi.fn())
vi.mock('../context/AuthContext', () => ({ useAuth }))

beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 'user' }, loading: false, isProfileLoading: true, isInitialProfileLoad: false, hasOnboarded: false })
})
function show(path = '/onboarding') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/auth" element={<p>Sign in</p>} /><Route path="*" element={<ProtectedRoute><p>Retained content</p></ProtectedRoute>} /></Routes></MemoryRouter>)
}
it('retains onboarding during a subsequent profile refresh', () => {
  show()
  expect(screen.getByText('Retained content')).toBeTruthy()
})
it('keeps the initial profile load guarded', () => {
  useAuth.mockReturnValue({ user: { id: 'user' }, loading: false, isProfileLoading: true, isInitialProfileLoad: true, hasOnboarded: false })
  show()
  expect(screen.queryByText('Retained content')).toBeNull()
  expect(screen.getByText('載入中...')).toBeTruthy()
})
it('keeps other protected pages guarded during profile refresh', () => {
  show('/events/mine')
  expect(screen.queryByText('Retained content')).toBeNull()
  expect(screen.getByText('載入中...')).toBeTruthy()
})
it('still requires an authenticated user on onboarding', () => {
  useAuth.mockReturnValue({ user: null, loading: false, isProfileLoading: false, isInitialProfileLoad: false, hasOnboarded: false })
  show()
  expect(screen.getByText('Sign in')).toBeTruthy()
  expect(screen.queryByText('Retained content')).toBeNull()
})
