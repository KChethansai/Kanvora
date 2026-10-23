// Comment notifications must follow current workspace membership, not the
// membership snapshot stored on the project at creation time.
import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'
import { NotificationModel } from '../../models/NotificationModel.js'

const waitForNotification = async (userId, { absent = false, timeoutMs = 3000 } = {}) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const rows = await NotificationModel.find({ user: userId, type: 'card' }).lean()
    if (absent ? rows.length === 0 : rows.length > 0) return rows
    if (Date.now() >= deadline) return rows
    await delay(50)
  }
}

const board = async ({ projectMembers = [], workspaceMembers = [], assignee }) => {
  const owner = await UserModel.create({ name: 'Owner', email: `owner-${Date.now()}@test.invalid`, password: 'synthetic-password' })
  const joiner = await UserModel.create({ name: 'Joiner', email: `joiner-${Date.now()}@test.invalid`, password: 'synthetic-password', username: 'joiner' })
  const outsider = await UserModel.create({ name: 'Outsider', email: `outsider-${Date.now()}@test.invalid`, password: 'synthetic-password' })
  const workspace = await WorkspaceModel.create({
    name: 'Notify', owner: owner._id, members: workspaceMembers.map((user) => ({ user: user._id, role: 'MEMBER' }))
  })
  const project = await projectModel.create({
    name: 'Notify board', workspace: workspace._id, creatorId: owner._id,
    // A deliberately stale snapshot: the workspace members are not copied here.
    members: projectMembers.map((user) => user._id), isPublished: true, isEditable: true
  })
  const list = await ListModel.create({ title: 'Backlog', projectId: project._id })
  const card = await taskModel.create({
    title: 'Review the brief', listId: list._id, projectId: project._id, creatorId: owner._id,
    memberId: assignee?._id, memberIds: assignee ? [assignee._id] : []
  })
  return { owner, joiner, outsider, workspace, project, list, card }
}

test('a workspace member who joined after the project was created is notified as an assignee', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'w-owner@test.invalid', password: 'synthetic-password' })
  const joiner = await UserModel.create({ name: 'Joiner', email: 'w-joiner@test.invalid', password: 'synthetic-password' })
  const workspace = await WorkspaceModel.create({ name: 'Notify', owner: owner._id, members: [] })
  const project = await projectModel.create({
    name: 'Notify board', workspace: workspace._id, creatorId: owner._id,
    members: [owner._id], isPublished: true, isEditable: true
  })
  const list = await ListModel.create({ title: 'Backlog', projectId: project._id })
  const card = await taskModel.create({
    title: 'Review the brief', listId: list._id, projectId: project._id, creatorId: owner._id,
    memberId: joiner._id, memberIds: [joiner._id]
  })
  // The joiner accepts an invitation after the project already exists.
  await WorkspaceModel.updateOne({ _id: workspace._id }, { $push: { members: { user: joiner._id, role: 'MEMBER' } } })

  const comment = await api.request('POST', '/api/comment', { taskId: String(card._id), body: 'Please take a look' }, await api.tokenFor(owner))
  assert.equal(comment.status, 201)

  const notifications = await waitForNotification(joiner._id)
  assert.equal(notifications.length, 1, 'the new member must receive the comment notification')
  // The stale project snapshot never mentioned them.
  assert.equal((await projectModel.findById(project._id)).members.map(String).includes(String(joiner._id)), false)
})

test('a revoked member and an outsider receive nothing, and duplicates collapse', async (t) => {
  const api = await testApi(t)
  const { owner, joiner, outsider, workspace, project, card } = await board({
    workspaceMembers: [],
    assignee: undefined,
    projectMembers: []
  })
  await WorkspaceModel.updateOne({ _id: workspace._id }, { $push: { members: { user: joiner._id, role: 'MEMBER' } } })
  await taskModel.updateOne({ _id: card._id }, { $set: { memberId: joiner._id, memberIds: [joiner._id, outsider._id] } })

  // Mentioning the assignee as well must not produce a second notification.
  const first = await api.request('POST', '/api/comment', { taskId: String(card._id), body: '@joiner please review' }, await api.tokenFor(owner))
  assert.equal(first.status, 201)
  const notified = await waitForNotification(joiner._id)
  assert.equal(notified.length, 1, 'a mention and an assignment must not double-notify')
  assert.equal((await waitForNotification(outsider._id, { absent: true, timeoutMs: 300 })).length, 0)

  await WorkspaceModel.updateOne({ _id: workspace._id }, { $pull: { members: { user: joiner._id } } })
  await NotificationModel.deleteMany({ user: joiner._id })
  const second = await api.request('POST', '/api/comment', { taskId: String(card._id), body: 'Second pass' }, await api.tokenFor(owner))
  assert.equal(second.status, 201)
  assert.equal((await waitForNotification(joiner._id, { absent: true })).length, 0, 'a revoked member must not be notified')
  assert.equal((await projectModel.findById(project._id)).creatorId.toString(), owner._id.toString())
})

test('a direct-grant personal project still notifies its grantee', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'p-owner@test.invalid', password: 'synthetic-password' })
  const grantee = await UserModel.create({ name: 'Grantee', email: 'p-grantee@test.invalid', password: 'synthetic-password' })
  const project = await projectModel.create({
    name: 'Personal board', creatorId: owner._id, membershipVersion: 1,
    directGrants: [{ user: grantee._id, role: 'MEMBER', grantedBy: owner._id, createdAt: new Date() }],
    isPublished: false, isEditable: true
  })
  const list = await ListModel.create({ title: 'Backlog', projectId: project._id })
  const card = await taskModel.create({
    title: 'Personal task', listId: list._id, projectId: project._id, creatorId: owner._id,
    memberId: grantee._id, memberIds: [grantee._id]
  })

  const comment = await api.request('POST', '/api/comment', { taskId: String(card._id), body: 'For you' }, await api.tokenFor(owner))
  assert.equal(comment.status, 201)
  assert.equal((await waitForNotification(grantee._id)).length, 1)
})
