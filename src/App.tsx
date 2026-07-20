import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AdminRoute } from './components/AdminRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { useT } from './hooks/useT'
import { AdminModerationPanel } from './pages/AdminModerationPanel'
import { AdminRoleUpgrade } from './pages/AdminRoleUpgrade'
import { AuthPage } from './pages/AuthPage'
import { CreateEventPage } from './pages/CreateEventPage'
import { EditEventPage } from './pages/EditEventPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventsPage } from './pages/EventsPage'
import { IssueDetailPage } from './pages/IssueDetailPage'
import { IssuesPage } from './pages/IssuesPage'
import { MyReportsPage } from './pages/MyReportsPage'
import { MyRegistrationsPage } from './pages/MyRegistrationsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProfileReputationPage } from './pages/ProfileReputationPage'
import { ProfileFeedbackPage } from './pages/ProfileFeedbackPage'
import { ReportIssuePage } from './pages/ReportIssuePage'

function RootRedirect() {
  const { user, loading, hasOnboarded } = useAuth()
  const { t } = useT()

  if (loading) {
    return <p>{t('common.loading')}</p>
  }

  if (!user) return <Navigate to="/auth" replace />

  if (hasOnboarded) return <Navigate to="/events" replace />

  return <Navigate to="/onboarding" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <EventsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/new"
        element={
          <ProtectedRoute>
            <CreateEventPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:id/edit"
        element={
          <ProtectedRoute>
            <EditEventPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:id"
        element={
          <ProtectedRoute>
            <EventDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/me"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/me/reputation"
        element={
          <ProtectedRoute>
            <ProfileReputationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:id"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:id/feedback"
        element={
          <ProtectedRoute>
            <ProfileFeedbackPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:id/reputation"
        element={
          <ProtectedRoute>
            <ProfileReputationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/me"
        element={
          <ProtectedRoute>
            <MyReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/registrations/me"
        element={
          <ProtectedRoute>
            <MyRegistrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/issues"
        element={
          <ProtectedRoute>
            <IssuesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/issues/new"
        element={
          <ProtectedRoute>
            <ReportIssuePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/issues/:id"
        element={
          <ProtectedRoute>
            <IssueDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/moderation"
        element={
          <AdminRoute>
            <AdminModerationPanel />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/role-upgrade"
        element={
          <AdminRoute>
            <AdminRoleUpgrade />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
