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
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request)),
  )
})
