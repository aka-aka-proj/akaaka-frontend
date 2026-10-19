import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../hooks/useT'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, isProfileLoading, isInitialProfileLoad, hasOnboarded } = useAuth()
  const { t } = useT()
  const location = useLocation()
  const from = `${location.pathname}${location.search}`

  // Keep saved onboarding state mounted while its profile refresh/retry is pending.
  if (loading || isInitialProfileLoad || (isProfileLoading && location.pathname !== '/onboarding')) {
    return <main className="page" role="main"><p>{t('common.loading')}</p></main>
  }

  if (!user) {
    return <Navigate to={`/auth?from=${encodeURIComponent(from)}`} replace state={{ from }} />
  }

  if (!hasOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to={`/onboarding?from=${encodeURIComponent(from)}`} replace state={{ from }} />
  }

  return <>{children}</>
}
