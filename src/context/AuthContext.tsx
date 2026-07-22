import type { Session, User, UserIdentity } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import { normalizeSocialLinks } from '../lib/profile'

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
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isInitialProfileLoad, setIsInitialProfileLoad] = useState(true)
  
  // 修改 loading 定義：在完成第一次 Profile 載入前，一律視為 loading
  const loading = isAuthLoading || isInitialProfileLoad

  const refreshProfile = async () => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      setIdentities(null)
      setIsInitialProfileLoad(false)
      return
    }

    setIsProfileLoading(true)
    const [profileResult, userResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.auth.getUser()
    ])
    
    setIsProfileLoading(false)
    setIsInitialProfileLoad(false)

    if (profileResult.error) {
      setProfile(null)
      return
    }
    
    setIdentities(userResult.data.user?.identities ?? null)

    const newProfile = profileResult.data ? mapProfileRow(profileResult.data) : null
    
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
    // 只有在 session 載入後才執行 Profile 同步
    if (isAuthLoading) return

    if (!session?.user.id) {
      setProfile(null)
      setIdentities(null)
      setIsInitialProfileLoad(false)
      return
    }

    // 自動同步 OAuth 資訊至 external_social_links (若適用)
    const syncSocialConnections = async () => {
      if (!identities) return
      
    const twitter = identities.find(i => i.provider === 'x')
    if (twitter && twitter.identity_data?.user_name) {
      const twitterUrl = `https://x.com/${twitter.identity_data.user_name}`
      const currentLinks = profile?.external_social_links ?? []
      
      if (!currentLinks.find(l => l.platform === 'x')) {
        const newLinks = [...currentLinks, { platform: 'x' as const, url: twitterUrl, is_connected: true }]
        await supabase
          .from('profiles')
          .update({ external_social_links: newLinks })
          .eq('id', session.user.id)
        await refreshProfile()
      }
    }

    }

    void refreshProfile()
    void syncSocialConnections()
  }, [session?.user.id, isAuthLoading, identities])

  const hasOnboarded = profile !== null

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      identities,
      profile,
      loading,
      isProfileLoading,
      isInitialProfileLoad,
      hasOnboarded,
      refreshProfile,
    }),
    [loading, isProfileLoading, isInitialProfileLoad, profile, session, hasOnboarded, identities],
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
