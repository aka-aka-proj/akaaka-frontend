import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, isProfileLoading, isInitialProfileLoad, hasOnboarded } = useAuth()
  const { t } = useT()
  const location = useLocation()

  if (loading || isProfileLoading || isInitialProfileLoad) {
    return <main className="page" role="main"><p>{t('common.loading')}</p></main>
  }

  if (!user) {
    return <Navigate to={`/auth?from=${encodeURIComponent(location.pathname)}`} replace state={{ from: location.pathname }} />
  }

  if (!hasOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to={`/onboarding?from=${encodeURIComponent(location.pathname)}`} replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
