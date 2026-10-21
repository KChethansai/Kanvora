import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import jwt from 'jsonwebtoken'

Object.assign(process.env, { NODE_ENV: 'test', DB_URL: 'mongodb://127.0.0.1:1/kanvora_test',
  SECRET_KEY: 'synthetic-test-key-only', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' })

test('all nine retired legacy mutations and reads are unreachable', async (t) => {
  const { createApp } = await import('../app.js')
  const server = createServer(createApp())
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  for (const [method, path] of [
    ['GET', '/api/task'], ['POST', '/api/task'], ['PUT', '/api/task'], ['PATCH', '/api/task'],
    ['GET', '/api/project'], ['POST', '/api/project'], ['PUT', '/api/project'],
    ['PATCH', '/api/project'], ['PATCH', '/api/project/000000000000000000000001']
  ]) {
    // A browser always sends an origin on a state changing request, and the
    // origin check now applies in every environment.
    for (const headers of [
      {},
      { Origin: 'http://localhost:5173' },
      { Cookie: `token=${jwt.sign({ id: '000000000000000000000002', role: 'MANAGER' }, process.env.SECRET_KEY)}`, Origin: 'http://localhost:5173' }
    ]) {
      const result = await fetch(`${base}${path}`, { method, headers })
      assert.equal(result.status, 404, `${method} ${path} must not mount a legacy router`)
    }
  }
})

test('invitation landing validates tokens and redirects without interpolated HTML', async (t) => {
  const { createApp } = await import('../app.js')
  const server = createServer(createApp())
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const malicious = await fetch(`${base}/auth?invite=${encodeURIComponent('\"><a href="https://example.test">Injected')}`, { redirect: 'manual' })
  assert.equal(malicious.status, 400)
  assert.equal((await malicious.text()).includes('<a'), false)
  const valid = await fetch(`${base}/auth?invite=${'a'.repeat(48)}`, { redirect: 'manual' })
  assert.equal(valid.status, 302)
  assert.equal(new URL(valid.headers.get('location')).hash, `#invite=${'a'.repeat(48)}`)
})
