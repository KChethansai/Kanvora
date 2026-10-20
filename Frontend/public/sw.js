const CACHE_NAME = 'kanvora-public-v2'
const PUBLIC_ASSETS = new Set(['/manifest.webmanifest', '/favicon.svg', '/favicon.png'])

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key === 'kanvora-v1' || (/^kanvora-public-v\d+$/.test(key) && key !== CACHE_NAME))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.search ||
    request.headers.has('Authorization') ||
    !PUBLIC_ASSETS.has(url.pathname)
  ) return

  event.respondWith((async () => {
    let response
    try {
      response = await fetch(request, { credentials: 'omit', cache: 'no-store', redirect: 'error' })
    } catch (error) {
      const cached = await caches.open(CACHE_NAME).then((cache) => cache.match(request)).catch(() => undefined)
      if (cached) return cached
      throw error
    }

    if (
      response.ok &&
      !response.redirected &&
      (response.type === 'basic' || response.type === 'default') &&
      !/\b(private|no-store)\b/i.test(response.headers.get('Cache-Control') || '')
    ) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {}))
    }
    return response
  })())
})
