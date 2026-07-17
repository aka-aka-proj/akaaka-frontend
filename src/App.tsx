import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AdminRoute } from './components/AdminRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { AdminModerationPanel } from './pages/AdminModerationPanel'
import { AdminRoleUpgrade } from './pages/AdminRoleUpgrade'
import { AuthPage } from './pages/AuthPage'
import { CreateEventPage } from './pages/CreateEventPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventsPage } from './pages/EventsPage'
import { MyReportsPage } from './pages/MyReportsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProfilePage } from './pages/ProfilePage'

function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p>Loading...</p>
  }

  return <Navigate to={user ? '/events' : '/auth'} replace />
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
        path="/profile/:id"
        element={
          <ProtectedRoute>
            <ProfilePage />
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
