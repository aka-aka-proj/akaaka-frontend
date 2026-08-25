import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.hoisted(() => vi.fn())
const fromMock = vi.hoisted(() => vi.fn())
const authSessionMock = vi.hoisted(() => vi.fn())
const createClientMock = vi.hoisted(() => vi.fn())
const pinnedRpcMock = vi.hoisted(() => vi.fn())

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
    auth: { getSession: authSessionMock },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
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

function stubSessionUser(id: string | null, token = id === null ? null : `token-${id}`) {
  authSessionMock.mockResolvedValue({
    data: {
      session: id === null ? null : { user: { id }, access_token: token },
    },
    error: null,
  })
}

// Queue two session reads: entry gate sees userIdA, post-ownership re-read
// sees userIdB — modelling an account switch mid-refresh.
function stubSessionFlip(userIdA: string, userIdB: string) {
  authSessionMock
    .mockResolvedValueOnce({
      data: { session: { user: { id: userIdA }, access_token: `token-${userIdA}` } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { session: { user: { id: userIdB }, access_token: `token-${userIdB}` } },
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
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supa.test')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    rpcMock.mockReset()
    fromMock.mockReset()
    authSessionMock.mockReset()
    pinnedRpcMock.mockReset()
    stubSessionUser('profile-a')
    createClientMock.mockReset()
    createClientMock.mockReturnValue({ rpc: pinnedRpcMock })
    vi.stubGlobal('Notification', { permission: 'granted' })
    vi.stubGlobal('navigator', { userAgent: 'vitest', serviceWorker: { ready: Promise.resolve(null) } })
  })

  it('skips refresh when permission is not granted', async () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
    expect(pinnedRpcMock).not.toHaveBeenCalled()
  })

  it('re-submits the owned subscription through the pinned client', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    pinnedRpcMock.mockResolvedValue({ data: 'sub-id', error: null })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(true)
    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(createClientMock).toHaveBeenCalledWith('https://supa.test', 'anon-key', expect.objectContaining({
      accessToken: expect.any(Function),
    }))
    expect(pinnedRpcMock).toHaveBeenCalledTimes(1)
    expect(pinnedRpcMock).toHaveBeenCalledWith('subscribe_push_subscription', {
      p_endpoint: 'https://push.local/e1',
      p_p256dh: 'p256dh-https://push.local/e1',
      p_auth: 'auth-https://push.local/e1',
      p_user_agent: 'vitest',
      p_mode: 'refresh',
    })
    const options = createClientMock.mock.calls[0][2] as { accessToken: () => Promise<string> }
    await expect(options.accessToken()).resolves.toBe('token-profile-a')
  })

  it('keeps submitting with the validated token even after the app session flips', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    pinnedRpcMock.mockResolvedValue({ data: 'sub-id', error: null })
    // Both validation reads see profile-a; every LATER read (e.g. a lazy JWT
    // lookup during fetch) sees user-b — yet the pinned client must keep
    // returning token-profile-a.
    authSessionMock
      .mockResolvedValueOnce({
        data: { session: { user: { id: 'profile-a' }, access_token: 'token-profile-a' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: { user: { id: 'profile-a' }, access_token: 'token-profile-a' } },
        error: null,
      })
      .mockResolvedValue({
        data: { session: { user: { id: 'user-b' }, access_token: 'token-user-b' } },
        error: null,
      })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(true)
    const options = createClientMock.mock.calls[0][2] as { accessToken: () => Promise<string> }
    await expect(options.accessToken()).resolves.toBe('token-profile-a')
  })

  it('stays silent when the RPC rejects', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    pinnedRpcMock.mockResolvedValue({ error: { message: 'unauthenticated' } })
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
    // api/004 §Response: refresh maps a foreign-held endpoint to NULL (`not_owned`).
    pinnedRpcMock.mockResolvedValue({ data: null, error: null })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-b')).resolves.toBe(false)
    expect(pinnedRpcMock).toHaveBeenCalledTimes(1)
    expect(pinnedRpcMock).toHaveBeenCalledWith('subscribe_push_subscription', expect.objectContaining({ p_mode: 'refresh' }))
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  it('re-registers automatically when scheduled cleanup removed the stored row', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    pinnedRpcMock.mockResolvedValue({ data: 'recovered-sub-id', error: null })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(true)
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  it('aborts when the live session switched accounts before submit (TOCTOU)', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    stubSessionFlip('profile-a', 'user-b')
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(false)
    expect(createClientMock).not.toHaveBeenCalled()
    expect(pinnedRpcMock).not.toHaveBeenCalled()
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  it('never revokes the subscription on endpoint_conflict during a refresh', async () => {
    const subscription = fakeSubscription('https://push.local/e1')
    vi.stubGlobal('navigator', {
      userAgent: 'vitest',
      serviceWorker: { ready: Promise.resolve(fakeRegistration(subscription)) },
    })
    pinnedRpcMock.mockResolvedValue({ error: { code: 'P0001', message: 'endpoint_conflict' } })
    const { refreshWebPushSubscription } = await loadModule()

    await expect(refreshWebPushSubscription('profile-a')).resolves.toBe(false)
    expect(pinnedRpcMock).toHaveBeenCalledTimes(1)
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
