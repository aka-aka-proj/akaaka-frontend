import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { IconTheme, Profile } from '../types'
import { supabase } from '../supabaseClient'

interface IconThemeContextValue {
  iconTheme: IconTheme
  setIconTheme: (theme: IconTheme) => void
  syncFromProfile: (profile: Profile) => void
}

const IconThemeContext = createContext<IconThemeContextValue>({
  iconTheme: 'purple',
  setIconTheme: () => {},
  syncFromProfile: () => {},
})

const ICON_MAP: Record<IconTheme, { logo: string; logoLogin: string; favicon: string }> = {
  purple: { logo: '/logo.svg', logoLogin: '/logo-login.svg', favicon: '/favicon.svg' },
  red: { logo: '/logo-red.svg', logoLogin: '/logo-login-red.svg', favicon: '/favicon-red.svg' },
}

export function IconThemeProvider({ children }: { children: ReactNode }) {
  const [iconTheme, setIconThemeState] = useState<IconTheme>('purple')
  const [userId, setUserId] = useState<string | null>(null)

  const applyTheme = (theme: IconTheme) => {
    setIconThemeState(theme)
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) {
      link.href = ICON_MAP[theme].favicon
    }
  }

  const setIconTheme = (newTheme: IconTheme) => {
    applyTheme(newTheme)
    if (userId) {
      void supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user.id
        if (!uid) return
        void supabase
          .from('profiles')
          .update({ metadata: { icon_theme: newTheme } })
          .eq('id', uid)
      })
    }
  }

  const syncFromProfile = (profile: Profile) => {
    setUserId(profile.id)
    const theme = profile.metadata?.icon_theme
    if (theme === 'purple' || theme === 'red') {
      applyTheme(theme)
    }
  }

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) {
      link.href = ICON_MAP[iconTheme].favicon
    }
  }, [iconTheme])

  return (
    <IconThemeContext.Provider value={{ iconTheme, setIconTheme, syncFromProfile }}>
      {children}
    </IconThemeContext.Provider>
  )
}

export function useIconTheme() {
  return useContext(IconThemeContext)
}

export function getIconSrc(iconTheme: IconTheme, type: 'logo' | 'logoLogin') {
  return iconTheme === 'red' ? ICON_MAP.red[type] : ICON_MAP.purple[type]
}
