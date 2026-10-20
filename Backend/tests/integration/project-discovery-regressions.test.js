import test from 'node:test'
import assert from 'node:assert/strict'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'

async function fixture(t) {
  const api = await testApi(t)
  const [owner, member, viewer] = await UserModel.create(['owner', 'member', 'viewer'].map((name) => ({
    name, email: `${name}@discovery.test`, password: 'synthetic-password', role: 'VIEWER'
  })))
  const workspace = await WorkspaceModel.create({ name: 'Current scope', owner: owner._id, members: [
    { user: member._id, role: 'MEMBER' }, { user: viewer._id, role: 'VIEWER' }
  ] })
  const project = await projectModel.create({ name: 'Board', workspace: workspace._id, creatorId: member._id })
  return { api, owner, member, viewer, workspace, project, tokens: await Promise.all([owner, member, viewer].map(api.tokenFor)) }
}

test('card reorder requires exactly all active same-list/project IDs without writes or events on rejection', async (t) => {
  const { api, project, tokens } = await fixture(t)
  const list = await ListModel.create({ title: 'List', projectId: project._id })
  const sibling = await ListModel.create({ title: 'Sibling', projectId: project._id })
  const foreign = await projectModel.create({ name: 'Foreign' })
  const cards = await taskModel.create([
    { title: 'A', listId: list._id, projectId: project._id, order: 8 },
    { title: 'B', listId: list._id, projectId: project._id, order: 9 },
    { title: 'Inactive', listId: list._id, projectId: project._id, isActive: false, order: 10 },
    { title: 'Foreign project', listId: list._id, projectId: foreign._id, order: 11 },
    { title: 'Sibling', listId: sibling._id, projectId: project._id, order: 12 }
  ])
  const events = []
  const originalTo = api.io.to
  api.io.to = () => ({ emit: (...args) => events.push(args) })
  t.after(() => { api.io.to = originalTo })
  const before = await taskModel.find().sort('_id').lean()
  for (const orderedIds of [[cards[1].id], [], [cards[0].id, cards[0].id],
    [cards[0].id, cards[2].id], [cards[0].id, cards[3].id], [cards[0].id, cards[4].id]]) {
    assert.equal((await api.request('PUT', `/projects-api/lists/${list.id}/cards/reorder`, { orderedIds }, tokens[0])).status, 400, JSON.stringify(orderedIds))
    assert.deepEqual(await taskModel.find().sort('_id').lean(), before)
    assert.deepEqual(events, [])
  }
  assert.equal((await api.request('PUT', `/projects-api/lists/${list.id}/cards/reorder`, { orderedIds: [cards[1].id, cards[0].id] }, tokens[0])).status, 200)
  assert.deepEqual((await taskModel.find({ _id: { $in: cards.slice(0, 2).map((c) => c._id) } }).sort('order')).map((c) => c.id), [cards[1].id, cards[0].id])
  assert.equal(events.length, 1)
})

test('workspace analytics ALL is accepted and equivalent to omitted status', async (t) => {
  const { api, workspace, project, tokens } = await fixture(t)
  await projectModel.create({ name: 'Archived', workspace: workspace._id, archivedAt: new Date() })
  const path = `/api/workspaces/${workspace.id}/analytics`
  const all = await api.request('GET', `${path}?status=ALL`, undefined, tokens[0])
  assert.equal(all.status, 200)
  assert.deepEqual(all.data, (await api.request('GET', path, undefined, tokens[0])).data)
  assert.equal(all.data.payload.totals.projects, 2)
  assert.equal((await api.request('GET', `${path}?status=ACTIVE`, undefined, tokens[0])).data.payload.totals.projects, 1)
  assert.equal((await api.request('GET', `${path}?status=ARCHIVED`, undefined, tokens[0])).data.payload.totals.projects, 1)
  assert.ok(project)
})

test('workspace discovery filters duplicate and inactive legacy candidates before population and limit', async (t) => {
  const { api, owner, member, workspace, tokens } = await fixture(t)
  const invalid = await WorkspaceModel.insertMany(Array.from({ length: 101 }, (_, i) => ({
    name: `Ambiguous ${i}`, owner: owner._id, members: [{ user: member._id, role: 'MEMBER' }, { user: member._id, role: 'ADMIN' }]
  })))
  await WorkspaceModel.collection.insertOne({ name: 'Inactive legacy', owner: owner._id, isActive: false, members: [{ user: member._id, role: 'MEMBER' }] })
  const valid = await WorkspaceModel.create({ name: 'After invalid rows', owner: owner._id, members: [{ user: member._id, role: 'VIEWER' }] })
  const populated = []
  const original = WorkspaceModel.populate
  WorkspaceModel.populate = async function (docs, ...args) {
    populated.push(...(Array.isArray(docs) ? docs : [docs]).map((doc) => String(doc._id)))
    return original.call(this, docs, ...args)
  }
  t.after(() => { WorkspaceModel.populate = original })
  const response = await api.request('GET', '/api/workspaces', undefined, tokens[1])
  assert.equal(response.status, 200)
  assert.deepEqual(new Set(response.data.payload.map((w) => w._id)), new Set([workspace.id, valid.id]))
  assert.equal(populated.some((id) => invalid.some((w) => w.id === id)), false)
})

test('standalone versioned direct grants are discoverable while legacy and malformed grants are denied', async (t) => {
  const { api, owner, member, tokens } = await fixture(t)
  const grant = { user: member._id, grantedBy: owner._id, role: 'MEMBER', createdAt: new Date() }
  const allowed = await projectModel.create({ name: 'Granted', creatorId: owner._id, membershipVersion: 1, directGrants: [grant] })
  const denied = await projectModel.create({ name: 'Legacy', creatorId: owner._id, members: [member._id], directGrants: [grant] })
  const malformed = await projectModel.collection.insertOne({ name: 'Incomplete grant', creatorId: owner._id, workspace: null, status: true, membershipVersion: 1, directGrants: [{ user: member._id, role: 'MEMBER' }], updatedAt: new Date() })
  for (const suffix of ['', '/recent']) {
    const result = await api.request('GET', `/projects-api/projects${suffix}`, undefined, tokens[1])
    assert.equal(result.status, 200)
    assert.ok(result.data.payload.some((p) => p._id === allowed.id))
    assert.equal(result.data.payload.some((p) => p._id === denied.id || p._id === String(malformed.insertedId)), false)
  }
  assert.equal((await api.request('GET', '/projects-api/projects?limit=1', undefined, tokens[1])).data.payload.length, 1)
})

test('project DTO capabilities follow current scoped policy across detail, listing and writes', async (t) => {
  const { api, workspace, project, tokens } = await fixture(t)
  const full = { read: true, edit: true, manage: true, restore: true }
  const readOnly = { read: true, edit: false, manage: false, restore: false }
  const path = `/projects-api/projects/${project.id}`
  assert.deepEqual((await api.request('GET', path, undefined, tokens[0])).data.payload.capabilities, full)
  assert.deepEqual((await api.request('GET', path, undefined, tokens[2])).data.payload.capabilities, readOnly)
  assert.deepEqual((await api.request('GET', '/projects-api/projects', undefined, tokens[0])).data.payload[0].capabilities, full)
  const created = await api.request('POST', '/projects-api/projects', { title: 'Created', workspaceId: workspace.id }, tokens[0])
  assert.equal(created.status, 201)
  assert.deepEqual(created.data.payload.capabilities, full)
  assert.deepEqual((await api.request('PUT', path, { title: 'Renamed' }, tokens[0])).data.payload.capabilities, full)
  assert.deepEqual((await api.request('PUT', `${path}/archive`, { archived: true }, tokens[0])).data.payload.capabilities,
    { read: true, edit: false, manage: false, restore: true })
  assert.deepEqual((await api.request('PUT', `${path}/archive`, { archived: false }, tokens[0])).data.payload.capabilities, full)
  await WorkspaceModel.updateOne({ _id: workspace._id }, { $set: { 'permissions.MEMBER.manageBoards': false } })
  assert.deepEqual((await api.request('GET', path, undefined, tokens[1])).data.payload.capabilities, readOnly)
})
