// A board that can no longer be read must not keep a live socket room: the
// clients that joined it are evicted when the board is deleted.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { io as connect } from 'socket.io-client'

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_URL: 'mongodb://127.0.0.1:1/kanvora_test',
  SECRET_KEY: 'synthetic-test-key-only',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: ''
})

const userId = 'a'.repeat(24)
const projectId = 'b'.repeat(24)
const origin = 'http://localhost:5173'

const receive = (socket, event, wait = 400) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), wait)
  socket.once(event, (payload) => {
    clearTimeout(timer)
    resolve(payload)
  })
})

test('deleting a board evicts the sockets that joined it', async (t) => {
  const { init, getIO } = await import('../socket.js')
  const { deleteProject } = await import('../APIs/ProjectsAPI.js')
  const { signSession } = await import('../config/session.js')
  const { UserModel } = await import('../models/usermodel.js')
  const { projectModel } = await import('../models/ProjectModel.js')

  const board = {
    _id: projectId,
    name: 'Roadmap',
    title: 'Roadmap',
    status: true,
    archivedAt: null,
    workspace: null,
    creatorId: userId,
    members: [userId],
    membershipVersion: 1,
    directGrants: [],
    save: async () => {}
  }
  t.mock.method(UserModel, 'findById', () => ({
    select: () => ({ lean: async () => ({ _id: userId, name: 'Owner', profilePic: '', sessionVersion: 0 }) })
  }))
  t.mock.method(projectModel, 'findById', () => ({ session: () => board }))

  const server = createServer()
  const io = init(server)
  t.after(() => new Promise((resolve) => io.close(resolve)))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`

  const socket = connect(base, {
    transports: ['websocket'], reconnection: false, timeout: 1500,
    auth: { token: signSession({ _id: userId, role: 'MANAGER' }) },
    extraHeaders: { Origin: origin }
  })
  t.after(() => socket.disconnect())
  await new Promise((resolve) => {
    socket.once('connect', resolve)
    socket.once('connect_error', resolve)
  })
  assert.equal(socket.connected, true, 'the socket must connect')

  const joined = await new Promise((resolve) => {
    socket.timeout(1500).emit('join-project', projectId, (error, result) => resolve(error ? null : result))
  })
  assert.deepEqual(joined, { ok: true }, 'the socket must be admitted to the board room')

  // The room is live: the board reaches its members.
  const before = receive(socket, 'card-updated')
  getIO().to(`project:${projectId}`).emit('card-updated', { _id: 'card-1' })
  assert.ok(await before, 'the joined socket receives the board traffic')

  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this }
  }
  await deleteProject({ params: { id: projectId }, user: { id: userId } }, res, (err) => { throw err })
  assert.equal(res.statusCode, 200)

  // The room is gone: a deleted board reaches nobody.
  const after = receive(socket, 'card-updated')
  getIO().to(`project:${projectId}`).emit('card-updated', { _id: 'card-2' })
  assert.equal(await after, null, 'the evicted socket receives nothing from the deleted board')
  await delay(50)
})
