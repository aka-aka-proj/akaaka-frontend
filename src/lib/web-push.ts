import { supabase } from '../supabaseClient'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type WebPushState = 'unsupported' | 'default' | 'denied' | 'subscribed' | 'unsubscribed'

function decodeBase64Url(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const normalized = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function canUseWebPush() {
  return Boolean(
    vapidPublicKey
      && window.isSecureContext
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window,
  )
}

const SERVICE_WORKER_TIMEOUT_MS = 5000

// navigator.serviceWorker.ready and Supabase queries can both pend forever
// (stuck registration, captive portal); every await below races a timeout so
// onboarding always settles instead of hanging on a blank screen.
function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), SERVICE_WORKER_TIMEOUT_MS)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      () => {
        window.clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  return withTimeout(navigator.serviceWorker.ready, null)
}

// A browser-level subscription may belong to a previous account on shared
// devices; only treat the endpoint as owned when this profile holds its row.
async function isEndpointOwnedByProfile(profileId: string, endpoint: string): Promise<boolean> {
  const ownershipQuery = supabase
    .from('push_subscriptions')
    .select('endpoint')
    .eq('profile_id', profileId)
    .eq('endpoint', endpoint)
    .maybeSingle() as unknown as Promise<{ data: { endpoint: string } | null; error: { message: string } | null }>
  const result = await withTimeout(ownershipQuery, null)
  if (!result) throw new Error('web_push_state_timeout')
  if (result.error) throw new Error(result.error.message)
  return Boolean(result.data)
}

export async function getWebPushState(profileId?: string): Promise<WebPushState> {
  if (!canUseWebPush()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await serviceWorkerRegistration()
  if (!registration) return 'unsupported'
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return 'unsubscribed'
  if (profileId && !(await isEndpointOwnedByProfile(profileId, subscription.endpoint))) {
    return 'unsubscribed'
  }
  return 'subscribed'
}

export async function enableWebPush() {
  if (!canUseWebPush() || !vapidPublicKey) throw new Error('web_push_unsupported')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'web_push_denied' : 'web_push_cancelled')

  const registration = await serviceWorkerRegistration()
  if (!registration) throw new Error('web_push_unsupported')

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapidPublicKey),
  })
  const json = subscription.toJSON()
  const keys = json.keys
  if (!json.endpoint || !keys?.p256dh || !keys.auth) throw new Error('web_push_invalid_subscription')

  // push_subscriptions.endpoint has a global unique constraint: a shared
  // browser's subscription can belong to only one profile at a time. The
  // controlled RPC transfers ownership atomically when the previous account
  // left a row behind (RLS blocks clients from updating it directly).
  const { error } = await supabase.rpc('subscribe_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
  return subscription
}

export async function disableWebPush(profileId: string) {
  if (!('serviceWorker' in navigator)) return
  const registration = await serviceWorkerRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('profile_id', profileId)
    .eq('endpoint', endpoint)
  if (error) throw error
  await subscription.unsubscribe()
}
