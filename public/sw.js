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

  const title = typeof payload.title === 'string' ? payload.title : 'AkaAka'
  const options = {
    body: typeof payload.body === 'string' ? payload.body : '你有一則新的通知。',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: typeof payload.url === 'string' ? payload.url : '/notifications' },
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
