import test from 'node:test'
import assert from 'node:assert/strict'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'
import Template from '../../models/template.js'

test('template create, edit and independent board use', async (t) => {
  const { request, tokenFor } = await testApi(t)
  const [owner, caller] = await UserModel.create(['owner', 'caller'].map((name) => ({
    name, username: name, email: `${name}@example.test`, password: 'synthetic-password', role: 'MEMBER'
  })))
  const own = await tokenFor(owner)
  const actor = await tokenFor(caller)
  const created = await request('POST', '/api/templates', { title: 'Starter', category: 'Business', description: 'Public description', isPublished: true }, own)
  assert.equal(created.status, 201)
  const id = created.data.payload._id
  assert.equal((await request('PUT', `/api/templates/${id}`, { title: 'Edited' }, own)).status, 200)
  assert.equal((await request('PUT', `/api/templates/${id}`, { title: 'Stolen' }, actor)).status, 403)
  assert.equal((await request('PUT', `/api/templates/${id}`, { allowPublicEdit: true }, own)).status, 400)
  assert.equal((await request('POST', `/api/templates/${id}/use`, {})).status, 401)
  const draft = await Template.create({ title: 'Draft', category: 'Business', creatorId: owner._id, creatorName: owner.name })
  assert.equal((await request('POST', `/api/templates/${draft._id}/use`, {}, actor)).status, 404)
  for (const body of [{ workspaceId: 'invalid' }, { title: '' }, { title: 12 }, { members: [owner._id] }]) {
    assert.equal((await request('POST', `/api/templates/${id}/use`, body, actor)).status, 400)
  }
  const ws = await WorkspaceModel.create({ name: 'Destination', owner: owner._id, members: [{ user: caller._id, role: 'VIEWER' }] })
  const use = (body = {}) => request('POST', `/api/templates/${id}/use`, body, actor)
  assert.equal((await use({ workspaceId: String(ws._id) })).status, 403)
  await WorkspaceModel.updateOne({ _id: ws._id }, { $set: { 'members.0.role': 'MEMBER', 'permissions.MEMBER.manageBoards': false } })
  assert.equal((await use({ workspaceId: String(ws._id) })).status, 403)
  await WorkspaceModel.updateOne({ _id: ws._id }, { $set: { 'permissions.MEMBER.manageBoards': true } })
  const first = await use({ workspaceId: String(ws._id), title: ' My board ' })
  assert.equal(first.status, 201)
  const second = await use()
  assert.equal(second.status, 201)
  assert.notEqual(first.data.payload._id, second.data.payload._id)
  assert.notEqual(first.data.payload._id, id)
  assert.equal(first.data.payload.title, 'My board')
  assert.equal(second.data.payload.title, 'Edited')
  assert.equal(first.data.payload.creatorId, String(caller._id))
  assert.equal(first.data.payload.workspace, String(ws._id))
  assert.equal(first.data.payload.membershipVersion, 1)
  const firstLists = await ListModel.find({ projectId: first.data.payload._id }).sort({ order: 1 })
  const secondLists = await ListModel.find({ projectId: second.data.payload._id }).sort({ order: 1 })
  assert.deepEqual(firstLists.map((list) => list.title), ['To Do', 'In Progress', 'Done'])
  assert.deepEqual(firstLists.map((list) => list.order), [0, 1, 2])
  assert.ok(firstLists.every((list) => !secondLists.some((other) => String(other._id) === String(list._id))))
  const source = await projectModel.create({ name: 'Published board', description: 'Visible summary', creatorId: owner._id, isPublished: true,
    members: [owner._id], directGrants: [{ user: owner._id, role: 'MEMBER', grantedBy: owner._id, createdAt: new Date() }],
    publishDetails: { notes: 'private-note', contactEmail: 'private@example.test' } })
  const sourceList = await ListModel.create({ title: 'Private list', projectId: source._id })
  await taskModel.create({ title: 'Private task', projectId: source._id, listId: sourceList._id, creatorId: owner._id, assignedTo: [owner._id] })
  const result = await request('POST', `/api/templates/${source._id}/use`, undefined, actor)
  assert.equal(result.status, 201)
  const board = result.data.payload
  assert.equal(board.title, source.title)
  assert.equal(board.description, 'Visible summary')
  assert.deepEqual(board.members, [])
  assert.deepEqual(board.directGrants, [])
  assert.equal(board.isPublished, false)
  assert.equal(board.publishDetails.notes, '')
  assert.equal(board.publishDetails.contactEmail, '')
  assert.equal(await taskModel.countDocuments({ projectId: board._id }), 0)
  assert.equal(await taskModel.countDocuments({ projectId: source._id }), 1)
  assert.equal(await ListModel.countDocuments({ projectId: board._id }), 3)
  await WorkspaceModel.updateOne({ _id: ws._id }, { $pull: { members: { user: caller._id } } })
  assert.equal((await use({ workspaceId: String(ws._id) })).status, 403)
})
