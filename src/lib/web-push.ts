import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

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

// The shared Supabase client resolves the JWT lazily during each request's
// fetch phase, so it always sends whichever session is current at THAT moment
// — an in-flight refresh surviving an account switch would submit with the
// NEW account's token (TOCTOU against any earlier ownership check). Reading
// the session here yields the identity a submit can be pinned to.
async function currentSessionUser(): Promise<{ id: string; accessToken: string } | null> {
  const session = await withTimeout(
    supabase.auth.getSession().then(({ data }) => data.session),
    null,
  )
  if (!session?.user.id || !session.access_token) return null
  return { id: session.user.id, accessToken: session.access_token }
}

export async function getWebPushState(profileId: string): Promise<WebPushState> {
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

type SubscriptionJson = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

function extractSubscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON() as SubscriptionJson
  const keys = json.keys
  if (!json.endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('web_push_invalid_subscription')
  }
  return { endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth }
}

// api/004 §Validation rules: the controlled RPC rejects a cross-profile
// transfer when the supplied key material does not match the stored row
// (possession proof), surfacing the domain exception `endpoint_conflict`.
function isEndpointConflict(error: { message?: string | null } | null | undefined): boolean {
  return error?.message === 'endpoint_conflict'
}

async function subscribeWithApplicationKey(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapidPublicKey as string),
  })
}

type SubmitSubscriptionOptions = {
  // Destructive recovery revokes the subscription before its replacement is
  // registered, so only interactive flows that surface failures to the user
  // may use it; background refreshes never retry and would leave push broken
  // for the whole SPA session on a failed swap.
  recoverFromEndpointConflict?: boolean
  // Overrides the shared client so callers can pin the exact access token
  // (and therefore identity) the submission is made with.
  client?: SupabaseClient
}

// Submit a browser subscription through the controlled RPC. On
// `endpoint_conflict` the endpoint is held by another account with different
// key material (typically rotated keys): revoke the browser subscription and
// re-subscribe, which mints a fresh endpoint the RPC registers conflict-free.
// The abandoned row is reclaimed later by the fan-out 404/410 path or the
// scheduled cleanup.
async function submitSubscription(
  registration: ServiceWorkerRegistration,
  subscription: PushSubscription,
  { recoverFromEndpointConflict = true, client = supabase }: SubmitSubscriptionOptions = {},
): Promise<PushSubscription> {
  const payload = extractSubscriptionPayload(subscription)
  const { error } = await client.rpc('subscribe_push_subscription', {
    p_endpoint: payload.endpoint,
    p_p256dh: payload.p256dh,
    p_auth: payload.auth,
    p_user_agent: navigator.userAgent,
  })
  if (!error) return subscription

  if (!isEndpointConflict(error) || !recoverFromEndpointConflict) throw error

  await subscription.unsubscribe()
  const replacement = await subscribeWithApplicationKey(registration)
  const replacementPayload = extractSubscriptionPayload(replacement)
  const retry = await client.rpc('subscribe_push_subscription', {
    p_endpoint: replacementPayload.endpoint,
    p_p256dh: replacementPayload.p256dh,
    p_auth: replacementPayload.auth,
    p_user_agent: navigator.userAgent,
  })
  if (retry.error) throw retry.error
  return replacement
}

export async function enableWebPush() {
  if (!canUseWebPush() || !vapidPublicKey) throw new Error('web_push_unsupported')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'web_push_denied' : 'web_push_cancelled')

  const registration = await serviceWorkerRegistration()
  if (!registration) throw new Error('web_push_unsupported')

  // push_subscriptions.endpoint has a global unique constraint: a shared
  // browser's subscription can belong to only one profile at a time. The
  // controlled RPC transfers ownership atomically when the previous account
  // left a row behind and the key material proves possession (RLS blocks
  // clients from updating it directly).
  const subscription = await subscribeWithApplicationKey(registration)
  return submitSubscription(registration, subscription)
}

// api/004 §Frontend refresh lifecycle: once per session, silently re-submit
// the current browser subscription so active users keep their `updated_at`
// fresh against the scheduled cleanup threshold (the server also honours
// recent successful deliveries, but client refreshes cover the
// no-notifications-yet case). Best-effort by design: any failure leaves push
// state untouched and must never disturb the session.
export async function refreshWebPushSubscription(profileId: string): Promise<boolean> {
  if (!canUseWebPush() || !vapidPublicKey) return false
  if (Notification.permission !== 'granted') return false
  try {
    const registration = await serviceWorkerRegistration()
    if (!registration) return false
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return false
    // Session-consistency gate (cheap bounded local read): skip before any
    // network work when the live session already belongs to another account.
    const entrySession = await currentSessionUser()
    if (!entrySession || entrySession.id !== profileId) return false
    // Ownership gate: on shared browsers the surviving endpoint may belong to
    // a previously signed-in profile. The passive path never transfers it —
    // cross-account transfer stays an explicit enableWebPush decision — so
    // skip silently when this profile does not hold the row.
    if (!(await isEndpointOwnedByProfile(profileId, subscription.endpoint))) return false
    // Re-read after the async ownership round-trip and pin THAT token: the
    // shared client resolves its JWT lazily during fetch, so submitting
    // through it could attach a newly signed-in account's token and transfer
    // the just-validated endpoint. A dedicated client bound to the validated
    // access token keeps submit identity === validated identity even if the
    // app session flips mid-flight.
    const submitSession = await currentSessionUser()
    if (!submitSession || submitSession.id !== profileId) return false
    const pinnedClient = createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => submitSession.accessToken,
    })
    // Non-destructive on purpose: an endpoint_conflict here (rotated key
    // material under a stable endpoint) is left to the explicit
    // enableWebPush flow or the scheduled cleanup instead of revoking a
    // working subscription this best-effort path may fail to replace.
    await submitSubscription(registration, subscription, {
      recoverFromEndpointConflict: false,
      client: pinnedClient,
    })
    return true
  } catch {
    return false
  }
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
