// Card attachment lifecycle.
//
// A private asset is uploaded to Cloudinary before its metadata is committed.
// Every path that does not commit the metadata has to delete the asset again,
// and deleting a card or a list has to take its comments and assets with it.
// The provider boundary is injected, so these paths run without a live account.
import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { setTimeout as delay } from 'node:timers/promises'
import { io as connect } from 'socket.io-client'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'
import { CommentModel } from '../../models/CommentModel.js'

// env.js caches the test environment at first import, and testApi sets that
// environment. The provider boundary is therefore imported after the fixture
// exists, never at module load.
const mediaStore = () => import('../../utils/mediaStore.js')

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const NOT_AN_IMAGE = Buffer.from('this is not an image at all')

const workspaceBoard = async () => {
  const owner = await UserModel.create({ name: 'Owner', email: `media-${new mongoose.Types.ObjectId()}@test.invalid`, password: 'synthetic-password' })
  const viewer = await UserModel.create({ name: 'Viewer', email: `media-viewer-${new mongoose.Types.ObjectId()}@test.invalid`, password: 'synthetic-password' })
  const member = await UserModel.create({ name: 'Member', email: `media-member-${new mongoose.Types.ObjectId()}@test.invalid`, password: 'synthetic-password' })
  const workspace = await WorkspaceModel.create({
    name: 'Media', owner: owner._id,
    members: [{ user: viewer._id, role: 'VIEWER' }, { user: member._id, role: 'MEMBER' }]
  })
  const project = await projectModel.create({
    name: 'Media board', workspace: workspace._id, creatorId: owner._id, members: [owner._id], isEditable: true
  })
  const list = await ListModel.create({ title: 'Backlog', projectId: project._id })
  const card = await taskModel.create({
    title: 'Photo task', listId: list._id, projectId: project._id, creatorId: owner._id
  })
  return { owner, viewer, member, workspace, project, list, card }
}

const upload = async (api, token, cardId, { bytes = PNG, type = 'image/png', name = 'photo.png' } = {}) => {
  const form = new FormData()
  form.append('attachment', new Blob([bytes], { type }), name)
  const response = await fetch(`${api.base}/projects-api/cards/${cardId}/attachments`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', Cookie: `token=${token}` },
    body: form
  })
  return { status: response.status, data: await response.json().catch(() => null) }
}

const recordingStore = (t, store) => {
  const uploads = []
  const destroyed = []
  store.setMediaStore({
    upload: async (file, folder, options) => {
      const publicId = `card_attachments/${folder}-${uploads.length + 1}-${new mongoose.Types.ObjectId()}`
      uploads.push({ publicId, folder, options, name: file.originalname })
      return {
        url: `https://res.cloudinary.test/${publicId}`,
        publicId,
        fileName: file.originalname,
        fileType: file.mimetype,
        size: file.size
      }
    },
    destroy: async (publicId, options) => {
      destroyed.push({ publicId, options })
      return { result: 'ok' }
    }
  })
  t.after(() => store.resetMediaStore())
  return { uploads, destroyed }
}

test('a successful upload commits exactly one attachment and deletes nothing', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, card } = await workspaceBoard()
  const { uploads, destroyed } = recordingStore(t, store)
  const token = await api.tokenFor(owner)

  const response = await upload(api, token, String(card._id))
  assert.equal(response.status, 201, JSON.stringify(response.data))
  assert.equal(response.data.payload.attachment.length, 1)
  assert.equal(response.data.payload.attachment[0].publicId, uploads[0].publicId)

  const stored = await taskModel.findById(card._id).lean()
  assert.equal(stored.attachment.length, 1)
  assert.equal(destroyed.length, 0)
})

test('a card deleted while its upload is in flight leaves no orphaned asset', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, card } = await workspaceBoard()
  const { destroyed } = recordingStore(t, store)
  // The card disappears after the asset exists but before the metadata append.
  store.setMediaStore({
    upload: async (file, folder) => {
      await taskModel.deleteOne({ _id: card._id })
      return {
        url: 'https://res.cloudinary.test/orphan', publicId: 'card_attachments/orphan',
        fileName: file.originalname, fileType: file.mimetype, size: file.size
      }
    }
  })
  const token = await api.tokenFor(owner)
  const consoleError = t.mock.method(console, 'error', () => {})

  const response = await upload(api, token, String(card._id))
  assert.equal(response.status, 404)
  assert.deepEqual(destroyed.map((entry) => entry.publicId), ['card_attachments/orphan'])
  // The private delivery type is addressed explicitly.
  assert.equal(destroyed[0].options.type, 'authenticated')
  assert.equal(destroyed[0].options.resource_type, 'image')
  assert.equal(await taskModel.countDocuments({ _id: card._id }), 0)
  assert.equal(consoleError.mock.calls.length, 0)
})

test('a failed metadata append deletes the uploaded asset', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, card } = await workspaceBoard()
  const { destroyed } = recordingStore(t, store)
  const original = taskModel.findOneAndUpdate
  taskModel.findOneAndUpdate = () => { throw new Error('write failed') }
  t.after(() => { taskModel.findOneAndUpdate = original })
  const token = await api.tokenFor(owner)

  const response = await upload(api, token, String(card._id))
  assert.equal(response.status, 500)
  assert.equal(destroyed.length, 1)
  assert.equal((await taskModel.findById(card._id).lean()).attachment.length, 0)
})

test('an append that committed before the error keeps its asset', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, card } = await workspaceBoard()
  const destroyed = []
  store.setMediaStore({
    upload: async (file) => ({
      url: 'https://res.cloudinary.test/committed',
      publicId: 'card_attachments/committed',
      fileName: file.originalname,
      fileType: file.mimetype,
      size: file.size
    }),
    destroy: async (publicId) => { destroyed.push(publicId); return { result: 'ok' } }
  })
  t.after(() => store.resetMediaStore())
  const token = await api.tokenFor(owner)

  const original = taskModel.findOneAndUpdate
  taskModel.findOneAndUpdate = async function patched(...args) {
    // The metadata write lands, then the acknowledgement is lost.
    await original.call(taskModel, args[0], {
      $push: {
        attachment: {
          name: 'photo.png', url: 'https://res.cloudinary.test/committed',
          publicId: 'card_attachments/committed', storage: 'authenticated', fileType: 'image/png', size: 10
        }
      }
    })
    throw new Error('connection reset after commit')
  }
  t.after(() => { taskModel.findOneAndUpdate = original })

  const response = await upload(api, token, String(card._id))
  assert.equal(response.status, 201, JSON.stringify(response.data))
  // The asset is the one the card already points at, so it must survive.
  assert.deepEqual(destroyed, [])
  const stored = await taskModel.findById(card._id).lean()
  assert.equal(stored.attachment.length, 1)
  assert.equal(stored.attachment[0].publicId, 'card_attachments/committed')
})

test('an append that reports no card deletes the uploaded asset', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, card } = await workspaceBoard()
  const { destroyed } = recordingStore(t, store)
  const original = taskModel.findOneAndUpdate
  taskModel.findOneAndUpdate = () => null
  t.after(() => { taskModel.findOneAndUpdate = original })
  const token = await api.tokenFor(owner)

  const response = await upload(api, token, String(card._id))
  assert.equal(response.status, 404)
  assert.equal(destroyed.length, 1)
})

test('a revoked uploader cannot attach the file and it is cleaned up', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { member, workspace, card } = await workspaceBoard()
  const { destroyed } = recordingStore(t, store)
  store.setMediaStore({
    upload: async (file) => {
      // The uploader is a MEMBER; the upload outlives their membership.
      await WorkspaceModel.updateOne({ _id: workspace._id }, { $pull: { members: { user: member._id } } })
      return {
        url: 'https://res.cloudinary.test/revoked', publicId: 'card_attachments/revoked',
        fileName: file.originalname, fileType: file.mimetype, size: file.size
      }
    }
  })
  const token = await api.tokenFor(member)

  const response = await upload(api, token, String(card._id))
  assert.equal(response.status, 404)
  assert.deepEqual(destroyed.map((entry) => entry.publicId), ['card_attachments/revoked'])
  assert.equal((await taskModel.findById(card._id).lean()).attachment.length, 0)
})

test('a cleanup failure is recorded and does not turn a 404 into a server error', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, card } = await workspaceBoard()
  store.setMediaStore({
    upload: async (file) => {
      // The card disappears after the asset exists, so cleanup is attempted and
      // the provider refuses it.
      await taskModel.deleteOne({ _id: card._id })
      return {
        url: 'https://res.cloudinary.test/stuck', publicId: 'card_attachments/stuck',
        fileName: file.originalname, fileType: file.mimetype, size: file.size
      }
    },
    destroy: async () => { throw new Error('provider unavailable') }
  })
  t.after(() => store.resetMediaStore())
  const consoleError = t.mock.method(console, 'error', () => {})
  const token = await api.tokenFor(owner)

  const response = await upload(api, token, String(card._id))
  assert.equal(response.status, 404)
  assert.equal(consoleError.mock.calls.length, 1)
  assert.match(String(consoleError.mock.calls[0].arguments[0]), /cleanup failed/i)
  assert.equal(consoleError.mock.calls[0].arguments[0].includes('api_secret'), false)
})

test('two simultaneous uploads both persist', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, card } = await workspaceBoard()
  recordingStore(t, store)
  const token = await api.tokenFor(owner)

  const [first, second] = await Promise.all([
    upload(api, token, String(card._id)),
    upload(api, token, String(card._id))
  ])
  assert.equal(first.status, 201)
  assert.equal(second.status, 201)
  const stored = await taskModel.findById(card._id).lean()
  assert.equal(stored.attachment.length, 2)
  assert.equal(new Set(stored.attachment.map((item) => item.publicId)).size, 2)
})

test('an invalid image signature and an unauthorized uploader are refused', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, workspace, card } = await workspaceBoard()
  store.resetMediaStore()
  const outsider = await UserModel.create({ name: 'Outsider', email: `media-out-${new mongoose.Types.ObjectId()}@test.invalid`, password: 'synthetic-password' })

  const invalid = await upload(api, await api.tokenFor(owner), String(card._id), { bytes: NOT_AN_IMAGE })
  assert.equal(invalid.status, 400)

  const unauthorized = await upload(api, await api.tokenFor(outsider), String(card._id))
  assert.ok([403, 404].includes(unauthorized.status))
  assert.equal((await taskModel.findById(card._id).lean()).attachment.length, 0)
  assert.ok(workspace)
})

test('deleting a card removes its comments and its private assets', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, card } = await workspaceBoard()
  const { destroyed } = recordingStore(t, store)
  const token = await api.tokenFor(owner)
  await CommentModel.create({ task: card._id, author: owner._id, body: 'On this card' })
  const other = await taskModel.create({ title: 'Other', listId: card.listId, projectId: card.projectId, creatorId: owner._id })
  await CommentModel.create({ task: other._id, author: owner._id, body: 'On another card' })
  await taskModel.updateOne({ _id: card._id }, {
    $push: { attachment: { name: 'a.png', url: 'https://res.cloudinary.test/a', publicId: 'card_attachments/a', storage: 'authenticated', fileType: 'image/png', size: 10 } }
  })

  const response = await api.request('DELETE', `/projects-api/cards/${card._id}`, undefined, token)
  assert.equal(response.status, 200)
  assert.equal(await CommentModel.countDocuments({ task: card._id }), 0)
  assert.equal(await CommentModel.countDocuments({ task: other._id }), 1)
  assert.deepEqual(destroyed.map((entry) => entry.publicId), ['card_attachments/a'])
})

test('deleting a list removes every card comment and asset in it, and nothing else', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, project, list } = await workspaceBoard()
  const { destroyed } = recordingStore(t, store)
  const token = await api.tokenFor(owner)
  const secondList = await ListModel.create({ title: 'Doing', projectId: project._id })
  const first = await taskModel.create({ title: 'One', listId: list._id, projectId: project._id, creatorId: owner._id })
  const second = await taskModel.create({ title: 'Two', listId: list._id, projectId: project._id, creatorId: owner._id })
  const survivor = await taskModel.create({ title: 'Three', listId: secondList._id, projectId: project._id, creatorId: owner._id })
  await CommentModel.create([
    { task: first._id, author: owner._id, body: 'first' },
    { task: second._id, author: owner._id, body: 'second' },
    { task: survivor._id, author: owner._id, body: 'survivor' }
  ])
  await taskModel.updateOne({ _id: first._id }, {
    $push: { attachment: { name: 'one.png', url: 'https://res.cloudinary.test/one', publicId: 'card_attachments/one', storage: 'authenticated', fileType: 'image/png', size: 10 } }
  })
  await taskModel.updateOne({ _id: second._id }, {
    $push: { attachment: { name: 'two.png', url: 'https://res.cloudinary.test/two', publicId: 'card_attachments/two', storage: 'authenticated', fileType: 'image/png', size: 10 } }
  })
  await taskModel.updateOne({ _id: survivor._id }, {
    $push: { attachment: { name: 'keep.png', url: 'https://res.cloudinary.test/keep', publicId: 'card_attachments/keep', storage: 'authenticated', fileType: 'image/png', size: 10 } }
  })

  const response = await api.request('DELETE', `/projects-api/lists/${list._id}`, undefined, token)
  assert.equal(response.status, 200)
  assert.equal(await ListModel.countDocuments({ _id: list._id }), 0)
  assert.equal(await taskModel.countDocuments({ listId: list._id }), 0)
  assert.equal(await CommentModel.countDocuments({ task: { $in: [first._id, second._id] } }), 0)
  assert.equal(await CommentModel.countDocuments({ task: survivor._id }), 1)
  assert.equal(await taskModel.countDocuments({ _id: survivor._id }), 1)
  assert.deepEqual(destroyed.map((entry) => entry.publicId).sort(), ['card_attachments/one', 'card_attachments/two'])
})

test('a transaction failure leaves the list, its cards and its comments intact', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, list } = await workspaceBoard()
  recordingStore(t, store)
  const token = await api.tokenFor(owner)
  const card = await taskModel.create({ title: 'Kept', listId: list._id, projectId: list.projectId, creatorId: owner._id })
  await CommentModel.create({ task: card._id, author: owner._id, body: 'kept' })
  const original = ListModel.deleteOne
  ListModel.deleteOne = () => { throw new Error('list delete failed') }
  t.after(() => { ListModel.deleteOne = original })

  const response = await api.request('DELETE', `/projects-api/lists/${list._id}`, undefined, token)
  assert.equal(response.status, 500)
  assert.equal(await ListModel.countDocuments({ _id: list._id }), 1)
  assert.equal(await taskModel.countDocuments({ _id: card._id }), 1)
  assert.equal(await CommentModel.countDocuments({ task: card._id }), 1)
})

test('an unauthorized list deletion removes nothing', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { viewer, list } = await workspaceBoard()
  const { destroyed } = recordingStore(t, store)
  const token = await api.tokenFor(viewer)

  const response = await api.request('DELETE', `/projects-api/lists/${list._id}`, undefined, token)
  assert.ok([403, 404].includes(response.status))
  assert.equal(await ListModel.countDocuments({ _id: list._id }), 1)
  assert.equal(destroyed.length, 0)
})

test('a cleanup failure during list deletion is recorded, not fatal', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, list } = await workspaceBoard()
  const token = await api.tokenFor(owner)
  const card = await taskModel.create({ title: 'Asset', listId: list._id, projectId: list.projectId, creatorId: owner._id })
  await taskModel.updateOne({ _id: card._id }, {
    $push: { attachment: { name: 'stuck.png', url: 'https://res.cloudinary.test/stuck', publicId: 'card_attachments/stuck', storage: 'authenticated', fileType: 'image/png', size: 10 } }
  })
  store.setMediaStore({
    upload: async () => { throw new Error('unused') },
    destroy: async () => { throw new Error('provider unavailable') }
  })
  t.after(() => store.resetMediaStore())
  const consoleError = t.mock.method(console, 'error', () => {})

  const response = await api.request('DELETE', `/projects-api/lists/${list._id}`, undefined, token)
  assert.equal(response.status, 200)
  assert.equal(await ListModel.countDocuments({ _id: list._id }), 0)
  assert.equal(consoleError.mock.calls.length, 1)
})

const openSocket = async (t, base, token) => {
  const socket = connect(base, {
    transports: ['websocket'], reconnection: false, timeout: 1500,
    auth: { token }, extraHeaders: { Origin: 'http://localhost:5173' }
  })
  t.after(() => socket.disconnect())
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}
const ask = (socket, event, ...args) => new Promise((resolve) => {
  socket.timeout(1500).emit(event, ...args, (error, result) => resolve(error ? { ok: false, timeout: true } : result))
})

test('both connected clients receive the list deletion event', async (t) => {
  const api = await testApi(t)
  const store = await mediaStore()
  const { owner, member, project, list } = await workspaceBoard()
  recordingStore(t, store)
  const ownerToken = await api.tokenFor(owner)
  const memberToken = await api.tokenFor(member)

  const first = await openSocket(t, api.base, ownerToken)
  const second = await openSocket(t, api.base, memberToken)
  const events = []
  first.on('list-deleted', (payload) => events.push({ client: 1, payload }))
  second.on('list-deleted', (payload) => events.push({ client: 2, payload }))
  assert.deepEqual(await ask(first, 'join-project', String(project._id)), { ok: true })
  assert.deepEqual(await ask(second, 'join-project', String(project._id)), { ok: true })

  const response = await api.request('DELETE', `/projects-api/lists/${list._id}`, undefined, ownerToken)
  assert.equal(response.status, 200)

  const deadline = Date.now() + 2000
  while (events.length < 2 && Date.now() < deadline) await delay(20)
  assert.equal(events.length, 2)
  assert.deepEqual(events.map((event) => event.client).sort(), [1, 2])
  assert.ok(events.every((event) => event.payload.listId === String(list._id)))
})
