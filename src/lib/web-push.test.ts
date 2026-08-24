import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const getSubscription = vi.fn()

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: vi.fn(),
    auth: { signOut: vi.fn() },
  },
}))

function stubBrowser(permission: 'granted' | 'denied' | 'default') {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn() })
  const registration = { pushManager: { getSubscription } }
  vi.stubGlobal('navigator', {
    ...navigator,
    serviceWorker: { ready: Promise.resolve(registration) },
    userAgent: 'test-agent',
  })
  vi.stubGlobal('PushManager', function PushManager() {})
}

describe('refreshWebPushSubscription', () => {
  let mod: typeof import('./web-push')

  beforeAll(async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BQstub-public-key')
    mod = await import('./web-push')
  })

  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null })
    getSubscription.mockReset()
  })

  it('re-submits the current subscription through the controlled RPC when permission is granted', async () => {
    stubBrowser('granted')
    getSubscription.mockResolvedValue({
      toJSON: () => ({
        endpoint: 'https://push.local/e1',
        keys: { p256dh: 'k1', auth: 'a1' },
      }),
    })

    await mod.refreshWebPushSubscription()

    expect(rpc).toHaveBeenCalledWith('subscribe_push_subscription', {
      p_endpoint: 'https://push.local/e1',
      p_p256dh: 'k1',
      p_auth: 'a1',
      p_user_agent: 'test-agent',
    })
  })

  it('skips the RPC when notification permission is not granted', async () => {
    stubBrowser('denied')
    getSubscription.mockResolvedValue({
      toJSON: () => ({
        endpoint: 'https://push.local/e1',
        keys: { p256dh: 'k1', auth: 'a1' },
      }),
    })

    await mod.refreshWebPushSubscription()

    expect(rpc).not.toHaveBeenCalled()
  })

  it('skips the RPC when the browser has no push subscription yet', async () => {
    stubBrowser('granted')
    getSubscription.mockResolvedValue(null)

    await mod.refreshWebPushSubscription()

    expect(rpc).not.toHaveBeenCalled()
  })
})
