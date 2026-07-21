const CACHE_NAME = 'akaaka-v1'
const STATIC_ASSETS = [
  '/',
  '/events',
  '/logo.svg',
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
