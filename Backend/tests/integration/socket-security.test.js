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
  const token = jwt.sign({ id: String(user._id) }, process.env.SECRET_KEY, { expiresIn: 2 })
  const { socket } = await open(t, api.base, token)
  assert.equal((await send(socket, 'join-project', String(project._id))).ok, true)
  const { revokeProjectAccess, revokeUserAccess } = await import('../../socket.js')
  revokeProjectAccess(String(project._id), String(user._id))
  assert.equal(api.io.sockets.sockets.get(socket.id).rooms.has(`project:${project._id}`), false)
  await delay(2200)
  assert.equal(socket.connected, false)
  const second = (await open(t, api.base, await api.tokenFor(user))).socket
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
  const exists = UserModel.exists.bind(UserModel)
  const lookup = t.mock.method(UserModel, 'exists', (...args) => exists(...args))
  const results = []
  for (let index = 0; index < 30; index++) results.push(await send(socket, 'join-project', project.id))
  await delay(40)
  assert.equal(presenceUpdates, 0, 'duplicate authorized joins must not amplify presence broadcasts')
  assert.ok(results.some((result) => result.ok), 'ordinary duplicate joins remain safe to acknowledge')
  assert.ok(results.some((result) => result.ok === false), 'admission budget rejects excess requests')
  assert.ok(lookup.mock.callCount() <= 20, 'per-socket budget bounds sequential authorization work')
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
  const exists = UserModel.exists.bind(UserModel)
  let inFlight = 0
  let peak = 0
  t.mock.method(UserModel, 'exists', async (...args) => {
    inFlight++
    peak = Math.max(peak, inFlight)
    try {
      await delay(80)
      return await exists(...args)
    } finally {
      inFlight--
    }
  })
  const singleResults = await Promise.all(Array.from({ length: 25 }, () => send(sockets[0], 'join-project', project.id)))
  assert.ok(peak <= 2, `one socket started ${peak} simultaneous authorization lookups`)
  assert.ok(singleResults.some((result) => result.ok))
  assert.ok(singleResults.some((result) => !result.ok && !result.timeout))
  await delay(1100)
  peak = 0
  const results = await Promise.all(sockets.flatMap((socket) => Array.from({ length: 25 }, () => send(socket, 'join-project', project.id))))
  assert.ok(peak <= 4, `one user started ${peak} simultaneous authorization lookups`)
  assert.ok(results.some((result) => result.ok))
  assert.ok(results.some((result) => !result.ok && !result.timeout))
})

test('shared-user admission budget cannot be multiplied by opening more sockets', async (t) => {
  const api = await testApi(t)
  const user = await UserModel.create({ name: 'Budget User', email: 'budget@example.test', password: 'synthetic-password' })
  const project = await projectModel.create({ name: 'Budget', creatorId: user._id })
  const token = await api.tokenFor(user)
  const sockets = await Promise.all(Array.from({ length: 3 }, async () => (await open(t, api.base, token)).socket))
  const now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const exists = UserModel.exists.bind(UserModel)
  const lookup = t.mock.method(UserModel, 'exists', (...args) => exists(...args))
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
  const exists = UserModel.exists.bind(UserModel)
  const lookup = t.mock.method(UserModel, 'exists', (...args) => exists(...args))
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
