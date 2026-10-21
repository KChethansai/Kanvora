// The origin of a state changing request is required in every environment:
// a cookie authenticated request that arrives without one is refused unless
// the deployment opts out explicitly.
import test from 'node:test'
import assert from 'node:assert/strict'

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_URL: 'mongodb://127.0.0.1:1/kanvora_test',
  SECRET_KEY: 'synthetic-test-key-only',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: ''
})

const allowedOrigins = ['http://localhost:5173']

const invoke = (middleware, { method = 'POST', headers = {}, cookies = {} } = {}) => new Promise((resolve) => {
  const req = {
    method,
    get: (name) => headers[name.toLowerCase()],
    cookies
  }
  const res = {
    status(code) { resolve({ status: code }); return res },
    json() { return res }
  }
  middleware(req, res, () => resolve({ status: 200 }))
})

test('a cookie authenticated write without an origin is refused by default', async () => {
  const { csrfProtection } = await import('../config/security.js')
  const middleware = csrfProtection(allowedOrigins)

  // The test environment is not production, and the requirement applies there
  // too: a request that carries the session cookie must come from the browser
  // application, which always sends an origin.
  assert.equal((await invoke(middleware, { cookies: { token: 'session' } })).status, 403)
  assert.equal((await invoke(middleware, { headers: { referer: '' }, cookies: { token: 'session' } })).status, 403)
})

test('an environment that needs an origin less client can opt out explicitly', async () => {
  const { csrfProtection } = await import('../config/security.js')
  const middleware = csrfProtection(allowedOrigins, { requireOrigin: false })
  assert.equal((await invoke(middleware, { cookies: { token: 'session' } })).status, 200)
})

test('a request without a session cookie is not blocked by the origin rule', async () => {
  const { csrfProtection } = await import('../config/security.js')
  const middleware = csrfProtection(allowedOrigins)
  // A non-browser client without a cookie is not a cross site request.
  assert.equal((await invoke(middleware)).status, 200)
})

test('an allowed origin passes and a foreign origin is denied', async () => {
  const { csrfProtection } = await import('../config/security.js')
  const middleware = csrfProtection(allowedOrigins)
  assert.equal((await invoke(middleware, { headers: { origin: 'http://localhost:5173' }, cookies: { token: 'session' } })).status, 200)
  assert.equal((await invoke(middleware, { headers: { origin: 'https://attacker.example' }, cookies: { token: 'session' } })).status, 403)
  assert.equal((await invoke(middleware, { headers: { referer: 'http://localhost:5173/board' }, cookies: { token: 'session' } })).status, 200)
})

test('a safe method never needs an origin', async () => {
  const { csrfProtection } = await import('../config/security.js')
  const middleware = csrfProtection(allowedOrigins)
  assert.equal((await invoke(middleware, { method: 'GET', cookies: { token: 'session' } })).status, 200)
  assert.equal((await invoke(middleware, { method: 'HEAD', cookies: { token: 'session' } })).status, 200)
})
