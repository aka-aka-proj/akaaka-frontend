import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, hasOnboarded } = useAuth()
  const { t } = useT()
  const location = useLocation()

  if (loading) {
    return <p>{t('common.loading')}</p>
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  if (!hasOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
