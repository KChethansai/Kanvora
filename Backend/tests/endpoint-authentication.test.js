import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'

Object.assign(process.env, { NODE_ENV: 'test', DB_URL: 'mongodb://127.0.0.1:1/kanvora_test',
  SECRET_KEY: 'synthetic-test-key-only', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' })

test('every retained private HTTP definition rejects an anonymous request', async (t) => {
  const { createApp } = await import('../app.js')
  const { routeInventory } = await import('../utils/routeInventory.js')
  const app = createApp()
  const publicRoutes = new Set(['GET /health', 'GET /auth', 'POST /auth/register',
    'POST /auth/login', 'POST /oauth/google', 'GET /auth/check-auth', 'POST /oauth/apple'])
  const server = createServer(app)
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  let checked = 0
  for (const route of routeInventory(app)) {
    if (publicRoutes.has(`${route.method} ${route.path}`)) continue
    const path = route.path.replace(/:[A-Za-z0-9_]+/g, '000000000000000000000001')
    const response = await fetch(`${base}${path}`, { method: route.method })
    assert.equal(response.status, 401, `${route.method} ${route.path} must authenticate before accessing data`)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    checked++
  }
  assert.equal(checked, 57)
  const disabledProvider = await fetch(`${base}/oauth/apple`, { method: 'POST' })
  assert.equal(disabledProvider.status, 501)
  assert.equal(disabledProvider.headers.has('set-cookie'), false)
})
