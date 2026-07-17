import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useAuth()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{title}</h1>
        {user ? (
          <nav className="nav">
            <Link to="/events">Events</Link>
            <Link to="/events/new">Create Event</Link>
            <Link to="/profile/me">My Profile</Link>
            <Link to="/reports/me">My Reports</Link>
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </nav>
        ) : null}
      </header>
      {children}
    </main>
  )
}
