import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'

/** Renders children only when the authenticated user has app_metadata.role === 'admin'. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()
  const { t } = useT()
  const location = useLocation()

  if (loading) {
    return <p>{t('common.loading')}</p>
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  const isAdmin = profile?.role_status === 'admin'
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
