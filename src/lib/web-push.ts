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

export async function getWebPushState(): Promise<WebPushState> {
  if (!canUseWebPush()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription ? 'subscribed' : 'unsubscribed'
}

export async function enableWebPush(profileId: string) {
  if (!canUseWebPush() || !vapidPublicKey) throw new Error('web_push_unsupported')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'web_push_denied' : 'web_push_cancelled')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapidPublicKey),
  })
  const json = subscription.toJSON()
  const keys = json.keys
  if (!json.endpoint || !keys?.p256dh || !keys.auth) throw new Error('web_push_invalid_subscription')

  const { error } = await supabase.from('push_subscriptions').upsert({
    profile_id: profileId,
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id,endpoint' })
  if (error) throw error
  return subscription
}

export async function disableWebPush(profileId: string) {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
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
