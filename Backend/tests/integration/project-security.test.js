import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'
import { canAccessProject, canEditProject, canManageProject, findTask, getWorkspaceRole, workspaceRole } from '../../authorization/resources.js'

async function fixture(t) {
  const api = await testApi(t)
  const users = await UserModel.create(['owner', 'member', 'viewer', 'foreign'].map((name) => ({
    name, email: `${name}@test.invalid`, password: 'synthetic-password', role: name === 'foreign' ? 'ADMIN' : 'MEMBER'
  })))
  const [owner, member, viewer, foreign] = users
  const workspace = await WorkspaceModel.create({ name: 'Scope', owner: owner._id, members: [
    { user: member._id, role: 'MEMBER' }, { user: viewer._id, role: 'VIEWER' }
  ] })
  const project = await projectModel.create({ name: 'Private', workspace: workspace._id, creatorId: viewer._id,
    members: users.map((u) => u._id), isPublished: true, isEditable: true })
  const list = await ListModel.create({ title: 'List', projectId: project._id })
  const card = await taskModel.create({ title: 'Card', listId: list._id, projectId: project._id, creatorId: owner._id })
  const tokens = await Promise.all(users.map((u) => api.tokenFor(u)))
  return { api, owner, member, viewer, foreign, workspace, project, list, card, tokens }
}

test('current scoped roles contain published boards and ignore copied members/global ADMIN', async (t) => {
  const { api, project, list, tokens } = await fixture(t)
  for (const index of [2, 3]) {
    const result = await api.request('POST', `/projects-api/projects/${project.id}/lists`, { title: 'forbidden' }, tokens[index])
    assert.ok([403, 404].includes(result.status), `actor ${index}: ${result.status}`)
  }
  assert.ok([403, 404].includes((await api.request('GET', `/projects-api/lists/${list.id}/cards`, undefined, tokens[3])).status))
  assert.equal((await api.request('PUT', `/projects-api/lists/${list.id}`, { title: 'allowed' }, tokens[1])).status, 200)
})

test('project update broadcasts data without the actor capabilities', async (t) => {
  const { api, project, tokens } = await fixture(t)
  let captured = null
  const originalTo = api.io.to.bind(api.io)
  t.mock.method(api.io, 'to', (room) => {
    const operator = originalTo(room)
    const originalEmit = operator.emit.bind(operator)
    operator.emit = (event, payload) => {
      if (event === 'project-updated') captured = { room, payload }
      return originalEmit(event, payload)
    }
    return operator
  })
  const response = await api.request('PUT', `/projects-api/projects/${project.id}`, { title: 'Broadcast title' }, tokens[0])
  assert.equal(response.status, 200)
  assert.ok(captured)
  assert.equal(captured.room, `project:${project.id}`)
  assert.equal(captured.payload.title, 'Broadcast title')
  assert.equal(captured.payload.capabilities, undefined)
})

test('project metadata updates are allowlisted and bounded', async (t) => {
  const { api, project, tokens } = await fixture(t)
  const path = `/projects-api/projects/${project.id}`
  const attacks = [
    { unknown: 'x' },
    { title: 'x'.repeat(241) },
    { description: 'x'.repeat(50001) },
    { color: 'x'.repeat(121) },
    { img: `https://example.invalid/${'x'.repeat(2048)}` },
    { isPublished: 'yes' },
    { publishDetails: { notes: 'x'.repeat(10001) } },
    { publishDetails: { website: 'javascript:alert(1)' } },
    { publishDetails: { contactEmail: 'not-an-email' } },
    { publishDetails: { unknown: 'x' } }
  ]
  for (const body of attacks) {
    assert.equal((await api.request('PUT', path, body, tokens[0])).status, 400, JSON.stringify(body).slice(0, 80))
  }
  const created = await api.request('POST', '/projects-api/projects', { title: 'x'.repeat(241) }, tokens[0])
  assert.equal(created.status, 400)
  const extra = await api.request('POST', '/projects-api/projects', { title: 'Bounded', isPublished: 'yes' }, tokens[0])
  assert.equal(extra.status, 400)
  const current = await projectModel.findById(project.id)
  assert.equal(current.name, 'Private')
  assert.equal(current.publishDetails.notes, '')
  const valid = await api.request('PUT', path, {
    title: 'Bounded update',
    description: 'Still valid',
    publishDetails: { companyName: 'Kanvora', website: 'https://kanvora.test', contactEmail: 'owner@kanvora.test', notes: 'ok' }
  }, tokens[0])
  assert.equal(valid.status, 200)
  assert.equal(valid.data.payload.title, 'Bounded update')
})

test('list/card structural fields and forged nested metadata cannot be mass assigned', async (t) => {
  const { api, project, list, card, foreign, tokens } = await fixture(t)
  const attacks = [
    [`lists/${list.id}`, { projectId: new mongoose.Types.ObjectId().toString() }],
    [`cards/${card.id}`, { creatorId: foreign.id }],
    [`cards/${card.id}`, { comments: [{ body: 'forged', authorId: foreign.id }] }],
    [`cards/${card.id}`, { reactions: [{ emoji: 'x', userId: foreign.id }] }],
    [`cards/${card.id}`, { attachment: [] }],
    [`cards/${card.id}`, { coverImage: { url: 'https://example.invalid', publicId: 'forged' } }],
    [`cards/${card.id}`, { labels: [{ text: 'ok', color: 'red', publicId: 'forged' }] }],
    [`cards/${card.id}`, { memberIds: [foreign.id] }],
    [`cards/${card.id}`, { watchers: [foreign.id] }],
    [`cards/${card.id}`, { subtasks: [{ title: 'x', assigneeId: foreign.id }] }]
  ]
  for (const [path, body] of attacks) {
    assert.equal((await api.request('PUT', `/projects-api/${path}`, body, tokens[0])).status, 400, JSON.stringify(body))
  }
  assert.equal(String((await ListModel.findById(list.id)).projectId), project.id)
})

test('removed workspace membership, missing/deleted parents and archived boards fail closed', async (t) => {
  const { api, project, workspace, list, card, tokens } = await fixture(t)
  await WorkspaceModel.updateOne({ _id: workspace.id }, { $set: { members: [] } })
  for (const path of [`projects/${project.id}`, `projects/${project.id}/export`, `projects/${project.id}/analytics`, `lists/${list.id}/cards`]) {
    assert.ok([403, 404].includes((await api.request('GET', `/projects-api/${path}`, undefined, tokens[2])).status), path)
  }
  for (const suffix of ['', '/recent']) {
    const response = await api.request('GET', `/projects-api/projects${suffix}`, undefined, tokens[2])
    assert.equal(response.status, 200)
    assert.equal(response.data.payload.length, 0)
  }
  await projectModel.updateOne({ _id: project.id }, { $set: { archivedAt: new Date() } })
  assert.equal((await api.request('PUT', `/projects-api/cards/${card.id}`, { title: 'denied' }, tokens[0])).status, 404)
  await projectModel.updateOne({ _id: project.id }, { $set: { status: false, archivedAt: null } })
  assert.equal((await api.request('PUT', `/projects-api/lists/${list.id}`, { title: 'denied' }, tokens[0])).status, 404)
  await projectModel.updateOne({ _id: project.id }, { $set: { status: true } })
  await WorkspaceModel.deleteOne({ _id: workspace.id })
  assert.ok([403, 404].includes((await api.request('GET', `/projects-api/projects/${project.id}`, undefined, tokens[0])).status))
})

test('invalid IDs, inactive cards and mismatched list ancestry are rejected', async (t) => {
  const { api, card, list, tokens } = await fixture(t)
  assert.equal((await api.request('PUT', '/projects-api/cards/bad', { title: 'x' }, tokens[0])).status, 400)
  await taskModel.updateOne({ _id: card.id }, { $set: { isActive: false } })
  assert.equal((await api.request('PUT', `/projects-api/cards/${card.id}`, { title: 'x' }, tokens[0])).status, 404)
  await taskModel.updateOne({ _id: card.id }, { $set: { isActive: true } })
  await ListModel.updateOne({ _id: list.id }, { $set: { projectId: new mongoose.Types.ObjectId() } })
  assert.equal((await api.request('PUT', `/projects-api/cards/${card.id}`, { title: 'x' }, tokens[0])).status, 404)
})

test('shared authorization contract enforces role ceilings and standalone creator-only containment', async (t) => {
  const { api, owner, member, viewer, foreign, project, workspace, tokens } = await fixture(t)
  assert.equal(workspaceRole(workspace, owner.id), 'OWNER')
  assert.equal(await getWorkspaceRole(workspace.id, owner.id), 'OWNER')
  assert.equal(workspaceRole(workspace, { _id: owner.id }), null)
  assert.equal(await canAccessProject(project, { id: owner.id }), false)
  assert.equal(await canManageProject(project, viewer.id), false)
  assert.equal(await canManageProject(project, member.id), false)
  await projectModel.updateOne({ _id: project.id }, { $set: { creatorId: member.id } })
  const ownProject = await projectModel.findById(project.id)
  assert.equal(await canManageProject(ownProject, member.id), true)
  await WorkspaceModel.updateOne({ _id: workspace.id }, { $set: { 'permissions.MEMBER.manageBoards': false } })
  assert.equal(await canAccessProject(ownProject, member.id), true)
  assert.equal(await canEditProject(ownProject, member.id), false)
  assert.equal(await canManageProject(ownProject, member.id), false)
  assert.equal(await canEditProject(ownProject, owner.id), true)
  assert.equal((await api.request('POST', '/projects-api/projects', { title: 'Denied', workspaceId: workspace.id }, tokens[2])).status, 403)
  await WorkspaceModel.updateOne({ _id: workspace.id }, { $set: { members: [{ user: member.id, role: 'ADMIN' }] } })
  assert.equal(await canManageProject(project, member.id), true)
  await WorkspaceModel.updateOne({ _id: workspace.id }, { $set: { members: [{ user: member.id, role: 'MANAGER' }] } })
  assert.equal(await canManageProject(project, member.id), true)
  const standalone = await projectModel.create({ name: 'Standalone', creatorId: owner.id, members: [member.id, foreign.id], isPublished: true, isEditable: true })
  assert.equal(await canAccessProject(standalone, owner.id), true)
  assert.equal(await canAccessProject(standalone, member.id), false)
  assert.equal(await canEditProject(standalone, foreign.id), false)
})

test('safe card fields survive validation and moves remain within their parent project', async (t) => {
  const { api, owner, member, project, list, card, tokens } = await fixture(t)
  const target = await ListModel.create({ title: 'Same project', projectId: project.id })
  const otherProject = await projectModel.create({ name: 'Other', creatorId: owner.id })
  const foreignList = await ListModel.create({ title: 'Other project', projectId: otherProject.id })
  const body = { title: 'Safe update', description: 'plain', richDescription: '<p>safe</p>', priority: 'HIGH', status: 'IN-PROGRESS',
    dueDate: '2027-01-01T00:00:00.000Z', estimatedMinutes: 45, recurring: { enabled: true, interval: 'WEEKLY' },
    labels: [{ text: 'Tag', color: '#abcdef' }], subtasks: [{ title: 'Subtask', completed: false, assigneeId: member.id }],
    checklists: [{ title: 'Checklist', items: [{ title: 'Item', completed: true }] }],
    memberIds: [member.id], watchers: [owner.id], order: 2, listId: target.id }
  const response = await api.request('PUT', `/projects-api/cards/${card.id}`, body, tokens[1])
  assert.equal(response.status, 200)
  assert.equal(response.data.payload.memberId._id, member.id)
  assert.equal(response.data.payload.listId, target.id)
  const updated = await taskModel.findById(card.id)
  assert.equal(updated.checklists[0].items[0].completed, true)
  assert.equal(await findTask(card.id, member.id, 'edit') !== null, true)
  for (const invalid of [{ listId: foreignList.id }, { listId: null }, { priority: 'INVALID' }, { order: -1 }, { title: [] },
    { subtasks: [{ title: 'x', completed: 'false' }] }, { checklists: [{ title: 'x', items: [{ title: 'x', authorId: owner.id }] }] },
    // Contract guard for V5: the client refuses to send a blank checklist
    // title, and that only stays correct while the server keeps rejecting one.
    // A checklist with items and a checklist without items are both refused.
    { checklists: [{ title: '   ', items: [{ title: 'x', completed: false }] }] },
    { checklists: [{ title: '   ', items: [] }] },
    { checklists: [{ title: '\n\t ', items: [{ title: 'x', completed: false }] }] },
    { watchers: [member.id, member.id] }, { description: 'x'.repeat(50001) }, { $set: { projectId: otherProject.id } }]) {
    assert.equal((await api.request('PUT', `/projects-api/cards/${card.id}`, invalid, tokens[0])).status, 400, JSON.stringify(invalid).slice(0, 150))
  }
  // An untitled checklist is still rejected, and the stored card is untouched.
  const afterRejections = await taskModel.findById(card.id)
  assert.equal(afterRejections.checklists[0].title, 'Checklist')
  assert.equal((await api.request('POST', `/projects-api/lists/${list.id}/cards`, { title: 'Create', memberId: member.id }, tokens[1])).status, 201)
  assert.equal((await api.request('POST', `/projects-api/lists/${list.id}/cards`, { title: 'No forgery', comments: [] }, tokens[1])).status, 400)
  assert.equal((await api.request('GET', `/projects-api/projects?workspaceId=${project.workspace}`, undefined, tokens[1])).data.payload.length, 1)
})

test('export and analytics omit orphaned or mismatched card ancestry', async (t) => {
  const { api, project, card, tokens } = await fixture(t)
  await taskModel.updateOne({ _id: card.id }, { $set: { listId: new mongoose.Types.ObjectId() } })
  const exported = await api.request('GET', `/projects-api/projects/${project.id}/export`, undefined, tokens[0])
  assert.equal(exported.status, 200)
  assert.equal(exported.data.payload.cards.length, 0)
  const analytics = await api.request('GET', `/projects-api/projects/${project.id}/analytics`, undefined, tokens[0])
  assert.equal(analytics.status, 200)
  assert.equal(analytics.data.payload.totals.cards, 0)
})

test('inactive workspaces and populated missing workspaces cannot fall back to creator access', async (t) => {
  const { owner, project, workspace } = await fixture(t)
  await projectModel.updateOne({ _id: project.id }, { $set: { creatorId: owner.id } })
  await WorkspaceModel.collection.updateOne({ _id: workspace._id }, { $set: { isActive: false } })
  assert.equal(await canAccessProject(await projectModel.findById(project.id), owner.id), false)
  await WorkspaceModel.deleteOne({ _id: workspace.id })
  const populated = await projectModel.findById(project.id).populate('workspace')
  assert.equal(populated.workspace, null)
  assert.equal(await canAccessProject(populated, owner.id), false)
})

test('deleting a list does not delete mismatched cards belonging to a foreign project', async (t) => {
  const { api, list, tokens } = await fixture(t)
  const foreignProjectId = new mongoose.Types.ObjectId()
  const foreignCard = await taskModel.create({ title: 'Foreign card', projectId: foreignProjectId, listId: list.id })
  assert.equal((await api.request('DELETE', `/projects-api/lists/${list.id}`, undefined, tokens[0])).status, 200)
  assert.notEqual(await taskModel.findById(foreignCard.id), null)
})

test('authorized boards beyond 100 remain retrievable with scoped deterministic cursor pagination', async (t) => {
  const { api, owner, foreign, project, workspace, tokens } = await fixture(t)
  const timestamp = new Date('2026-01-01T00:00:00.000Z')
  const boards = await projectModel.insertMany(Array.from({ length: 112 }, (_, index) => ({
    name: `Board ${index}`, workspace: workspace.id, creatorId: owner.id, updatedAt: timestamp
  })))
  await projectModel.create({ name: 'Foreign published', creatorId: foreign.id, members: [owner.id], isPublished: true, isEditable: true })
  const expected = new Set([project.id, ...boards.map((board) => board.id)])
  const seen = []
  let cursor = ''
  let firstCursor
  for (let page = 0; page < 5; page++) {
    const response = await api.request('GET', `/projects-api/projects?limit=40${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, undefined, tokens[0])
    assert.equal(response.status, 200)
    assert.ok(response.data.payload.length <= 40)
    assert.equal(typeof response.data.hasMore, 'boolean')
    seen.push(...response.data.payload.map((board) => board._id))
    if (!response.data.hasMore) {
      assert.equal(response.data.nextCursor, null)
      break
    }
    assert.equal(typeof response.data.nextCursor, 'string')
    cursor = response.data.nextCursor
    firstCursor ||= cursor
  }
  assert.equal(seen.length, expected.size)
  assert.deepEqual(new Set(seen), expected)
  const first = await api.request('GET', '/projects-api/projects?limit=40', undefined, tokens[0])
  const repeated = await api.request('GET', '/projects-api/projects?limit=40', undefined, tokens[0])
  assert.deepEqual(first.data.payload.map((board) => board._id), repeated.data.payload.map((board) => board._id))
  for (const query of ['cursor=not-a-cursor', 'cursor=%7B%22%24ne%22%3Anull%7D', 'limit=101', 'limit=0', 'limit=1.5', 'cursor[x]=y',
    `cursor=${encodeURIComponent(firstCursor)}&workspaceId=${workspace.id}`]) {
    assert.equal((await api.request('GET', `/projects-api/projects?${query}`, undefined, tokens[0])).status, 400, query)
  }
  assert.equal((await api.request('GET', `/projects-api/projects?cursor=${encodeURIComponent(firstCursor)}`, undefined, tokens[3])).status, 400)
  assert.equal((await api.request('GET', `/projects-api/projects/recent?cursor=${encodeURIComponent(firstCursor)}`, undefined, tokens[0])).status, 400)
  const recent = await api.request('GET', '/projects-api/projects/recent', undefined, tokens[0])
  assert.equal(recent.data.payload.length, 5)
  assert.equal(recent.data.hasMore, true)
  assert.equal(typeof recent.data.nextCursor, 'string')
  await WorkspaceModel.updateOne({ _id: workspace.id }, { $set: { owner: foreign.id, members: [] } })
  const revoked = await api.request('GET', `/projects-api/projects?cursor=${encodeURIComponent(firstCursor)}`, undefined, tokens[0])
  assert.equal(revoked.status, 200)
  assert.deepEqual(revoked.data.payload, [])
  assert.equal(revoked.data.hasMore, false)
  assert.equal(revoked.data.nextCursor, null)
})

test('pagination replenishes rejected candidates across bounded query batches', async (t) => {
  const { api, owner, workspace, tokens } = await fixture(t)
  await projectModel.insertMany(Array.from({ length: 112 }, (_, index) => ({ name: `Candidate ${index}`, workspace: workspace.id, creatorId: owner.id })))
  const lookup = WorkspaceModel.findById.bind(WorkspaceModel)
  let checked = 0
  const authorization = t.mock.method(WorkspaceModel, 'findById', (...args) => {
    checked++
    const query = lookup(...args)
    // Preserve the Mongoose query/session contract while simulating revoked candidates.
    if (checked <= 100) t.mock.method(query, 'exec', async () => null)
    return query
  })
  try {
    const response = await api.request('GET', '/projects-api/projects?limit=10', undefined, tokens[0])
    assert.equal(response.status, 200)
    assert.equal(response.data.payload.length, 10)
    assert.equal(response.data.hasMore, true)
    assert.equal(checked, 111)
  } finally {
    authorization.mock.restore()
  }
})

test('restore is explicit and retains current scoped management ceilings and parent checks', async (t) => {
  const { api, owner, member, project, workspace, list, tokens } = await fixture(t)
  const archive = () => projectModel.updateOne({ _id: project.id }, { $set: { archivedAt: new Date() } })
  const restore = (token) => api.request('PUT', `/projects-api/projects/${project.id}/archive`, { archived: false }, token)
  await archive()
  assert.equal((await restore(tokens[0])).status, 200)
  assert.equal((await projectModel.findById(project.id)).archivedAt, null)
  await archive()
  assert.equal((await restore(tokens[2])).status, 403)
  assert.equal((await api.request('PUT', `/projects-api/lists/${list.id}`, { title: 'Still denied' }, tokens[0])).status, 404)
  assert.equal((await api.request('PUT', `/projects-api/projects/${project.id}`, { title: 'Still denied' }, tokens[0])).status, 403)
  await WorkspaceModel.updateOne({ _id: workspace.id }, { $set: { members: [{ user: member.id, role: 'MANAGER' }] } })
  assert.equal((await restore(tokens[1])).status, 200)
  await archive()
  await WorkspaceModel.updateOne({ _id: workspace.id }, { $set: { 'permissions.MANAGER.manageBoards': false } })
  assert.equal((await restore(tokens[1])).status, 403)
  await WorkspaceModel.updateOne({ _id: workspace.id }, { $set: { members: [] } })
  await projectModel.updateOne({ _id: project.id }, { $set: { creatorId: member.id } })
  assert.equal((await restore(tokens[1])).status, 403)
  const standalone = await projectModel.create({ name: 'Standalone archived', creatorId: owner.id, archivedAt: new Date() })
  assert.equal((await api.request('PUT', `/projects-api/projects/${standalone.id}/archive`, { archived: false }, tokens[0])).status, 200)
  await projectModel.updateOne({ _id: project.id }, { $set: { status: false } })
  assert.equal((await restore(tokens[0])).status, 403)
  await projectModel.updateOne({ _id: project.id }, { $set: { status: true } })
  await WorkspaceModel.deleteOne({ _id: workspace.id })
  assert.equal((await restore(tokens[0])).status, 403)
})
