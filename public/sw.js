const CACHE_NAME = 'tradelog-ai-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Skip API routes, Supabase, and external requests
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('tosspayments') ||
    url.hostname.includes('anthropic') ||
    url.origin !== self.location.origin
  ) {
    return
  }

  // Network-first for navigation (pages), cache-first for static assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/').then((r) => r || fetch(event.request))
      )
    )
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      )
    )
  }
})
