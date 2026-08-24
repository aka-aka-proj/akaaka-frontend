import { useEffect, useRef } from 'react'
import { refreshWebPushSubscription } from '../lib/web-push'

// api/004 §Frontend refresh lifecycle: once per signed-in session, silently
// re-submit the current browser subscription so active users keep their
// `push_subscriptions.updated_at` fresh against the scheduled cleanup
// threshold. Best-effort: every failure is swallowed inside the lib and must
// never disturb the session.
export function useWebPushSessionRefresh(userId: string | null | undefined) {
  const refreshedForUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!userId || refreshedForUserId.current === userId) return
    refreshedForUserId.current = userId
    void refreshWebPushSubscription()
  }, [userId])
}
