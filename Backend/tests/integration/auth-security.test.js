import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { csrfProtection } from '../../config/security.js'
import { signSession } from '../../config/session.js'

const cookieFrom = (response) => (response.headers.getSetCookie?.() || [])
  .map((value) => value.split(';')[0]).join('; ')
const tokenFromCookie = (cookie) => cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1]
const linkToken = (message, pattern) => message.text.match(new RegExp(`${pattern}([a-f0-9]{64})`))?.[1]
const waitForMailbox = async (api, length) => {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (api.mailbox.length >= length) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Expected ${length} email(s), received ${api.mailbox.length}`)
}
const request = (api, method, path, body, cookie, headers = {}) => fetch(`${api.base}${path}`, {
  method,
  headers: {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    // A browser sends the origin on every state changing request, and the
    // origin check applies in every environment.
    Origin: 'http://localhost:5173',
    ...(cookie ? { Cookie: cookie } : {}),
    ...headers
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
})

const pauseUserRead = (t, method, matches) => {
  const reached = Promise.withResolvers()
  const resume = Promise.withResolvers()
  const original = UserModel[method]
  let paused = false
  t.mock.method(UserModel, method, function (...args) {
    const query = original.apply(this, args)
    const exec = query.exec
    query.exec = async function (...execArgs) {
      const user = await exec.apply(this, execArgs)
      if (!paused && matches(user)) {
        paused = true
        reached.resolve()
        await resume.promise
      }
      return user
    }
    return query
  })
  return { reached: reached.promise, release: resume.resolve }
}

test('sessions are bounded, database-backed and revocable', async (t) => {
  const api = await testApi(t)
  const created = await api.request('POST', '/auth/register', {
    name: 'Session user', email: 'session@example.test', password: 'Attacker password 123!'
  })
  assert.equal(created.status, 201)
  const user = await UserModel.findOne({ email: 'session@example.test' })
  assert.equal(user.emailVerified, false)
  assert.equal(JSON.stringify(created.data).includes('verify-email'), false)

  const unverifiedLogin = await api.request('POST', '/auth/login', {
    email: 'session@example.test', password: 'Attacker password 123!'
  })
  assert.equal(unverifiedLogin.status, 403)
  assert.equal(unverifiedLogin.data.message, 'Verify your email before signing in')

  await waitForMailbox(api, 1)
  const originalHash = (await UserModel.findById(user._id).select('+emailVerificationHash')).emailVerificationHash
  assert.equal((await api.request('POST', '/auth/register', {
    name: 'Session user', email: 'session@example.test', password: 'Another password 123!'
  })).status, 201)
  assert.equal((await api.request('POST', '/auth/resend-verification', {
    email: 'session@example.test'
  })).status, 200)
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(api.mailbox.length, 1)
  assert.equal((await UserModel.findById(user._id).select('+emailVerificationHash')).emailVerificationHash,
    originalHash)
  const verifyToken = linkToken(api.mailbox[0], 'verify-email#token=')
  assert.match(verifyToken, /^[a-f0-9]{64}$/)
  assert.equal((await api.request('POST', '/auth/verify-email', {
    token: verifyToken, password: 'Victim chosen 456!'
  })).status, 200)
  assert.equal((await UserModel.findById(user._id)).emailVerified, true)
  // The pre-registration password is gone; verification claims the credential.
  assert.equal((await api.request('POST', '/auth/login', {
    email: 'session@example.test', password: 'Attacker password 123!'
  })).status, 401)
  assert.equal((await api.request('POST', '/auth/verify-email', {
    token: verifyToken, password: 'Replay password 789!'
  })).status, 400)

  const login = await api.request('POST', '/auth/login', {
    email: 'session@example.test', password: 'Victim chosen 456!'
  })
  assert.equal(login.status, 200)
  const cookie = cookieFrom(login)
  assert.match(cookie, /^token=/)
  const rawCookie = login.headers.getSetCookie()[0]
  assert.match(rawCookie, /HttpOnly/i)
  assert.match(rawCookie, /SameSite=Lax/i)
  assert.match(rawCookie, /Max-Age=604800/)
  const token = tokenFromCookie(cookie)
  const claims = jwt.decode(token)
  assert.equal(claims.ver, 1)
  assert.equal(claims.iss, 'kanvora')
  assert.equal(claims.aud, 'kanvora-web')
  assert.ok(claims.exp > claims.iat)
  assert.ok(claims.exp - claims.iat <= 8 * 24 * 60 * 60)

  assert.equal((await request(api, 'PUT', '/auth/profile', { name: 'Session renamed' }, cookie)).status, 200)

  const legacy = jwt.sign({ id: String(user._id), email: user.email, role: user.role }, process.env.SECRET_KEY)
  assert.equal((await request(api, 'PUT', '/auth/profile', { name: 'Legacy' }, `token=${legacy}`)).status, 401)
  const expired = jwt.sign({ id: String(user._id), email: user.email, role: user.role, ver: 1 },
    process.env.SECRET_KEY, { expiresIn: -1, issuer: 'kanvora', audience: 'kanvora-web' })
  assert.equal((await request(api, 'PUT', '/auth/profile', { name: 'Expired' }, `token=${expired}`)).status, 401)

  const wrong = await api.request('POST', '/auth/login', { email: 'session@example.test', password: 'wrong-password' })
  const missing = await api.request('POST', '/auth/login', { email: 'absent@example.test', password: 'wrong-password' })
  assert.equal(wrong.status, 401)
  assert.equal(missing.status, 401)
  assert.equal(wrong.data.message, missing.data.message)

  assert.equal((await request(api, 'POST', '/auth/logout', undefined, cookie)).status, 200)
  assert.equal((await UserModel.findById(user._id)).sessionVersion, 2)
  assert.equal((await request(api, 'PUT', '/auth/profile', { name: 'After logout' }, cookie)).status, 401)
  const checked = await api.request('GET', '/auth/check-auth', undefined, token)
  assert.equal(checked.status, 200)
  assert.equal(checked.data.payload, null)
})

test('email verification and password recovery use hashed single-use tokens', async (t) => {
  const api = await testApi(t)
  await api.request('POST', '/auth/register', {
    name: 'Recovery user', email: 'recovery@example.test', password: 'Synthetic password 123!'
  })
  const user = await UserModel.findOne({ email: 'recovery@example.test' })
  await waitForMailbox(api, 1)
  assert.equal(JSON.stringify(api.mailbox[0]).includes(user._id.toString()), false)
  const verifyToken = linkToken(api.mailbox[0], 'verify-email#token=')
  assert.match(verifyToken, /^[a-f0-9]{64}$/)
  assert.equal((await UserModel.findById(user._id).select('+emailVerificationHash')).emailVerificationHash,
    (await import('node:crypto')).createHash('sha256').update(verifyToken).digest('hex'))

  assert.equal((await api.request('POST', '/auth/verify-email', {
    token: verifyToken, password: 'Synthetic password 123!'
  })).status, 200)
  assert.equal((await UserModel.findById(user._id)).emailVerified, true)
  assert.equal((await api.request('POST', '/auth/verify-email', {
    token: verifyToken, password: 'Replay password 456!'
  })).status, 400)

  const before = api.mailbox.length
  const unknown = await api.request('POST', '/auth/forgot-password', { email: 'absent@example.test' })
  assert.equal(unknown.status, 200)
  assert.equal(api.mailbox.length, before)

  const login = await api.request('POST', '/auth/login', {
    email: 'recovery@example.test', password: 'Synthetic password 123!'
  })
  const oldCookie = cookieFrom(login)
  const forgot = await api.request('POST', '/auth/forgot-password', { email: 'recovery@example.test' })
  assert.equal(forgot.status, 200)
  await waitForMailbox(api, 2)
  const resetToken = linkToken(api.mailbox.at(-1), 'reset-password#token=')
  assert.match(resetToken, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(forgot.data).includes(resetToken), false)
  assert.equal(api.mailbox.at(-1).text.includes(resetToken), true)

  const concurrent = await Promise.all([1, 2].map(() =>
    api.request('POST', '/auth/reset-password', { token: resetToken, password: 'Changed password 456!' })))
  assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 400])
  assert.equal((await request(api, 'PUT', '/auth/profile', { name: 'Revoked' }, oldCookie)).status, 401)
  assert.equal((await api.request('POST', '/auth/reset-password', { token: resetToken, password: 'Another password 789!' })).status, 400)
  assert.equal((await api.request('POST', '/auth/login', { email: 'recovery@example.test', password: 'Synthetic password 123!' })).status, 401)
  const relogin = await api.request('POST', '/auth/login', { email: 'recovery@example.test', password: 'Changed password 456!' })
  assert.equal(relogin.status, 200)
  const currentCookie = cookieFrom(relogin)

  // A password change must revoke reset links issued before the change.
  await api.request('POST', '/auth/forgot-password', { email: 'recovery@example.test' })
  await waitForMailbox(api, 3)
  const staleReset = linkToken(api.mailbox.at(-1), 'reset-password#token=')
  const changed = await request(api, 'PUT', '/auth/change-password', {
    oldPassword: 'Changed password 456!', newPassword: 'Third password 789!'
  }, currentCookie)
  assert.equal(changed.status, 200)
  assert.equal((await api.request('POST', '/auth/reset-password', {
    token: staleReset, password: 'Attacker reset 000!'
  })).status, 400)
  assert.equal((await request(api, 'PUT', '/auth/profile', { name: 'Stale' }, currentCookie)).status, 401)
  const newerCookie = cookieFrom(changed)
  assert.equal((await request(api, 'PUT', '/auth/profile', { name: 'Current' }, newerCookie)).status, 200)
})

test('an old-password login during reset cannot acquire a surviving session', { timeout: 15000 }, async (t) => {
  const api = await testApi(t)
  const token = randomBytes(32).toString('hex')
  const user = await UserModel.create({
    name: 'Reset race user', email: 'reset-race@example.test',
    password: await bcrypt.hash('Old password 123!', 11), emailVerified: true,
    passwordResetHash: createHash('sha256').update(token).digest('hex'),
    passwordResetExpiresAt: new Date(Date.now() + 60000)
  })
  const oldSession = signSession(user)
  const committed = Promise.withResolvers()
  const resume = Promise.withResolvers()
  const findOneAndUpdate = UserModel.findOneAndUpdate
  t.mock.method(UserModel, 'findOneAndUpdate', function (...args) {
    const query = findOneAndUpdate.apply(this, args)
    const exec = query.exec
    query.exec = async function (...execArgs) {
      const result = await exec.apply(this, execArgs)
      if (args[0].passwordResetHash) {
        committed.resolve()
        await resume.promise
      }
      return result
    }
    return query
  })
  const reset = api.request('POST', '/auth/reset-password', { token, password: 'New password 456!' })
  let racingLogin
  try {
    await committed.promise
    racingLogin = await api.request('POST', '/auth/login', {
      email: user.email, password: 'Old password 123!'
    })
  } finally {
    resume.resolve()
    await reset
  }
  assert.equal((await reset).status, 200)
  assert.equal((await api.request('GET', '/auth/check-auth', undefined, oldSession)).data.payload, null)
  assert.ok([200, 401].includes(racingLogin.status))
  if (racingLogin.status === 200) {
    const racingToken = tokenFromCookie(cookieFrom(racingLogin))
    assert.ok(racingToken)
    assert.equal((await api.request('GET', '/auth/check-auth', undefined, racingToken)).data.payload, null,
      'a session obtained with the old password must not survive the reset')
  }
  assert.equal((await api.request('POST', '/auth/login', {
    email: user.email, password: 'New password 456!'
  })).status, 200)
  assert.equal((await UserModel.findById(user._id)).sessionVersion, 1)
})

for (const invalidation of ['logout', 'reset']) {
  test(`a password change rejects a credential snapshot invalidated by ${invalidation}`, { timeout: 15000 }, async (t) => {
    const api = await testApi(t)
    const token = randomBytes(32).toString('hex')
    const user = await UserModel.create({
      name: 'Credential race', email: 'credential-race@example.test', emailVerified: true,
      password: await bcrypt.hash('Old password 123!', 11),
      passwordResetHash: createHash('sha256').update(token).digest('hex'),
      passwordResetExpiresAt: new Date(Date.now() + 60000)
    })
    const session = signSession(user)
    const barrier = pauseUserRead(t, 'findById', (snapshot) => Boolean(snapshot?.password))
    const change = api.request('PUT', '/auth/change-password', {
      oldPassword: 'Old password 123!', newPassword: 'Stale password 789!'
    }, session)
    let racingLogin
    const currentPassword = invalidation === 'reset' ? 'Reset password 456!' : 'Old password 123!'
    try {
      await barrier.reached
      const revoked = invalidation === 'reset'
        ? await api.request('POST', '/auth/reset-password', { token, password: currentPassword })
        : await api.request('POST', '/auth/logout', undefined, session)
      assert.equal(revoked.status, 200)
      racingLogin = await api.request('POST', '/auth/login', { email: user.email, password: currentPassword })
      assert.equal(racingLogin.status, 200)
    } finally {
      barrier.release()
      await change
    }
    assert.equal((await change).status, 401, 'a revoked password-change operation must not write credentials')
    assert.equal(cookieFrom(await change), '')
    const stored = await UserModel.findById(user._id).select('+password')
    assert.equal(stored.sessionVersion, 1)
    assert.equal(await bcrypt.compare(currentPassword, stored.password), true)
    assert.equal((await api.request('GET', '/auth/check-auth', undefined, session)).data.payload, null)
    const racingToken = tokenFromCookie(cookieFrom(racingLogin))
    assert.ok((await api.request('GET', '/auth/check-auth', undefined, racingToken)).data.payload)
  })
}

test('Google linking increments the current version after concurrent logout', { timeout: 15000 }, async (t) => {
  const api = await testApi(t)
  const { resolveGoogleUser } = await import('../../APIs/OAuthAPI.js')
  const user = await UserModel.create({
    name: 'Google race', email: 'google-race@example.test', emailVerified: true,
    password: await bcrypt.hash('Old password 123!', 11)
  })
  const session = signSession(user)
  const barrier = pauseUserRead(t, 'findOne', (snapshot) => snapshot?.email === user.email)
  const linking = resolveGoogleUser({ email: user.email, email_verified: true, sub: 'race-sub' })
  let racingToken
  try {
    await barrier.reached
    assert.equal((await api.request('POST', '/auth/logout', undefined, session)).status, 200)
    const login = await api.request('POST', '/auth/login', { email: user.email, password: 'Old password 123!' })
    assert.equal(login.status, 200)
    racingToken = tokenFromCookie(cookieFrom(login))
    assert.ok(racingToken)
  } finally {
    barrier.release()
  }
  const linked = await linking
  assert.equal(linked.user.sessionVersion, 2)
  assert.equal((await UserModel.findById(user._id)).sessionVersion, 2)
  assert.equal((await api.request('GET', '/auth/check-auth', undefined, racingToken)).data.payload, null)
})

test('concurrent Google linking cannot overwrite a different identity', { timeout: 15000 }, async (t) => {
  await testApi(t)
  const { resolveGoogleUser } = await import('../../APIs/OAuthAPI.js')
  const user = await UserModel.create({
    name: 'Identity race', email: 'identity-race@example.test', emailVerified: true,
    password: 'synthetic-password'
  })
  const barrier = pauseUserRead(t, 'findOne', (snapshot) => snapshot?.email === user.email)
  const linking = resolveGoogleUser({ email: user.email, email_verified: true, sub: 'stale-sub' })
  const rejected = assert.rejects(linking, (error) => error.status === 409)
  try {
    await barrier.reached
    const winner = await resolveGoogleUser({ email: user.email, email_verified: true, sub: 'winning-sub' })
    assert.equal(winner.user.googleSub, 'winning-sub')
  } finally {
    barrier.release()
  }
  await rejected
  const stored = await UserModel.findById(user._id).select('+googleSub')
  assert.equal(stored.googleSub, 'winning-sub')
  assert.equal(stored.sessionVersion, 1)
})

test('Google identities link only to verified accounts and never use known passwords', async (t) => {
  await testApi(t)
  const { resolveGoogleUser } = await import('../../APIs/OAuthAPI.js')
  await assert.rejects(() => resolveGoogleUser({ email: 'google@example.test', email_verified: false, sub: 'g-1' }),
    (error) => error.status === 401)

  const created = await resolveGoogleUser({ email: 'google@example.test', email_verified: true, sub: 'g-1', name: 'Google User' })
  assert.equal(created.user.emailVerified, true)
  assert.equal(created.user.googleSub, 'g-1')
  assert.equal(created.created, true)

  const unverified = await UserModel.create({ name: 'Unverified', email: 'unverified-google@example.test', password: 'synthetic-password', emailVerified: false })
  await assert.rejects(() => resolveGoogleUser({ email: unverified.email, email_verified: true, sub: 'g-2' }),
    (error) => error.status === 409)
  assert.equal((await UserModel.findById(unverified._id)).googleSub, undefined)

  const verified = await UserModel.create({ name: 'Verified', email: 'verified-google@example.test', password: 'synthetic-password', emailVerified: true })
  const linked = await resolveGoogleUser({ email: verified.email, email_verified: true, sub: 'g-3' })
  assert.equal(linked.created, false)
  assert.equal(String(linked.user._id), String(verified._id))
  assert.equal(linked.user.googleSub, 'g-3')
  assert.equal(linked.user.sessionVersion, 1)
  await assert.rejects(() => resolveGoogleUser({ email: verified.email, email_verified: true, sub: 'different' }),
    (error) => error.status === 409)
})

test('unsafe cookie-authenticated requests reject untrusted browser origins', async () => {
  const invoke = (headers = {}, options = { requireOrigin: false }) => new Promise((resolve) => {
    const req = { method: 'POST', headers, cookies: { token: 'present' }, get(name) { return headers[name.toLowerCase()] } }
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(body) { resolve({ status: this.statusCode, body }) }
    }
    csrfProtection(['http://localhost:5173'], options)(req, res, () => resolve({ status: 200 }))
  })
  assert.equal((await invoke({ origin: 'https://attacker.example' })).status, 403)
  assert.equal((await invoke({ origin: 'http://localhost:5173' })).status, 200)
  assert.equal((await invoke({})).status, 200)
  assert.equal((await invoke({}, { requireOrigin: true })).status, 403)
  assert.equal((await invoke({ referer: 'https://attacker.example/page' })).status, 403)
  assert.equal((await invoke({ referer: 'http://localhost:5173/login' })).status, 200)
})
