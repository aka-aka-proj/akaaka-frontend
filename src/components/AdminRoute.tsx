import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Renders children only when the authenticated user has app_metadata.role === 'admin'. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p>Loading...</p>
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
