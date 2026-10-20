import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { queueOfflineMutation, registerServiceWorker } from '../utils/pwa.js'

const origin = 'https://kanvora.test'
const source = readFileSync('public/sw.js', 'utf8')

function worker(names = ['kanvora-v1', 'other-app-v1']) {
  const handlers = {}
  const entries = new Map()
  const cache = {
    put: vi.fn(async (request, response) => entries.set(request.url || request, response)),
    match: vi.fn(async (request) => entries.get(request.url || request)),
    addAll: vi.fn(async () => {}),
  }
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => names),
    delete: vi.fn(async () => true),
    match: vi.fn(async (request) => entries.get(request.url || request)),
  }
  const fetch = vi.fn(async () => new Response('public'))
  const self = {
    location: new URL('/', origin),
    addEventListener: (type, handler) => { handlers[type] = handler },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => []) },
  }
  vm.runInNewContext(source, { self, caches, fetch, URL, Request, Response })
  return {
    handlers, entries, cache, caches, fetch, self,
    async request(path, options = {}) {
      const request = new Request(new URL(path, origin), options)
      let result
      const pending = []
      handlers.fetch({ request, respondWith: (promise) => { result = promise }, waitUntil: (promise) => pending.push(promise) })
      const response = await (result || fetch(request))
      await Promise.all(pending)
      return response
    },
    async lifecycle(type) {
      let pending
      handlers[type]({ waitUntil: (promise) => { pending = promise } })
      await pending
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PWA privacy containment', () => {
  it.each(['/boards-api/boards', '/api/me', '/auth/me', '/oauth/callback?code=secret', '/notifications', '/templates', '/dashboard', '/', '/index.html', 'https://backend.test/api/me', 'https://cdn.test/favicon.svg'])('never caches private or non-allowlisted GET %s', async (path) => {
    const sw = worker()
    await sw.request(path)
    await Promise.resolve()
    expect(sw.cache.put).not.toHaveBeenCalled()
    expect(sw.caches.match).not.toHaveBeenCalled()
    expect(sw.cache.match).not.toHaveBeenCalled()
  })

  it('never falls back to a previously cached private response on network failure', async () => {
    const sw = worker()
    sw.entries.set(`${origin}/api/me`, new Response('account A'))
    sw.fetch.mockRejectedValue(new Error('offline'))
    await expect(sw.request('/api/me')).rejects.toThrow('offline')
    expect(sw.caches.match).not.toHaveBeenCalled()
  })

  it('does not give account B account A data after logout while offline', async () => {
    const sw = worker()
    sw.fetch.mockResolvedValueOnce(new Response('account A'))
    expect(await (await sw.request('/boards-api/boards')).text()).toBe('account A')
    sw.fetch.mockRejectedValue(new Error('offline after logout'))
    await expect(sw.request('/boards-api/boards')).rejects.toThrow('offline after logout')
    expect(sw.cache.put).not.toHaveBeenCalled()
  })

  it('caches successful explicit public assets and serves them offline from its own cache', async () => {
    const sw = worker()
    await sw.request('/favicon.svg')
    expect(sw.cache.put).toHaveBeenCalledOnce()
    expect(sw.fetch).toHaveBeenCalledWith(expect.any(Request), { credentials: 'omit', cache: 'no-store', redirect: 'error' })
    sw.fetch.mockRejectedValue(new Error('offline'))
    expect(await (await sw.request('/favicon.svg')).text()).toBe('public')
    expect(sw.caches.match).not.toHaveBeenCalled()
  })

  it.each([401, 403, 404, 500])('does not cache or replace a public asset HTTP %s', async (status) => {
    const sw = worker()
    sw.entries.set(`${origin}/favicon.svg`, new Response('stale'))
    sw.fetch.mockResolvedValue(new Response('error', { status }))
    expect((await sw.request('/favicon.svg')).status).toBe(status)
    await Promise.resolve()
    expect(sw.cache.put).not.toHaveBeenCalled()
  })

  it.each(['private', 'no-store'])('does not cache a public asset marked %s', async (directive) => {
    const sw = worker()
    sw.fetch.mockResolvedValue(new Response('sensitive', { headers: { 'Cache-Control': directive } }))
    await sw.request('/favicon.svg')
    expect(sw.cache.put).not.toHaveBeenCalled()
  })

  it.each(['redirect', 'opaque'])('does not cache a %s response', async (kind) => {
    const sw = worker()
    const response = new Response('not public')
    Object.defineProperty(response, kind === 'redirect' ? 'redirected' : 'type', { value: kind === 'redirect' ? true : 'opaque' })
    sw.fetch.mockResolvedValue(response)
    await sw.request('/favicon.svg')
    expect(sw.cache.put).not.toHaveBeenCalled()
  })

  it('keeps successful network responses usable when Cache Storage is unavailable', async () => {
    const sw = worker()
    sw.caches.open.mockRejectedValue(new Error('storage blocked'))
    expect(await (await sw.request('/favicon.svg')).text()).toBe('public')
  })

  it('does not invent an offline shell when no public asset is cached', async () => {
    const sw = worker()
    sw.fetch.mockRejectedValue(new Error('offline'))
    await expect(sw.request('/favicon.svg')).rejects.toThrow('offline')
  })

  it('installs without precaching a potentially authenticated navigation shell', async () => {
    const sw = worker()
    await sw.lifecycle('install')
    expect(sw.self.skipWaiting).toHaveBeenCalledOnce()
    expect(sw.cache.addAll).not.toHaveBeenCalled()
    expect(sw.caches.open).not.toHaveBeenCalled()
  })

  it.each([
    ['/favicon.svg?token=secret', {}],
    ['/favicon.svg', { headers: { Authorization: 'Bearer secret' } }],
    ['/favicon.svg', { method: 'POST', body: 'secret' }],
  ])('bypasses caching for credential-bearing or write requests %s', async (path, options) => {
    const sw = worker()
    await sw.request(path, options)
    expect(sw.caches.open).not.toHaveBeenCalled()
  })

  it('deletes only known legacy and obsolete Kanvora public caches on activation', async () => {
    const sw = worker(['kanvora-v1', 'kanvora-public-v1', 'kanvora-public-v2', 'other-app-v1', 'unrelated', 'kanvora-not-ours'])
    await sw.lifecycle('activate')
    expect(sw.caches.delete.mock.calls.map(([name]) => name).sort()).toEqual(['kanvora-public-v1', 'kanvora-v1'])
    expect(sw.self.clients.claim).toHaveBeenCalledOnce()
  })

  it('has no pretend closed-client mutation synchronization handler', () => {
    expect(worker().handlers.sync).toBeUndefined()
  })

  it('rejects offline writes without persisting secrets or registering sync', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const ready = vi.fn()
    vi.stubGlobal('navigator', { serviceWorker: { get ready() { return ready() } } })
    await expect(queueOfflineMutation({ token: 'secret', body: 'private' })).rejects.toThrow(/online/i)
    expect(setItem).not.toHaveBeenCalled()
    expect(ready).not.toHaveBeenCalled()
  })

  it('removes the obsolete persistent queue even when registration is disabled', () => {
    localStorage.setItem('offline-mutations', '[{"token":"old-secret"}]')
    registerServiceWorker()
    expect(localStorage.getItem('offline-mutations')).toBeNull()
  })

  it('keeps boot resilient when legacy queue storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage blocked') })
    expect(() => registerServiceWorker()).not.toThrow()
  })
})
