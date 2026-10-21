// The board reads are paged and the board aggregates are unchanged. These
// run against a real MongoDB so the keyset, the lookup and the grouped
// aggregations are checked against the database, not against a double.
import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'

async function fixture(t) {
  const api = await testApi(t)
  const [owner, member] = await UserModel.create([
    { name: 'Owner', email: 'owner@test.invalid', password: 'synthetic-password', role: 'MEMBER' },
    { name: 'Member', email: 'member@test.invalid', password: 'synthetic-password', role: 'MEMBER' }
  ])
  const workspace = await WorkspaceModel.create({ name: 'Bounded', owner: owner._id, members: [
    { user: member._id, role: 'MEMBER' }
  ] })
  const project = await projectModel.create({
    name: 'Bounded board', workspace: workspace._id, creatorId: owner._id,
    members: [owner._id, member._id], isPublished: true, isEditable: true
  })
  const tokens = await Promise.all([api.tokenFor(owner), api.tokenFor(member)])
  return { api, owner, member, workspace, project, tokens }
}

test('a board with more than one page of lists is read page by page', async (t) => {
  const { api, project, tokens } = await fixture(t)
  const lists = await ListModel.create(Array.from({ length: 120 }, (_, index) => ({
    title: `List ${index}`, projectId: project._id, order: index
  })))

  const first = await api.request('GET', `/projects-api/projects/${project.id}/lists`, undefined, tokens[0])
  assert.equal(first.status, 200)
  assert.equal(first.data.payload.length, 100)
  assert.equal(first.data.hasMore, true)
  assert.equal(typeof first.data.nextCursor, 'string')

  const second = await api.request('GET', `/projects-api/projects/${project.id}/lists?cursor=${encodeURIComponent(first.data.nextCursor)}`, undefined, tokens[0])
  assert.equal(second.status, 200)
  assert.equal(second.data.payload.length, 20)
  assert.equal(second.data.hasMore, false)
  assert.equal(second.data.nextCursor, null)

  const seen = [...first.data.payload, ...second.data.payload].map((list) => list._id)
  assert.equal(new Set(seen).size, lists.length)
  // The order the board client relies on is preserved across the pages.
  assert.deepEqual(seen, lists.map((list) => String(list._id)))
})

test('a list with more than one page of cards is read page by page', async (t) => {
  const { api, project, member, tokens } = await fixture(t)
  const list = await ListModel.create({ title: 'Busy', projectId: project._id, order: 0 })
  const cards = await taskModel.create(Array.from({ length: 120 }, (_, index) => ({
    title: `Card ${index}`, listId: list._id, projectId: project._id, creatorId: member._id, order: index
  })))

  const first = await api.request('GET', `/projects-api/lists/${list.id}/cards`, undefined, tokens[0])
  assert.equal(first.status, 200)
  assert.equal(first.data.payload.length, 100)
  assert.equal(first.data.hasMore, true)
  assert.equal(typeof first.data.nextCursor, 'string')

  const second = await api.request('GET', `/projects-api/lists/${list.id}/cards?cursor=${encodeURIComponent(first.data.nextCursor)}`, undefined, tokens[0])
  assert.equal(second.status, 200)
  assert.equal(second.data.payload.length, 20)
  assert.equal(second.data.hasMore, false)
  assert.equal(second.data.nextCursor, null)

  const seen = [...first.data.payload, ...second.data.payload].map((card) => card._id)
  assert.equal(new Set(seen).size, cards.length)
  assert.deepEqual(seen, cards.map((card) => String(card._id)))
})

test('a page size above the maximum is refused and a cursor is bound to its resource', async (t) => {
  const { api, project, member, tokens } = await fixture(t)
  const list = await ListModel.create({ title: 'List', projectId: project._id, order: 0 })
  const other = await ListModel.create({ title: 'Other', projectId: project._id, order: 1 })
  // Two cards, so a page of one still leaves a next page and therefore a
  // cursor that can be bound to this list.
  await taskModel.create(Array.from({ length: 2 }, (_, index) => ({
    title: `Card ${index}`, listId: list._id, projectId: project._id, creatorId: member._id, order: index
  })))

  assert.equal((await api.request('GET', `/projects-api/projects/${project.id}/lists?limit=101`, undefined, tokens[0])).status, 400)
  assert.equal((await api.request('GET', `/projects-api/lists/${list.id}/cards?limit=0`, undefined, tokens[0])).status, 400)

  const page = await api.request('GET', `/projects-api/lists/${list.id}/cards?limit=1`, undefined, tokens[0])
  assert.equal(page.status, 200)
  assert.equal(page.data.hasMore, true)
  assert.equal(typeof page.data.nextCursor, 'string')

  // A cursor issued for one list cannot be replayed against another one.
  const replayed = await api.request('GET', `/projects-api/lists/${other.id}/cards?cursor=${encodeURIComponent(page.data.nextCursor)}`, undefined, tokens[0])
  assert.equal(replayed.status, 400)
  const forged = await api.request('GET', `/projects-api/lists/${list.id}/cards?cursor=not-a-cursor`, undefined, tokens[0])
  assert.equal(forged.status, 400)
})

test('the analytics response is unchanged and counts only the cards of the board', async (t) => {
  const { api, owner, member, project, tokens } = await fixture(t)
  const lists = await ListModel.create([
    { title: 'One', projectId: project._id, order: 0 },
    { title: 'Two', projectId: project._id, order: 1 },
    { title: 'Three', projectId: project._id, order: 2 }
  ])
  const otherProject = await projectModel.create({ name: 'Other', creatorId: owner._id })
  const otherList = await ListModel.create({ title: 'Foreign', projectId: otherProject._id, order: 0 })
  await taskModel.create([
    { title: 'A', listId: lists[0]._id, projectId: project._id, creatorId: member._id, status: 'TO-DO', priority: 'HIGH' },
    { title: 'B', listId: lists[0]._id, projectId: project._id, creatorId: member._id, status: 'TO-DO', priority: 'HIGH' },
    { title: 'C', listId: lists[1]._id, projectId: project._id, status: 'DONE' },
    { title: 'D', listId: lists[1]._id, projectId: project._id, dueDate: new Date('2020-01-01T00:00:00.000Z') },
    { title: 'E', listId: lists[2]._id, projectId: project._id, memberId: member._id },
    // A card that claims this board but lives in another board's list.
    { title: 'Foreign card', listId: otherList._id, projectId: project._id }
  ])

  const response = await api.request('GET', `/projects-api/projects/${project.id}/analytics`, undefined, tokens[0])
  assert.equal(response.status, 200)
  const analytics = response.data.payload
  assert.equal(analytics.totals.lists, 3)
  assert.equal(analytics.totals.cards, 5)
  assert.equal(typeof analytics.totals.activity, 'number')
  assert.deepEqual(analytics.byStatus, { 'TO-DO': 4, DONE: 1 })
  assert.deepEqual(analytics.byPriority, { MEDIUM: 3, HIGH: 2 })
  assert.equal(analytics.overdue, 1)
  assert.deepEqual(analytics.workload, { [String(member._id)]: 1, unassigned: 4 })
})

test('the export still contains every list and every card', async (t) => {
  const { api, project, tokens } = await fixture(t)
  const lists = await ListModel.create(Array.from({ length: 3 }, (_, index) => ({
    title: `List ${index}`, projectId: project._id, order: index
  })))
  const cards = await taskModel.create(Array.from({ length: 5 }, (_, index) => ({
    title: `Card ${index}`, listId: lists[index % lists.length]._id, projectId: project._id, order: index
  })))

  const response = await api.request('GET', `/projects-api/projects/${project.id}/export`, undefined, tokens[0])
  assert.equal(response.status, 200)
  assert.equal(response.data.payload.lists.length, 3)
  assert.equal(response.data.payload.cards.length, 5)
  const expected = cards
    .map((card) => ({ id: String(card._id), listId: String(card.listId), order: card.order }))
    .sort((left, right) => (left.listId === right.listId
      ? left.order - right.order
      : (left.listId < right.listId ? -1 : 1)))
    .map((entry) => entry.id)
  assert.deepEqual(response.data.payload.cards.map((card) => card._id), expected)
})

test('an unpublished board can be published and edited through the template routes', async (t) => {
  const { api, owner, tokens } = await fixture(t)
  const board = await projectModel.create({
    name: 'Draft board', title: 'Draft board', creatorId: owner._id, isPublished: false, members: [owner._id]
  })

  const published = await api.request('PATCH', `/api/templates/${board.id}/published`, undefined, tokens[0])
  assert.equal(published.status, 200, 'the board the publish route exists for must be found')
  assert.equal(published.data.payload.isPublished, true)
  assert.equal((await projectModel.findById(board._id)).isPublished, true)

  const draft = await projectModel.create({
    name: 'Second draft', title: 'Second draft', creatorId: owner._id, isPublished: false, members: [owner._id]
  })
  const edited = await api.request('PUT', `/api/templates/${draft.id}`, { title: 'Edited draft' }, tokens[0])
  assert.equal(edited.status, 200, 'an unpublished board must be editable')
  assert.equal((await projectModel.findById(draft._id)).title, 'Edited draft')
})

test('two concurrent attachment uploads keep both attachments', async (t) => {
  const { project } = await fixture(t)
  const { appendAttachment } = await import('../../utils/cardAttachments.js')
  const list = await ListModel.create({ title: 'Files', projectId: project._id, order: 0 })
  const card = await taskModel.create({ title: 'Card', listId: list._id, projectId: project._id })

  await Promise.all([
    appendAttachment({ cardId: card._id, attachment: { name: 'one.png', url: 'https://example.test/one.png', storage: 'authenticated', fileType: 'image/png', size: 10 } }),
    appendAttachment({ cardId: card._id, attachment: { name: 'two.png', url: 'https://example.test/two.png', storage: 'authenticated', fileType: 'image/png', size: 20 } })
  ])

  const reloaded = await taskModel.findById(card._id)
  assert.equal(reloaded.attachment.length, 2, 'a concurrent upload must not drop an attachment')
  assert.deepEqual(reloaded.attachment.map((entry) => entry.name).sort(), ['one.png', 'two.png'])
})

test('a deleted board evicts the sockets that joined it', async (t) => {
  const { api, owner, project, tokens } = await fixture(t)
  const { io: connect } = await import('socket.io-client')
  const socket = connect(api.base, {
    transports: ['websocket'], reconnection: false, timeout: 1500,
    auth: { token: tokens[0] }, extraHeaders: { Origin: 'http://localhost:5173' }
  })
  t.after(() => socket.disconnect())
  await new Promise((resolve) => {
    socket.once('connect', resolve)
    socket.once('connect_error', resolve)
  })
  assert.equal(socket.connected, true)

  const joined = await new Promise((resolve) => {
    socket.timeout(1500).emit('join-project', project.id, (error, result) => resolve(error ? null : result))
  })
  assert.deepEqual(joined, { ok: true })

  const received = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 500)
    socket.once('card-updated', (payload) => { clearTimeout(timer); resolve(payload) })
  })
  api.io.to(`project:${project.id}`).emit('card-updated', { _id: 'card-1' })
  assert.ok(await received, 'the joined socket receives the board traffic')

  const deleted = await api.request('DELETE', `/projects-api/projects/${project.id}`, undefined, tokens[0])
  assert.equal(deleted.status, 200)

  const after = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 500)
    socket.once('card-updated', (payload) => { clearTimeout(timer); resolve(payload) })
  })
  api.io.to(`project:${project.id}`).emit('card-updated', { _id: 'card-2' })
  assert.equal(await after, null, 'the evicted socket receives nothing from the deleted board')
  assert.ok(owner)
})
