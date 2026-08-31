const CACHE_NAME = 'akaaka-v1'
const STATIC_ASSETS = [
  '/',
  '/events',
  '/icons/icon-whole.png',
  '/favicon.svg',
  '/default-avatar.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return
  }

  if (request.url.includes('/api/') || request.url.includes('supabase')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 確保只快取成功的 GET 回應
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request)
        if (cachedResponse) {
          return cachedResponse
        }
        // 如果 fetch 失敗且快取中也沒有，回傳一個 404 Response，避免傳遞 undefined
        return new Response('Not Found', { status: 404 })
      }),
  )
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = {}
  }

  const notificationType = typeof payload.notification_type === 'string'
    ? payload.notification_type
    : typeof payload.notificationType === 'string'
      ? payload.notificationType
      : 'general'
  const titles = {
    new_event: 'BDSM 圈內揪新活動通知',
    new_follow: 'BDSM 圈內揪新追蹤通知',
    event_invitation: 'BDSM 圈內揪活動邀請',
    new_issue: 'BDSM 圈內揪系統通知',
    venue_application: 'BDSM 圈內揪系統通知',
  }
  const title = titles[notificationType] || 'BDSM 圈內揪通知'
  const targetId = typeof payload.target?.id === 'string' ? payload.target.id : ''
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)
  const eventId = typeof payload.eventId === 'string' ? payload.eventId : ''
  const safeEventPath = /^\/events\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const requestedUrl = typeof payload.url === 'string' ? payload.url : ''
  const url = isUuid && payload.target?.kind === 'event'
    ? `/events/${targetId}`
    : isUuid && payload.target?.kind === 'profile'
      ? `/profile/${targetId}`
      : requestedUrl === '/notifications'
        ? requestedUrl
        : safeEventPath.test(requestedUrl)
          ? requestedUrl
          : safeEventPath.test(`/events/${eventId}`)
            ? `/events/${eventId}`
            : '/notifications'
  const options = {
    body: '你有一則新的通知，開啟 BDSM 圈內揪 查看詳細內容。',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {
      url,
      notificationId: typeof payload.notification_id === 'string'
        ? payload.notification_id
        : typeof payload.notificationId === 'string'
          ? payload.notificationId
          : undefined,
    },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/notifications', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin))
      if (existing) {
        return existing.navigate(targetUrl).then(() => existing.focus())
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
