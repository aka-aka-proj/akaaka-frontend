import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type IconTheme = 'purple' | 'red'

interface IconThemeContextValue {
  iconTheme: IconTheme
  setIconTheme: (theme: IconTheme) => void
}

const IconThemeContext = createContext<IconThemeContextValue>({
  iconTheme: 'purple',
  setIconTheme: () => {},
})

const STORAGE_KEY = 'akaaka-icon-theme'

const ICON_MAP: Record<IconTheme, { logo: string; logoLogin: string; favicon: string }> = {
  purple: { logo: '/logo.svg', logoLogin: '/logo-login.svg', favicon: '/favicon.svg' },
  red: { logo: '/logo-red.svg', logoLogin: '/logo-login-red.svg', favicon: '/favicon-red.svg' },
}

function getInitialTheme(): IconTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'purple' || stored === 'red') return stored
  } catch {
    // ignore
  }
  return 'purple'
}

export function IconThemeProvider({ children }: { children: ReactNode }) {
  const [iconTheme, setIconThemeState] = useState<IconTheme>(getInitialTheme)

  const setIconTheme = (newTheme: IconTheme) => {
    setIconThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) {
      link.href = ICON_MAP[iconTheme].favicon
    }
  }, [iconTheme])

  return (
    <IconThemeContext.Provider value={{ iconTheme, setIconTheme }}>
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
