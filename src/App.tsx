import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { AdminRoute } from './components/AdminRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { useT } from './hooks/useT'
import { AdminModerationPanel } from './pages/AdminModerationPanel'
import { AdminRoleUpgrade } from './pages/AdminRoleUpgrade'
import { AuthPage } from './pages/AuthPage'
import { CreateEventPage } from './pages/CreateEventPage'
import { DirectChatPage } from './pages/DirectChatPage'
import { EditProfilePage } from './pages/EditProfilePage'
import { EditEventPage } from './pages/EditEventPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventsPage } from './pages/EventsPage'
import { FollowingPage } from './pages/FollowingPage'
import { IssueDetailPage } from './pages/IssueDetailPage'
import { IssuesPage } from './pages/IssuesPage'
import { MyReportsPage } from './pages/MyReportsPage'
import { MyRegistrationsPage } from './pages/MyRegistrationsPage'
import { MessagesPage } from './pages/MessagesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { NotificationSettingsPage } from './pages/NotificationSettingsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProfileFeedbackPage } from './pages/ProfileFeedbackPage'
import { ProfileReportPage } from './pages/ProfileReportPage'
import { ReportIssuePage } from './pages/ReportIssuePage'
import { SecurityPrivacyPage } from './pages/SecurityPrivacyPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { VirtualLoversPage } from './pages/VirtualLoversPage'
import { VirtualLoverChatPage } from './pages/VirtualLoverChatPage'
import { VirtualLoverCreatePage } from './pages/VirtualLoverCreatePage'

function RootRedirect() {
  const { user, loading, hasOnboarded } = useAuth()
  const { t } = useT()
  const location = useLocation()

  console.log('RootRedirect: loading=', loading, 'hasOnboarded=', hasOnboarded);

  if (loading) {
    return <main className="page" role="main"><p>{t('common.loading')}</p></main>
  }

  if (!user) return <Navigate to={`/auth?from=${encodeURIComponent(location.pathname)}`} replace state={{ from: location.pathname }} />

  if (hasOnboarded) return <Navigate to="/events" replace />

  return <Navigate to={`/onboarding?from=${encodeURIComponent(location.pathname)}`} replace state={{ from: location.pathname }} />
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
        path="/profile/me/edit"
        element={
          <ProtectedRoute>
            <EditProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/me/feedback"
        element={
          <ProtectedRoute>
            <ProfileFeedbackPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/me/reports"
        element={
          <ProtectedRoute>
            <ProfileReportPage />
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
        path="/profile/:id/reports"
        element={
          <ProtectedRoute>
            <ProfileReportPage />
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
        path="/notifications"
        element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>}
      />
      <Route
        path="/messages"
        element={<ProtectedRoute><MessagesPage /></ProtectedRoute>}
      />
      <Route
        path="/messages/:conversationId"
        element={<ProtectedRoute><DirectChatPage /></ProtectedRoute>}
      />
      <Route
        path="/messages/new"
        element={<ProtectedRoute><DirectChatPage /></ProtectedRoute>}
      />
      <Route
        path="/following"
        element={<ProtectedRoute><FollowingPage /></ProtectedRoute>}
      />
      <Route
        path="/settings/notifications"
        element={<ProtectedRoute><NotificationSettingsPage /></ProtectedRoute>}
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
      <Route
        path="/virtual-lovers"
        element={
          <ProtectedRoute>
            <VirtualLoversPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/virtual-lovers/new"
        element={
          <ProtectedRoute>
            <VirtualLoverCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/virtual-lovers/:id/chat"
        element={
          <ProtectedRoute>
            <VirtualLoverChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/security-privacy"
        element={
          <ProtectedRoute>
            <SecurityPrivacyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
