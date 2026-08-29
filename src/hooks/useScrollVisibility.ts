import { useEffect, useState } from 'react'

interface UseScrollVisibilityOptions {
  enabled?: boolean
  preserveWhen?: () => boolean
}

/**
 * Keeps mobile shell controls available while the user is actively interacting,
 * then saves viewport space while the document is scrolling down.
 */
export function useScrollVisibility({ enabled = true, preserveWhen }: UseScrollVisibilityOptions = {}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!enabled) {
      setVisible(true)
      return
    }

    let previousY = window.scrollY
    let frame: number | null = null
    let idleTimer: number | null = null

    const reveal = () => setVisible(true)

    const handleScroll = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        const currentY = window.scrollY
        const distanceToBottom = document.documentElement.scrollHeight - window.innerHeight - currentY

        if (currentY <= 8 || distanceToBottom <= 24 || preserveWhen?.()) {
          reveal()
        } else if (currentY - previousY > 4) {
          setVisible(false)
        } else if (previousY - currentY > 4) {
          reveal()
        }
        previousY = currentY

        if (idleTimer !== null) window.clearTimeout(idleTimer)
        idleTimer = window.setTimeout(reveal, 700)
      })
    }

    const handleFocusIn = () => reveal()

    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('focusin', handleFocusIn)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('focusin', handleFocusIn)
      if (frame !== null) window.cancelAnimationFrame(frame)
      if (idleTimer !== null) window.clearTimeout(idleTimer)
    }
  }, [enabled, preserveWhen])

  return visible
}
