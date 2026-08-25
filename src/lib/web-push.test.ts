import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.hoisted(() => vi.fn())
const fromMock = vi.hoisted(() => vi.fn())
const authSessionMock = vi.hoisted(() => vi.fn())

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
    auth: { getSession: authSessionMock },
  },
}))

type WebPushModule = typeof import('./web-push')

function fakeSubscription(endpoint: string) {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: `p256dh-${endpoint}`, auth: `auth-${endpoint}` } }),
    unsubscribe: vi.fn(async () => true),
  }
}

function fakeRegistration(getSubscriptionResult: unknown) {
  const subscribed: unknown[] = []
  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => getSubscriptionResult),
      subscribe: vi.fn(async () => {
        const next = fakeSubscription(`https://push.local/new-${subscribed.length + 1}`)
        subscribed.push(next)
        return next
      }),
    },
  }
  return registration
}

async function loadModule(): Promise<WebPushModule> {
  return import('./web-push')
}

function mockOwnershipQuery(result: { data: { endpoint: string } | null; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  }
  fromMock.mockReturnValue(builder)
  return builder
}

function stubSessionUser(id: string | null) {
  authSessionMock.mockResolvedValue({
    data: { session: id === null ? null : { user: { id } } },
    error: null,
  })
}

function stubBrowserCapability() {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(window, 'PushManager', { value: function PushManagerStub() {}, configurable: true })
}

describe('web-push session refresh', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    stubBrowserCapability()
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BMockPublicKey')
    rpcMock.mockReset()
    fromMock.mockReset()
    authSessionMock.mockReset()
    stubSessionUser('profile-a')
    vi.stubGlobal('Notification', { permission: 'granted' })
    vi.stubGlobal('navigator', { userAgent: 'vitest', serviceWorker: { ready: Promise.resolve(null) } })
  })

  it('skips refresh when permission is not granted', async () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('re-submits the current browser subscription through the RPC', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    const ownership = mockOwnershipQuery({ data: { endpoint: 'https://push.local/e1' }, error: null })
    rpcMock.mockResolvedValue({ error: null })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(true)
    expect(ownership.eq).toHaveBeenCalledWith('profile_id', 'profile-a')
    expect(ownership.eq).toHaveBeenCalledWith('endpoint', 'https://push.local/e1')
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('subscribe_push_subscription', {
      p_endpoint: 'https://push.local/e1',
      p_p256dh: 'p256dh-https://push.local/e1',
      p_auth: 'auth-https://push.local/e1',
      p_user_agent: 'vitest',
    })
  })

  it('stays silent when the RPC rejects', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    mockOwnershipQuery({ data: { endpoint: 'https://push.local/e1' }, error: null })
    rpcMock.mockResolvedValue({ error: { message: 'unauthenticated' } })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(false)
  })

  it('skips silently when the endpoint belongs to another profile', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    stubSessionUser('profile-b')
    mockOwnershipQuery({ data: null, error: null })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-b')).resolves.toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  it('aborts when the live session switched accounts before submit (TOCTOU)', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    mockOwnershipQuery({ data: { endpoint: 'https://push.local/e1' }, error: null })
    authSessionMock
      .mockResolvedValueOnce({ data: { session: { user: { id: 'profile-a' } } }, error: null })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'user-b' } } }, error: null })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  it('never revokes the subscription on endpoint_conflict during a refresh', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    mockOwnershipQuery({ data: { endpoint: 'https://push.local/e1' }, error: null })
    rpcMock.mockResolvedValue({ error: { code: 'P0001', message: 'endpoint_conflict' } })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(false)
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  it('recovers from endpoint_conflict by minting a fresh endpoint', async () => {
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: vi.fn(async () => 'granted'),
    })
    const stale = fakeSubscription('https://push.local/held')
    const registration = fakeRegistration(null)
    let call = 0
    registration.pushManager.subscribe.mockImplementation(async () => {
      call += 1
      return call === 1 ? stale : fakeSubscription('https://push.local/fresh')
    })
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(registration) },
    })
    rpcMock
      .mockResolvedValueOnce({ error: { code: 'P0001', message: 'endpoint_conflict' } })
      .mockResolvedValueOnce({ error: null })
    const { enableWebPush } = await loadModule()

    const result = await enableWebPush()
    expect(stale.unsubscribe).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledTimes(2)
    expect(result.toJSON()).toMatchObject({ endpoint: 'https://push.local/fresh' })
  })

  it('propagates non-conflict RPC errors from enableWebPush', async () => {
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: vi.fn(async () => 'granted'),
    })
    const registration = fakeRegistration(null)
    registration.pushManager.subscribe.mockImplementation(async () =>
      fakeSubscription('https://push.local/e2'))
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(registration) },
    })
    rpcMock.mockResolvedValue({ error: { message: 'invalid_subscription_payload' } })
    const { enableWebPush } = await loadModule()

    await expect(enableWebPush()).rejects.toMatchObject({ message: 'invalid_subscription_payload' })
  })
})
