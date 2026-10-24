import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

process.env.NODE_ENV = 'test'
process.env.DB_URL = 'mongodb://127.0.0.1:1/kanvora_test'
process.env.SECRET_KEY = 'synthetic-test-key-only'
process.env.SMTP_HOST = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASS = ''

const loadApp = () => import('../app.js')

test('application and server imports do not connect, listen, or initialize sockets', async () => {
  const { default: mongoose } = await import('mongoose')
  const { Server } = await import('node:http')
  const connect = test.mock.method(mongoose, 'connect', () => {
    throw new Error('Import must not connect to MongoDB')
  })
  const listen = test.mock.method(Server.prototype, 'listen', () => {
    throw new Error('Import must not listen')
  })
  try {
    const { createApp } = await loadApp()
    const server = await import('../server.js')
    const { getIO } = await import('../socket.js')
    assert.equal(server.createApp, createApp)
    assert.notEqual(createApp(), createApp())
    assert.equal(mongoose.connection.readyState, 0)
    assert.equal(connect.mock.callCount(), 0)
    assert.equal(listen.mock.callCount(), 0)
    assert.throws(getIO, /not initialised/)
  } finally {
    connect.mock.restore()
    listen.mock.restore()
  }
})

test('health, unknown routes, and unauthenticated denial work without a database', async (t) => {
  const { createApp } = await loadApp()
  const server = createServer(createApp())
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
    server.closeAllConnections()
  }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`

  const health = await fetch(`${base}/health`)
  assert.equal(health.status, 200)
  assert.equal(health.headers.get('cache-control'), 'no-store')
  const payload = await health.json()
  assert.equal(payload.status, 'ok')
  assert.equal(typeof payload.uptime, 'number')
  assert.ok(Number.isFinite(Date.parse(payload.time)))

  const missing = await fetch(`${base}/no-such-route`)
  assert.equal(missing.status, 404)
  const error = await missing.json()
  assert.equal(error.message, 'Route GET /no-such-route not found')
  assert.equal(error.requestId, missing.headers.get('x-request-id'))
  assert.ok(error.requestId)

  const protectedRoute = await fetch(`${base}/projects-api/projects`)
  assert.equal(protectedRoute.status, 401)
  assert.deepEqual(await protectedRoute.json(), { message: 'Please login to the application' })
})

test('mounted inventory matches the recorded baseline and keeps retired legacy definitions retired', async () => {
  const { createApp } = await loadApp()
  const { routeInventory } = await import('../utils/routeInventory.js')
  const routes = routeInventory(createApp())
  // 69 V5 definitions plus the two read-only assistant routes.
  assert.equal(routes.length, 71)
  // Health probes are not API definitions.
  assert.equal(routes.filter(({ path }) => path !== '/health').length, 70)
  assert.ok(routes.every(({ method, path, source }) =>
    method && method !== 'HEAD' && method !== 'OPTIONS' &&
    path.startsWith('/') && source.startsWith('Backend/')))
  assert.deepEqual(routes.filter(({ path }) => path === '/api/templates').map(({ method }) => method), ['GET', 'POST'])

  // The retired legacy surfaces stay retired, by path and by source file.
  assert.equal(routes.some(({ path }) => /^\/api\/(task|project)(\/|$)/.test(path)), false)
  const retiredSources = new Set(['Backend/APIs/CommonTasksAPI.js', 'Backend/APIs/ProjectManagerAPI.js'])
  assert.equal(routes.some(({ source }) => retiredSources.has(source)), false)

  // The recorded inventory describes the application as it is, so a route added
  // without recording it fails here instead of leaving the document stale. The
  // canonical hash is what makes two inventories comparable across commits.
  const baseline = JSON.parse(await readFile(new URL('../../docs/api-baseline.json', import.meta.url), 'utf8'))
  assert.equal(baseline.definitionCount, routes.length)
  assert.equal(baseline.apiDefinitionCount, routes.filter(({ path }) => path !== '/health').length)
  assert.deepEqual(baseline.routes, routes)
  const canonicalHash = createHash('sha256')
    .update(routes.map(({ method, path }) => `${method} ${path}`).sort().join('\n'))
    .digest('hex')
  assert.equal(baseline.canonicalHash, canonicalHash)
})
