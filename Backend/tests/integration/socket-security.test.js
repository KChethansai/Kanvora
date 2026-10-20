import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { once } from 'node:events'
import { io as connect } from 'socket.io-client'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { projectModel } from '../../models/ProjectModel.js'
import { taskModel } from '../../models/Taskmodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { ListModel } from '../../models/ListModel.js'

const origin = 'http://localhost:5173'
const open = async (t, base, token, headers = { Origin: origin }) => {
  const socket = connect(base, {
    transports: ['websocket'], reconnection: false, timeout: 1500,
    auth: token ? { token } : {}, extraHeaders: headers
  })
  t.after(() => socket.disconnect())
  return new Promise((resolve) => {
    socket.once('connect', () => resolve({ socket }))
    socket.once('connect_error', (error) => resolve({ socket, error }))
  })
}
const send = (socket, event, ...args) => new Promise((resolve) => {
  socket.timeout(1500).emit(event, ...args, (error, result) => resolve(error ? { ok: false, timeout: true } : result))
})
const measureUserLookups = (t, wait = 80, handshakeOnly = false) => {
  const findById = UserModel.findById.bind(UserModel)
  const measured = { count: 0, inFlight: 0, peak: 0 }
  t.mock.method(UserModel, 'findById', (...args) => ({
    select(fields) {
      const query = findById(...args).select(fields)
      return { lean: async () => {
        if (handshakeOnly && !fields.includes('_id')) return query.lean()
        measured.count++
        measured.inFlight++
        measured.peak = Math.max(measured.peak, measured.inFlight)
        try {
          await delay(wait)
          return await query.lean()
        } finally {
          measured.inFlight--
        }
      } }
    }
  }))
  return measured
}

test('socket admission rejects anonymous, invalid, deleted-user and untrusted-origin connections', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Socket Owner', email: 'socket@example.test', password: 'synthetic-password' })
  const token = await api.tokenFor(user)
  for (const candidate of [undefined, 'invalid',
    jwt.sign({ id: String(user._id) }, 'incorrect-signing-key'),
    jwt.sign({ id: String(user._id) }, process.env.SECRET_KEY, { expiresIn: -1 }),
    jwt.sign({ id: String(user._id) }, process.env.SECRET_KEY, { algorithm: 'HS384' }),
    jwt.sign({ id: String(new mongoose.Types.ObjectId()) }, process.env.SECRET_KEY)]) {
    const { error, socket } = await open(t, api.base, candidate)
    assert.ok(error, 'unauthenticated socket must not connect')
    assert.equal(socket.connected, false)
  }
  for (const headers of [{ Origin: 'https://attacker.example' }, {}]) {
    assert.ok((await open(t, api.base, token, headers)).error)
  }
  assert.equal((await open(t, api.base, token)).socket.connected, true)
  assert.equal((await open(t, api.base, undefined, { Origin: origin, Cookie: `token=${token}` })).socket.connected, true)
})

test('rooms, presence and typing use current authorization and server identity; forged activity is ignored', async (t) => {
  const api = await testApi(t)
  const [owner, member, outsider] = await UserModel.create([
    { name: 'Owner Name', email: 'owner@example.test', password: 'synthetic-password' },
    { name: 'Member Name', email: 'member@example.test', password: 'synthetic-password' },
    { name: 'Other Name', email: 'other@example.test', password: 'synthetic-password' }
  ])
  const workspace = await WorkspaceModel.create({ name: 'Private workspace', owner: owner._id,
    members: [{ user: member._id, role: 'MEMBER' }] })
  const project = await projectModel.create({ name: 'Private', workspace: workspace._id, creatorId: owner._id, members: [member._id] })
  const other = await projectModel.create({ name: 'Other', creatorId: outsider._id })
  const list = await ListModel.create({ title: 'Private list', projectId: project._id })
  const otherList = await ListModel.create({ title: 'Other list', projectId: other._id })
  const card = await taskModel.create({ title: 'Card', listId: list._id, projectId: project._id, creatorId: owner._id })
  const otherCard = await taskModel.create({ title: 'Other card', listId: otherList._id, projectId: other._id, creatorId: outsider._id })
  const [a, b, c] = await Promise.all([owner, member, outsider].map(async (user) => (await open(t, api.base, await api.tokenFor(user))).socket))
  const room = `project:${project._id}`
  assert.ok(api.io.sockets.sockets.get(c.id).rooms.has(`user:${outsider._id}`))
  assert.equal((await send(c, 'join-user', String(owner._id))).ok, false)
  assert.equal((await send(c, 'join-project', String(project._id))).ok, false)
  for (const id of [null, {}, 'x'.repeat(10000)]) assert.equal((await send(a, 'join-project', id)).ok, false)
  assert.equal((await send(a, 'join-project', String(project._id), { _id: outsider._id, name: 'Forged' })).ok, true)
  let presence
  a.on('presence-updated', (value) => { presence = value })
  assert.equal((await send(b, 'join-project', String(project._id))).ok, true)
  await delay(40)
  assert.deepEqual(presence.users.map((user) => user.name).sort(), ['Member Name', 'Owner Name'])
  let typed = []
  b.on('typing-started', (value) => typed.push(value))
  const payload = { room, cardId: String(card._id), user: { _id: outsider._id, name: 'Forged' } }
  assert.equal((await send(a, 'typing-start', payload)).ok, true)
  await delay(40)
  assert.equal(typed[0].user._id, String(owner._id))
  assert.equal(typed[0].user.name, owner.name)
  assert.equal((await send(a, 'typing-start', { ...payload, cardId: String(otherCard._id) })).ok, false)
  assert.equal((await send(a, 'typing-start', { ...payload, projectId: String(project._id), room: `user:${outsider._id}` })).ok, true)
  let stopped
  b.once('typing-stopped', (value) => { stopped = value })
  assert.equal((await send(a, 'typing-stop', payload)).ok, true)
  await delay(40)
  assert.equal(stopped.user._id, String(owner._id))
  assert.equal((await send(c, 'typing-start', payload)).ok, false)
  assert.equal((await send(a, 'typing-start', null)).ok, false)
  let activities = 0
  b.on('activity-created', () => { activities++ })
  a.emit('activity-created', { room, activity: { message: 'Forged' } })
  await delay(60)
  assert.equal(activities, 0)
  api.io.to(room).emit('activity-created', { message: 'Persisted activity' })
  await delay(40)
  assert.equal(activities, 1, 'server-side persisted activity broadcasts remain available')
  typed = []
  for (let index = 0; index < 35; index++) a.emit('typing-start', payload)
  await delay(200)
  assert.ok(typed.length <= 20, 'typing broadcasts are bounded per socket')
  await WorkspaceModel.updateOne({ _id: workspace._id }, { $pull: { members: { user: member._id } } })
  assert.equal((await send(b, 'typing-start', payload)).ok, false)
  assert.equal(api.io.sockets.sockets.get(b.id).rooms.has(room), false)
  await delay(40)
  assert.deepEqual(presence.users.map((user) => user._id), [String(owner._id)])
  assert.equal((await send(a, 'leave-project', String(project._id))).ok, true)
  assert.equal(api.io.sockets.sockets.get(a.id).rooms.has(room), false)
  assert.equal(api.io.sockets.adapter.rooms.has(room), false)
  await projectModel.updateOne({ _id: project._id }, { $set: { status: false } })
  assert.equal((await send(a, 'join-project', String(project._id))).ok, false)
})

test('expiring tokens disconnect and explicit access-revocation hooks remove existing sockets', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Expiry User', email: 'expiry@example.test', password: 'synthetic-password' })
  const project = await projectModel.create({ name: 'Revocation', creatorId: user._id })
  const token = jwt.sign({ id: String(user._id), email: user.email, role: user.role, ver: 0 },
    process.env.SECRET_KEY, { expiresIn: 2, issuer: 'kanvora', audience: 'kanvora-web' })
  const { socket } = await open(t, api.base, token)
  assert.equal((await send(socket, 'join-project', String(project._id))).ok, true)
  const { revokeProjectAccess, revokeUserAccess } = await import('../../socket.js')
  revokeProjectAccess(String(project._id), String(user._id))
  assert.equal(api.io.sockets.sockets.get(socket.id).rooms.has(`project:${project._id}`), false)
  await delay(2200)
  assert.equal(socket.connected, false)
  const second = (await open(t, api.base, await api.tokenFor(user))).socket
  const third = (await open(t, api.base, await api.tokenFor(user))).socket
  await UserModel.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } })
  assert.equal((await send(third, 'join-project', String(project._id))).ok, false)
  await delay(40)
  assert.equal(third.connected, false)
  revokeUserAccess(String(user._id))
  await delay(40)
  assert.equal(second.connected, false)
})

test('repeated joins have bounded authorization work and do not rebroadcast unchanged presence', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Repeat User', email: 'repeat@example.test', password: 'synthetic-password' })
  const project = await projectModel.create({ name: 'Repeated joins', creatorId: user._id })
  const socket = (await open(t, api.base, await api.tokenFor(user))).socket
  assert.equal((await send(socket, 'join-project', project.id)).ok, true)
  let presenceUpdates = 0
  socket.on('presence-updated', () => { presenceUpdates++ })
  const findById = UserModel.findById.bind(UserModel)
  let lookups = 0
  t.mock.method(UserModel, 'findById', (...args) => {
    lookups++
    return findById(...args)
  })
  const results = []
  for (let index = 0; index < 30; index++) results.push(await send(socket, 'join-project', project.id))
  await delay(40)
  assert.equal(presenceUpdates, 0, 'duplicate authorized joins must not amplify presence broadcasts')
  assert.ok(results.some((result) => result.ok), 'ordinary duplicate joins remain safe to acknowledge')
  assert.ok(results.some((result) => result.ok === false), 'admission budget rejects excess requests')
  assert.ok(lookups <= 20, 'per-socket budget bounds sequential authorization work')
  await projectModel.updateOne({ _id: project._id }, { $set: { status: false } })
  await delay(1100)
  assert.equal((await send(socket, 'join-project', project.id)).ok, false)
  assert.equal(api.io.sockets.sockets.get(socket.id).rooms.has(`project:${project.id}`), false)
})

test('concurrent joins bound socket and shared-user in-flight authorization', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Concurrent User', email: 'concurrent@example.test', password: 'synthetic-password' })
  const project = await projectModel.create({ name: 'Concurrent joins', creatorId: user._id })
  const token = await api.tokenFor(user)
  const sockets = await Promise.all(Array.from({ length: 3 }, async () => (await open(t, api.base, token)).socket))
  await delay(100)
  const measured = measureUserLookups(t)
  const singleResults = await Promise.all(Array.from({ length: 25 }, () => send(sockets[0], 'join-project', project.id)))
  assert.equal(measured.peak, 2, 'real findById work must reach, but not exceed, the socket bound')
  assert.ok(singleResults.some((result) => result.ok))
  assert.ok(singleResults.some((result) => !result.ok && !result.timeout))
  await delay(1100)
  measured.peak = 0
  const results = await Promise.all(sockets.flatMap((socket) => Array.from({ length: 25 }, () => send(socket, 'join-project', project.id))))
  assert.equal(measured.peak, 4, 'real findById work must reach, but not exceed, the shared-user bound')
  assert.ok(results.some((result) => result.ok))
  assert.ok(results.some((result) => !result.ok && !result.timeout))
})

test('handshakes reserve socket capacity before DB work and release rejected and disconnected reservations', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Socket Cap', email: 'cap@example.test', password: 'synthetic-password' })
  const token = await api.tokenFor(user)
  const measured = measureUserLookups(t, 80, true)
  const initial = await Promise.all(Array.from({ length: 16 }, () => open(t, api.base, token)))
  assert.equal(measured.peak, 4, 'at most four pending handshakes per verified user may query the DB')
  assert.equal(measured.count, 4, 'excess parallel handshakes must not reach the DB')
  const sockets = initial.filter((result) => !result.error).map((result) => result.socket)
  assert.equal(sockets.length, 4)
  for (let index = 0; index < 4; index++) sockets.push((await open(t, api.base, token)).socket)
  assert.ok(sockets.every((socket) => socket.connected))
  const before = measured.count
  assert.ok((await open(t, api.base, token)).error)
  assert.equal(measured.count, before, 'eight connected sockets exhaust capacity without DB work')
  const disconnected = once(api.io.sockets.sockets.get(sockets[0].id), 'disconnect')
  sockets[0].disconnect()
  await disconnected
  assert.equal((await open(t, api.base, token)).socket.connected, true, 'disconnect frees capacity')
  const missingToken = await api.tokenFor({ _id: new mongoose.Types.ObjectId(), email: 'missing@example.test', role: 'USER' })
  const live = sockets.map((socket) => api.io.sockets.sockets.get(socket.id)).filter(Boolean)
  const closing = live.map((socket) => once(socket, 'disconnect'))
  live.forEach((socket) => socket.disconnect())
  await Promise.all(closing)
  await delay(1100)
  const beforeMissing = measured.count
  for (let index = 0; index < 9; index++) assert.ok((await open(t, api.base, missingToken)).error)
  assert.equal(measured.count, beforeMissing + 9, 'failed admissions must release both pending and connected reservations')
  const missingId = jwt.decode(missingToken).id
  await UserModel.create({ _id: missingId, name: 'Restored', email: 'restored@example.test', password: 'synthetic-password' })
  assert.equal((await open(t, api.base, missingToken)).socket.connected, true, 'failed admission releases reserved capacity')
})

test('handshake rate budget survives rejection and prevents DB work after its limit', async (t) => {
  const api = await testApi(t)
  const token = await api.tokenFor({ _id: new mongoose.Types.ObjectId(), email: 'absent@example.test', role: 'USER' })
  const now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const measured = measureUserLookups(t, 0, true)
  for (let index = 0; index < 25; index++) assert.ok((await open(t, api.base, token)).error)
  assert.equal(measured.count, 20, 'failed handshakes share a twenty-per-second DB authorization budget')
})

test('typing shares user rate and in-flight budgets before authorization and task queries', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Typing Budget', email: 'typing-budget@example.test', password: 'synthetic-password' })
  const project = await projectModel.create({ name: 'Typing', creatorId: user._id })
  const list = await ListModel.create({ title: 'Typing list', projectId: project._id })
  const card = await taskModel.create({ title: 'Typing card', listId: list._id, projectId: project._id, creatorId: user._id })
  const token = await api.tokenFor(user)
  const sockets = await Promise.all(Array.from({ length: 3 }, async () => (await open(t, api.base, token)).socket))
  for (const socket of sockets) assert.equal((await send(socket, 'join-project', project.id)).ok, true)
  await delay(100)
  let now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const measured = measureUserLookups(t, 20)
  const findById = taskModel.findById.bind(taskModel)
  const tasks = t.mock.method(taskModel, 'findById', (...args) => findById(...args))
  const payload = { projectId: project.id, cardId: card.id }
  const results = await Promise.all(sockets.flatMap((socket) => Array.from({ length: 20 }, () => send(socket, 'typing-start', payload))))
  assert.equal(measured.peak, 4, 'shared typing authorization reaches but cannot exceed four in flight')
  assert.ok(results.some((result) => result.ok))
  assert.ok(results.some((result) => !result.ok && !result.timeout))
  const before = [measured.count, tasks.mock.callCount()]
  assert.equal((await send(sockets[2], 'typing-stop', payload)).ok, false)
  assert.deepEqual([measured.count, tasks.mock.callCount()], before, 'exhausted shared rate budget must do no DB work')
  now += 1001
  measured.count = 0
  for (const socket of sockets) {
    for (let index = 0; index < 18; index++) await send(socket, 'typing-stop', payload)
  }
  assert.equal(measured.count, 40, 'sequential typing is capped at forty authorizations per user per second')
})

test('shared-user admission budget cannot be multiplied by opening more sockets', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Budget User', email: 'budget@example.test', password: 'synthetic-password' })
  const project = await projectModel.create({ name: 'Budget', creatorId: user._id })
  const token = await api.tokenFor(user)
  const sockets = await Promise.all(Array.from({ length: 3 }, async () => (await open(t, api.base, token)).socket))
  const now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const findById = UserModel.findById.bind(UserModel)
  const lookup = t.mock.method(UserModel, 'findById', (...args) => findById(...args))
  const results = []
  for (const socket of sockets) {
    for (let index = 0; index < 18; index++) results.push(await send(socket, 'join-project', project.id))
  }
  assert.equal(lookup.mock.callCount(), 40)
  assert.equal(results.filter((result) => result.ok).length, 40)
  assert.ok(results.every((result) => !result.timeout))
})

test('disconnecting every socket and reconnecting preserves the user budget until its window expires', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Reconnect User', email: 'reconnect@example.test', password: 'synthetic-password' })
  const project = await projectModel.create({ name: 'Reconnect budget', creatorId: user._id })
  const token = await api.tokenFor(user)
  let now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const sockets = await Promise.all(Array.from({ length: 2 }, async () => (await open(t, api.base, token)).socket))
  for (const socket of sockets) {
    for (let index = 0; index < 20; index++) assert.equal((await send(socket, 'join-project', project.id)).ok, true)
  }
  const disconnected = sockets.map((socket) => once(api.io.sockets.sockets.get(socket.id), 'disconnect'))
  sockets.forEach((socket) => socket.disconnect())
  await Promise.all(disconnected)
  assert.equal(api.io.sockets.sockets.size, 0)
  const reconnected = (await open(t, api.base, token)).socket
  const findById = UserModel.findById.bind(UserModel)
  const lookup = t.mock.method(UserModel, 'findById', (...args) => findById(...args))
  assert.equal((await send(reconnected, 'join-project', project.id)).ok, false)
  assert.equal(lookup.mock.callCount(), 0, 'reconnection cannot reset an exhausted user authorization budget')
  now += 1001
  assert.equal((await send(reconnected, 'join-project', project.id)).ok, true)
  assert.equal(lookup.mock.callCount(), 1, 'authorization resumes once the original window expires')
})

test('unique project rooms are bounded and leaving a board frees capacity', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Room User', email: 'rooms@example.test', password: 'synthetic-password' })
  const projects = await projectModel.create(Array.from({ length: 17 }, (_, index) => ({ name: `Board ${index}`, creatorId: user._id })))
  const socket = (await open(t, api.base, await api.tokenFor(user))).socket
  const now = Date.now()
  t.mock.method(Date, 'now', () => now)
  for (const project of projects.slice(0, 16)) assert.equal((await send(socket, 'join-project', project.id)).ok, true)
  assert.equal((await send(socket, 'join-project', projects[16].id)).ok, false)
  assert.equal(api.io.sockets.sockets.get(socket.id).rooms.size, 18, 'sixteen boards plus socket and personal rooms')
  assert.equal((await send(socket, 'leave-project', projects[0].id)).ok, true)
  assert.equal((await send(socket, 'join-project', projects[16].id)).ok, true)
})

test('linking a Google identity revokes sockets holding the pre-link session', async (t) => {
  const api = await testApi(t)
  const { resolveGoogleUser } = await import('../../APIs/OAuthAPI.js')
  const user = await UserModel.create({
    name: 'Google Link', email: 'google-link@example.test', password: 'synthetic-password', emailVerified: true
  })
  const socket = (await open(t, api.base, await api.tokenFor(user))).socket
  assert.equal(socket.connected, true)
  await resolveGoogleUser({ email: user.email, email_verified: true, sub: 'link-subject' })
  await delay(40)
  assert.equal(socket.connected, false)
})
