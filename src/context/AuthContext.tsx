import type { Session, User, UserIdentity } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import { normalizeSocialLinks } from '../lib/profile'
import { useWebPushSessionRefresh } from '../hooks/useWebPushSessionRefresh'

interface AuthContextValue {
  user: User | null
  session: Session | null
  identities: UserIdentity[] | null
  profile: Profile | null
  loading: boolean
  isProfileLoading: boolean
  isInitialProfileLoad: boolean
  hasOnboarded: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapProfileRow(row: unknown): Profile {
  const source = (row ?? {}) as Record<string, unknown>

  return {
    id: String(source.id ?? ''),
    role_status: (source.role_status as Profile['role_status']) ?? 'general',
    display_name: (source.display_name as string | null) ?? null,
    bio: (source.bio as string | null) ?? null,
    external_social_links: normalizeSocialLinks(source.external_social_links),
    metadata: (source.metadata as Profile['metadata']) ?? null,
    reputation_score: Number(source.reputation_score ?? 0),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isInitialProfileLoad, setIsInitialProfileLoad] = useState(true)
  
  const loading = isAuthLoading || isInitialProfileLoad

  const refreshProfile = async () => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      setIsInitialProfileLoad(false)
      return
    }

    setIsProfileLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    
    setIsProfileLoading(false)
    setIsInitialProfileLoad(false)

    if (error) {
      setProfile(null)
      return
    }

    const newProfile = data ? mapProfileRow(data) : null
    
    setProfile((prevProfile) => {
      if (JSON.stringify(prevProfile) === JSON.stringify(newProfile)) {
        return prevProfile
      }
      return newProfile
    })
  }

  useEffect(() => {
    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        setIsAuthLoading(false)
        return
      }

      setSession(data.session)
      setIsAuthLoading(false)
    }

    void initAuth()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isAuthLoading) return

    if (!session?.user.id) {
      setProfile(null)
      setIsInitialProfileLoad(false)
      return
    }

    void refreshProfile()
  }, [session?.user.id, isAuthLoading])

  const hasOnboarded = profile !== null

  // api/004 §Frontend refresh lifecycle: keep active users' push
  // subscription `updated_at` fresh once per session (best-effort, silent).
  useWebPushSessionRefresh(session?.user.id ?? null)

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      identities: session?.user?.identities ?? null,
      profile,
      loading,
      isProfileLoading,
      isInitialProfileLoad,
      hasOnboarded,
      refreshProfile,
    }),
    [loading, isProfileLoading, isInitialProfileLoad, profile, session, hasOnboarded],
  )


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
