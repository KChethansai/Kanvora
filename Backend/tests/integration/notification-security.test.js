import test from 'node:test'
import assert from 'node:assert/strict'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { projectModel } from '../../models/ProjectModel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { NotificationModel } from '../../models/NotificationModel.js'
import { canAccessProject, canEditProject, canManageProject } from '../../authorization/resources.js'

async function fixture(t) {
  const api = await testApi(t)
  const users = await UserModel.create(['Owner', 'Member', 'Other'].map((name) => ({ name, email: `${name.toLowerCase()}@example.test`, password: 'synthetic-password', emailVerified: true })))
  const tokens = await Promise.all(users.map((user) => api.tokenFor(user)))
  const project = await projectModel.create({ name: 'Private', creatorId: users[0]._id, members: [users[1]._id] })
  const request = (index, method, path, body) => api.request(method, `/notifications${path}`, body, tokens[index])
  return { api, users, project, request }
}

const latestInvite = (user, project) => NotificationModel.findOne({
  user: user._id, project: project._id, type: 'invite'
}).sort({ _id: -1 })

test('legacy members and outsiders cannot invite; strict invite input and inactive projects fail closed', async (t) => {
  const { users, project, request } = await fixture(t)
  const body = { projectId: project.id, recipientEmail: users[2].email }
  for (const actor of [1, 2]) assert.equal((await request(actor, 'POST', '/invite', body)).status, 404)
  for (const extra of [{ role: 'ADMIN' }, { members: [users[2].id] }, { recipientEmail: {} }, { projectId: 'bad' }]) {
    assert.equal((await request(0, 'POST', '/invite', { ...body, ...extra })).status, 400)
  }
  await projectModel.updateOne({ _id: project._id }, { archivedAt: new Date() })
  assert.equal((await request(0, 'POST', '/invite', body)).status, 404)
})

test('invite responses do not disclose whether an address is registered', async (t) => {
  const { users, project, request } = await fixture(t)
  const unknown = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: 'nobody@example.test' })
  const known = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email })
  assert.equal(unknown.status, 201)
  assert.equal(known.status, 201)
  assert.deepEqual(unknown.data, known.data)
  assert.equal(unknown.data.payload, undefined)
  assert.equal(await NotificationModel.countDocuments({ project: project._id }), 1)
})

test('new invites atomically grant only explicit standalone roles, reject replay and concurrent acceptance', async (t) => {
  const { users, project, request } = await fixture(t)
  assert.equal(await canAccessProject(project, users[1].id), false)
  assert.notEqual(project.membershipVersion, 1)
  const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email, role: 'MEMBER' })
  assert.equal(sent.status, 201)
  const inviteId = (await latestInvite(users[1], project)).id
  assert.equal((await request(2, 'POST', `/${inviteId}/accept`)).status, 404)
  const results = await Promise.all([request(1, 'POST', `/${inviteId}/accept`), request(1, 'POST', `/${inviteId}/accept`)])
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 404])
  assert.equal((await request(1, 'POST', `/${inviteId}/accept`)).status, 404)
  const current = await projectModel.findById(project.id)
  assert.equal(current.membershipVersion, 1)
  assert.equal(current.directGrants.length, 1)
  assert.equal(String(current.directGrants[0].grantedBy), users[0].id)
  assert.equal(await canAccessProject(current, users[1].id), true)
  assert.equal(await canEditProject(current, users[1].id), true)
  assert.equal(await canManageProject(current, users[1].id), false)
  assert.equal((await request(1, 'POST', '/invite', { projectId: project.id, recipientEmail: users[2].email })).status, 404)
})

test('expired, legacy, changed-email and revoked-sender invites never grant access', async (t) => {
  const { users, project, request } = await fixture(t)
  for (const changes of [{ invitationVersion: 0 }, { expiresAt: new Date(0) }, { recipientEmail: 'different@example.test' }]) {
    const invite = await NotificationModel.create({ user: users[1]._id, sender: users[0]._id, project: project._id, message: 'Invite', type: 'invite', invitationVersion: 2, recipientEmail: users[1].email, grantRole: 'MEMBER', expiresAt: new Date(Date.now() + 60000), ...changes })
    assert.equal((await request(1, 'POST', `/${invite.id}/accept`)).status, 404)
    assert.equal((await NotificationModel.findById(invite.id)).status, 'pending')
    await request(1, 'POST', `/${invite.id}/reject`)
  }
  const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email, role: 'VIEWER' })
  assert.equal(sent.status, 201)
  const issued = await latestInvite(users[1], project)
  await projectModel.updateOne({ _id: project._id }, { creatorId: users[2]._id })
  assert.equal((await request(1, 'POST', `/${issued.id}/accept`)).status, 404)
  assert.equal((await projectModel.findById(project.id)).directGrants.length, 0)
})

test('workspace outsiders cannot receive direct grants and removed members cannot accept', async (t) => {
  const { users, project, request } = await fixture(t)
  const workspace = await WorkspaceModel.create({ name: 'Workspace', owner: users[0]._id, members: [{ user: users[1]._id, role: 'VIEWER' }] })
  project.workspace = workspace._id
  await project.save()
  assert.equal((await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[2].email })).status, 201)
  assert.equal(await NotificationModel.exists({ user: users[2]._id, project: project._id, type: 'invite' }), null)
  const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email })
  assert.equal(sent.status, 201)
  const issued = await latestInvite(users[1], project)
  assert.equal((await request(1, 'POST', `/${issued.id}/accept`)).status, 200)
  const current = await projectModel.findById(project.id)
  assert.equal(current.directGrants.length, 0)
  assert.equal(await canEditProject(current, users[1].id), false)
  const invite = await NotificationModel.create({ user: users[1]._id, sender: users[0]._id, project: project._id, message: 'Invite', type: 'invite', invitationVersion: 2, recipientEmail: users[1].email, grantRole: 'MEMBER', expiresAt: new Date(Date.now() + 60000) })
  await WorkspaceModel.updateOne({ _id: workspace._id }, { $set: { members: [] } })
  assert.equal((await request(1, 'POST', `/${invite.id}/accept`)).status, 404)
  assert.equal(await canAccessProject(current, users[1].id), false)
})

test('notification CRUD is recipient scoped, bounded, projected and safe-linked', async (t) => {
  const { users, project, request } = await fixture(t)
  const notification = await NotificationModel.create({ user: users[1]._id, sender: users[0]._id, project: project._id, message: 'Activity', readLink: 'javascript:alert(1)' })
  for (const [method, path] of [['PUT', '/read'], ['DELETE', ''], ['POST', '/reject']]) {
    assert.equal((await request(2, method, `/${notification.id}${path}`)).status, 404)
    const bad = await request(1, method, `/bad${path}`)
    assert.equal(bad.status, 400)
    assert.equal(bad.data.reason, undefined)
  }
  for (const query of ['?limit=-1', '?page=bad', '?limit=999', '?page=1.5']) assert.equal((await request(1, 'GET', query)).status, 400)
  const listed = await request(1, 'GET', '')
  assert.equal(listed.status, 200)
  assert.equal(listed.data.payload[0].readLink, '')
  assert.equal(listed.data.payload[0].sender.email, undefined)
  assert.equal(listed.data.payload[0].recipientEmail, undefined)
  assert.equal((await request(2, 'GET', '')).data.payload.length, 0)
})

test('viewer grants remain read only; acceptance never activates unversioned grants or promotes an existing grant', async (t) => {
  const { users, project, request } = await fixture(t)
  await projectModel.updateOne({ _id: project._id }, { $set: { directGrants: [{ user: users[2]._id, role: 'MEMBER', grantedBy: users[0]._id, createdAt: new Date() }] } })
  assert.equal(await canAccessProject(await projectModel.findById(project.id), users[2].id), false)
  const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email, role: 'VIEWER' })
  assert.equal(sent.status, 201)
  const first = await latestInvite(users[1], project)
  assert.equal((await request(1, 'POST', `/${first.id}/accept`)).status, 200)
  const current = await projectModel.findById(project.id)
  assert.equal(await canAccessProject(current, users[1].id), true)
  assert.equal(await canEditProject(current, users[1].id), false)
  assert.equal(await canManageProject(current, users[1].id), false)
  assert.equal(await canAccessProject(current, users[2].id), false)
  const another = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email, role: 'MEMBER' })
  const second = await latestInvite(users[1], project)
  assert.equal((await request(1, 'POST', `/${second.id}/accept`)).status, 200)
  assert.equal(await canEditProject(await projectModel.findById(project.id), users[1].id), false)
})

test('project scope changes and inactive resources invalidate outstanding invitations', async (t) => {
  const { users, project, request } = await fixture(t)
  const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email })
  const issued = await latestInvite(users[1], project)
  const path = `/${issued.id}/accept`
  for (const changes of [{ status: false }, { status: true, archivedAt: new Date() }]) {
    await projectModel.updateOne({ _id: project._id }, { $set: changes })
    assert.equal((await request(1, 'POST', path)).status, 404)
  }
  const workspace = await WorkspaceModel.create({ name: 'New scope', owner: users[0]._id })
  await projectModel.updateOne({ _id: project._id }, { $set: { archivedAt: null, workspace: workspace._id } })
  assert.equal((await request(1, 'POST', path)).status, 404)
  assert.equal((await NotificationModel.findById(issued.id)).status, 'pending')
  assert.equal((await projectModel.findById(project.id)).directGrants.length, 0)
})

test('failed invite consumption rolls back the grant and emits nothing; retry succeeds', async (t) => {
  const { api, users, project, request } = await fixture(t)
  const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email })
  assert.equal(sent.status, 201)
  const issued = await latestInvite(users[1], project)
  const save = NotificationModel.prototype.save
  const failSave = t.mock.method(NotificationModel.prototype, 'save', function (...args) {
    if (this.status === 'accepted') throw new Error('synthetic persistence failure')
    return save.apply(this, args)
  })
  const to = api.io.to
  const emit = t.mock.method(api.io, 'to', function (...args) { return to.apply(this, args) })
  const response = await request(1, 'POST', `/${issued.id}/accept`)
  assert.equal(response.status, 500)
  assert.equal(response.data.reason, undefined)
  assert.equal(emit.mock.callCount(), 0)
  assert.equal((await projectModel.findById(project.id)).directGrants.length, 0)
  assert.equal((await NotificationModel.findById(issued.id)).status, 'pending')
  failSave.mock.restore()
  assert.equal((await request(1, 'POST', `/${issued.id}/accept`)).status, 200)
  assert.equal(emit.mock.callCount(), 1)
})

test('separate concurrent invitations preserve both recipient grants', async (t) => {
  const { users, project, request } = await fixture(t)
  assert.equal((await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email })).status, 201)
  assert.equal((await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[2].email, role: 'VIEWER' })).status, 201)
  const [first, second] = await Promise.all([latestInvite(users[1], project), latestInvite(users[2], project)])
  const accepted = await Promise.all([request(1, 'POST', `/${first.id}/accept`), request(2, 'POST', `/${second.id}/accept`)])
  assert.deepEqual(accepted.map((result) => result.status), [200, 200])
  const current = await projectModel.findById(project.id)
  assert.equal(current.directGrants.length, 2)
  assert.equal(await canEditProject(current, users[1].id), true)
  assert.equal(await canEditProject(current, users[2].id), false)
})

test('invitations are bound to their exact issuance scope, not just their project ID', async (t) => {
  for (const transition of ['workspace-to-standalone', 'workspace-to-workspace', 'standalone-to-workspace']) {
    await t.test(transition, async (t) => {
      const { users, project, request } = await fixture(t)
      const workspace = await WorkspaceModel.create({ name: 'Source', owner: users[0]._id, members: [{ user: users[1]._id, role: 'MEMBER' }] })
      const destination = await WorkspaceModel.create({ name: 'Destination', owner: users[0]._id, members: [{ user: users[1]._id, role: 'MEMBER' }] })
      if (transition !== 'standalone-to-workspace') {
        project.workspace = workspace._id
        await project.save()
      }
      const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email })
      assert.equal(sent.status, 201)
      const issued = await latestInvite(users[1], project)
      if (transition === 'workspace-to-standalone') {
        await WorkspaceModel.updateOne({ _id: workspace._id }, { $set: { members: [] } })
      }
      await projectModel.updateOne({ _id: project._id }, { $set: { workspace: transition === 'workspace-to-standalone' ? null : destination._id } })
      assert.equal((await request(1, 'POST', `/${issued.id}/accept`)).status, 404)
      assert.equal((await NotificationModel.findById(issued.id)).status, 'pending')
      const current = await projectModel.findById(project.id)
      assert.equal(current.directGrants.length, 0)
      assert.notEqual(current.membershipVersion, 1)
    })
  }
})

test('version 2 invitations without issuance metadata require reissue', async (t) => {
  const { users, project, request } = await fixture(t)
  const invite = await NotificationModel.create({ user: users[1]._id, sender: users[0]._id, project: project._id,
    message: 'Old local v2 invitation', type: 'invite', invitationVersion: 2, recipientEmail: users[1].email,
    grantRole: 'MEMBER', expiresAt: new Date(Date.now() + 60000) })
  assert.equal((await request(1, 'POST', `/${invite.id}/accept`)).status, 404)
  assert.equal((await NotificationModel.findById(invite.id)).status, 'pending')
  assert.equal((await projectModel.findById(project.id)).directGrants.length, 0)
})

test('deleted issuers, revoked board management and inactive resources cannot authorize acceptance', async (t) => {
  for (const invalidation of ['deleted-issuer', 'manageBoards', 'project-inactive', 'workspace-inactive']) {
    await t.test(invalidation, async (t) => {
      const { users, project, request } = await fixture(t)
      const workspace = await WorkspaceModel.create({ name: 'Authority', owner: users[2]._id,
        members: [{ user: users[0]._id, role: 'ADMIN' }, { user: users[1]._id, role: 'VIEWER' }] })
      project.workspace = workspace._id
      await project.save()
      const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email })
      assert.equal(sent.status, 201)
      const issued = await latestInvite(users[1], project)
      if (invalidation === 'deleted-issuer') await UserModel.deleteOne({ _id: users[0]._id })
      if (invalidation === 'manageBoards') await WorkspaceModel.updateOne({ _id: workspace._id }, { $set: { 'permissions.ADMIN.manageBoards': false } })
      if (invalidation === 'project-inactive') await projectModel.updateOne({ _id: project._id }, { $set: { status: false } })
      if (invalidation === 'workspace-inactive') await WorkspaceModel.updateOne({ _id: workspace._id }, { $set: { status: false } })
      assert.equal((await request(1, 'POST', `/${issued.id}/accept`)).status, 404)
      assert.equal((await NotificationModel.findById(issued.id)).status, 'pending')
      assert.equal((await projectModel.findById(project.id)).directGrants.length, 0)
    })
  }
})

test('two invitations accepted concurrently by the same recipient create one grant without promotion', async (t) => {
  const { users, project, request } = await fixture(t)
  const sent = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email, role: 'VIEWER' })
  assert.equal(sent.status, 201)
  const issued = await latestInvite(users[1], project)
  const first = await NotificationModel.findById(issued.id).select('+recipientEmail').lean()
  const { _id, __v, createdAt, updatedAt, ...copy } = first
  const second = await NotificationModel.create(copy)
  const accepted = await Promise.all([request(1, 'POST', `/${first._id}/accept`), request(1, 'POST', `/${second.id}/accept`)])
  assert.deepEqual(accepted.map((result) => result.status), [200, 200])
  const current = await projectModel.findById(project.id)
  assert.equal(current.directGrants.length, 1)
  assert.equal(current.directGrants[0].role, 'VIEWER')
  assert.equal(await canEditProject(current, users[1].id), false)
  const stronger = await request(0, 'POST', '/invite', { projectId: project.id, recipientEmail: users[1].email, role: 'MEMBER' })
  assert.equal(stronger.status, 201)
  const strongerInvite = await latestInvite(users[1], project)
  assert.equal((await request(1, 'POST', `/${strongerInvite.id}/accept`)).status, 200)
  assert.equal((await projectModel.findById(project.id)).directGrants.length, 1)
  assert.equal(await canEditProject(await projectModel.findById(project.id), users[1].id), false)
})
