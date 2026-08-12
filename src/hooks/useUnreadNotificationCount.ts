import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export const NOTIFICATIONS_CHANGED_EVENT = 'akaaka:notifications-changed'

export function useUnreadNotificationCount(userId: string | undefined) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) {
      setCount(0)
      return
    }

    let cancelled = false
    const loadCount = async () => {
      const { count: unreadCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)

      if (!cancelled) setCount(unreadCount ?? 0)
    }

    const handleNotificationsChanged = () => {
      void loadCount()
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)

    if (!supabase.realtime || typeof supabase.channel !== 'function') {
      void loadCount()
      return () => { cancelled = true }
    }

    let channel: ReturnType<typeof supabase.channel> | undefined
    const subscribe = async () => {
      await supabase.realtime.setAuth()
      if (cancelled) return
      channel = supabase
        .channel(`user:${userId}`, { config: { private: true } })
        .on('broadcast', { event: 'new_notification' }, () => {
          void loadCount()
        })
        .subscribe()
    }

    void loadCount()
    void subscribe()

    return () => {
      cancelled = true
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [userId])

  return count
}
