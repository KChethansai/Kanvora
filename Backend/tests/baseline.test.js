import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
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

test('mounted inventory accounts for the baseline and retired legacy definitions', async () => {
  const { createApp } = await loadApp()
  const { routeInventory } = await import('../utils/routeInventory.js')
  const routes = routeInventory(createApp())
  assert.equal(routes.length, 64)
  assert.equal(routes.filter(({ path }) => path !== '/health').length, 63)
  assert.ok(routes.every(({ method, path, source }) =>
    method && method !== 'HEAD' && method !== 'OPTIONS' &&
    path.startsWith('/') && source.startsWith('Backend/')))
  assert.deepEqual(routes.filter(({ path }) => path === '/api/templates').map(({ method }) => method), ['GET', 'POST'])
  assert.equal(routes.some(({ path }) => /^\/api\/(task|project)(\/|$)/.test(path)), false)
  const baseline = JSON.parse(await readFile(new URL('../../docs/api-baseline.json', import.meta.url), 'utf8'))
  const retired = new Set(['Backend/APIs/CommonTasksAPI.js', 'Backend/APIs/ProjectManagerAPI.js'])
  const added = (route) => route.method === 'PATCH' && route.path === '/api/workspaces/:id/members/:userId'
  assert.equal(routes.filter(added).length, 1)
  assert.deepEqual(baseline.routes.filter(({ source }) => !retired.has(source)), routes.filter((route) => !added(route)))
  assert.equal(baseline.definitionCount, 72)
  assert.equal(baseline.apiDefinitionCount, 71)
})
