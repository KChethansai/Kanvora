import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { io as connect } from 'socket.io-client'
import { testApi } from '../helpers/api.js'

test('workspace authority, consent and retention', async (t) => {
  const api = await testApi(t)
  const { UserModel } = await import('../../models/usermodel.js')
  const { WorkspaceModel } = await import('../../models/Workspace.js')
  const { default: Invitation } = await import('../../models/Invitation.js')
  const { projectModel } = await import('../../models/ProjectModel.js')
  const { ListModel } = await import('../../models/ListModel.js')
  const { taskModel } = await import('../../models/Taskmodel.js')
  const users = await UserModel.create(['owner', 'admin', 'manager', 'member', 'viewer', 'outside', 'recipient', 'unverified'].map((name) => ({ name, email: `${name}@example.test`, password: 'synthetic-password', emailVerified: name !== 'unverified', role: name === 'outside' ? 'ADMIN' : 'VIEWER' })))
  const [owner, admin, manager, member, viewer, outside, recipient, unverified] = users
  const tokens = await Promise.all(users.map(api.tokenFor))
  const workspace = await WorkspaceModel.create({ name: '<b>Workspace</b>', owner: owner._id, members: users.slice(1, 5).map((user, i) => ({ user: user._id, role: ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'][i] })) })
  const path = `/api/workspaces/${workspace._id}`
  const project = await projectModel.create({ name: 'Retained', workspace: workspace._id, creatorId: owner._id, members: [viewer._id] })
  const list = await ListModel.create({ title: 'Retained', projectId: project._id })
  const card = await taskModel.create({ title: 'Retained', projectId: project._id, listId: list._id })
  await t.test('rejects membership injection and account-role authority', async () => {
    assert.equal((await api.request('POST', '/api/workspaces', { name: 'Injected', members: [{ user: outside._id, role: 'ADMIN' }] }, tokens[0])).status, 400)
    assert.equal((await api.request('PUT', path, { members: [] }, tokens[2])).status, 400)
    assert.equal((await api.request('PUT', path, { name: 'intrusion' }, tokens[5])).status, 403)
    assert.equal((await api.request('PUT', path, { name: 'Renamed' }, tokens[1])).status, 200)
  })
  await t.test('role ceilings and current permissions', async () => {
    assert.equal((await api.request('PATCH', `${path}/members/${member._id}`, { role: 'MANAGER', user: outside._id }, tokens[0])).status, 400)
    assert.equal((await api.request('POST', `${path}/members`, { email: recipient.email, role: 'ADMIN' }, tokens[1])).status, 403)
    assert.equal((await api.request('POST', `${path}/members`, { email: recipient.email, role: 'MANAGER' }, tokens[2])).status, 403)
    assert.equal((await api.request('POST', `${path}/members`, { email: recipient.email, role: 'VIEWER' }, tokens[3])).status, 403)
    assert.equal((await api.request('PATCH', `${path}/members/${manager._id}`, { role: 'ADMIN' }, tokens[2])).status, 403)
    assert.equal((await api.request('PATCH', `${path}/members/${admin._id}`, { role: 'MEMBER' }, tokens[2])).status, 403)
    assert.equal((await api.request('PATCH', `${path}/members/${member._id}`, { role: 'MANAGER' }, tokens[0])).status, 200)
    assert.equal((await api.request('PUT', `${path}/permissions`, { permissions: { MEMBER: { manageMembers: true } } }, tokens[0])).status, 400)
    assert.equal((await api.request('PUT', `${path}/permissions`, { permissions: { MANAGER: { manageMembers: false } } }, tokens[1])).status, 403)
    assert.equal((await api.request('PUT', `${path}/permissions`, { permissions: { MANAGER: { manageMembers: false } } }, tokens[0])).status, 200)
    assert.equal((await api.request('POST', `${path}/members`, { email: recipient.email, role: 'MEMBER' }, tokens[2])).status, 403)
  })
  await t.test('mail-only tokens, atomic consent, replay and legacy denial', async () => {
    const sent = await api.request('POST', `${path}/members`, { email: recipient.email, role: 'ADMIN' }, tokens[0])
    assert.equal(sent.status, 200)
    assert.equal((await WorkspaceModel.findById(workspace._id)).members.some((m) => m.user.equals(recipient._id)), false)
    const raw = api.mailbox.at(-1).text.match(/invite=([a-f0-9]{64})/)[1]
    const stored = await Invitation.findOne({ workspace: workspace._id, email: recipient.email })
    assert.equal(stored.tokenHash, crypto.createHash('sha256').update(raw).digest('hex'))
    assert.notEqual(stored.token, raw)
    assert.equal(JSON.stringify(sent.data).includes(raw), false)
    assert.equal(api.mailbox.at(-1).html.includes('<b>Workspace</b>'), false)
    const analytics = await api.request('GET', `${path}/analytics`, undefined, tokens[4])
    assert.equal(JSON.stringify(analytics.data).includes(stored.token), false)
    assert.deepEqual(analytics.data.payload.invitations, [])
    const managementAnalytics = await api.request('GET', `${path}/analytics`, undefined, tokens[0])
    assert.equal(JSON.stringify(managementAnalytics.data).includes(stored.token), false)
    assert.equal(managementAnalytics.data.payload.invitations[0].email, recipient.email)
    assert.equal((await api.request('POST', '/api/invitations/accept', { token: raw }, tokens[5])).status, 403)
    const accepted = await Promise.all([1, 2].map(() => api.request('POST', '/api/invitations/accept', { token: raw }, tokens[6])))
    assert.deepEqual(accepted.map((r) => r.status).sort(), [200, 404])
    assert.equal((await WorkspaceModel.findById(workspace._id)).members.filter((m) => m.user.equals(recipient._id)).length, 1)
    assert.equal((await api.request('POST', '/api/invitations/accept', { token: raw }, tokens[6])).status, 404)
    await Invitation.create({ workspace: workspace._id, email: outside.email, token: 'a'.repeat(64), expiresAt: new Date(Date.now() + 60000) })
    assert.equal((await api.request('POST', '/api/invitations/accept', { token: 'a'.repeat(64) }, tokens[5])).status, 404)
  })
  await t.test('invitation acceptance activates an unverified legacy user account', async () => {
    assert.equal((await api.request('POST', `${path}/members`, { email: unverified.email, role: 'MEMBER' }, tokens[0])).status, 200)
    const raw = api.mailbox.at(-1).text.match(/invite=([a-f0-9]{64})/)[1]
    assert.equal((await api.request('POST', '/api/invitations/accept', { token: raw }, tokens[7])).status, 200)
    assert.equal((await UserModel.findById(unverified._id)).emailVerified, true)
  })
  await t.test('acceptance rechecks live inviter ceilings and never upgrades existing members', async () => {
    assert.equal((await api.request('POST', `${path}/members`, { email: outside.email, role: 'MANAGER' }, tokens[1])).status, 200)
    const raw = api.mailbox.at(-1).text.match(/invite=([a-f0-9]{64})/)[1]
    assert.equal((await api.request('PATCH', `${path}/members/${admin._id}`, { role: 'VIEWER' }, tokens[0])).status, 200)
    assert.equal((await api.request('POST', '/api/invitations/accept', { token: raw }, tokens[5])).status, 403)
    assert.equal((await api.request('PATCH', `${path}/members/${admin._id}`, { role: 'ADMIN' }, tokens[0])).status, 200)
    const current = await WorkspaceModel.findById(workspace._id)
    current.members.push({ user: outside._id, role: 'VIEWER' })
    await current.save()
    assert.equal((await api.request('POST', '/api/invitations/accept', { token: raw }, tokens[5])).status, 200)
    assert.equal((await WorkspaceModel.findById(workspace._id)).members.find((m) => m.user.equals(outside._id)).role, 'VIEWER')
    assert.equal((await api.request('DELETE', `${path}/members/${outside._id}`, undefined, tokens[0])).status, 200)
  })
  await t.test('cards and counts require matching list/project ancestry', async () => {
    const otherProject = await projectModel.create({ name: 'Other', creatorId: outside._id })
    const otherList = await ListModel.create({ title: 'Other', projectId: otherProject._id })
    await taskModel.create({ title: 'Forged', projectId: project._id, listId: otherList._id })
    const cards = await api.request('GET', `${path}/cards`, undefined, tokens[4])
    assert.deepEqual(cards.data.payload.map((item) => item.title), ['Retained'])
    assert.equal((await api.request('GET', `${path}/analytics`, undefined, tokens[4])).data.payload.totals.cards, 1)
  })
  await t.test('revocation survives project lookup failure without passive broadcasts', async (t) => {
    for (const action of ['permissions', 'demotion', 'removal', 'deletion']) {
      await t.test(action, async (t) => {
        const current = await WorkspaceModel.create({ name: action, owner: owner._id, members: [{ user: viewer._id, role: 'MEMBER' }] })
        const board = await projectModel.create({ name: action, workspace: current._id, creatorId: owner._id })
        const room = `project:${board._id}`
        const socket = connect(api.base, { transports: ['websocket'], reconnection: false, auth: { token: tokens[4] }, extraHeaders: { Origin: 'http://localhost:5173' } })
        t.after(() => socket.disconnect())
        await once(socket, 'connect')
        const socketId = socket.id
        const joined = await new Promise((resolve, reject) => socket.timeout(1500).emit('join-project', String(board._id), (error, result) => error ? reject(error) : resolve(result)))
        assert.equal(joined.ok, true)
        let ownerSocket
        let ownerSocketId
        if (['permissions', 'deletion'].includes(action)) {
          ownerSocket = connect(api.base, { transports: ['websocket'], reconnection: false, auth: { token: tokens[0] }, extraHeaders: { Origin: 'http://localhost:5173' } })
          t.after(() => ownerSocket.disconnect())
          await once(ownerSocket, 'connect')
          ownerSocketId = ownerSocket.id
          const ownerJoined = await new Promise((resolve, reject) => ownerSocket.timeout(1500).emit('join-project', String(board._id), (error, result) => error ? reject(error) : resolve(result)))
          assert.equal(ownerJoined.ok, true)
        }
        const baseline = Promise.all([once(socket, 'activity-created'), ...(ownerSocket ? [once(ownerSocket, 'activity-created')] : [])])
        api.io.to(room).emit('activity-created', { message: 'Before revocation' })
        await baseline
        let broadcasts = 0
        socket.on('activity-created', () => { broadcasts++ })
        ownerSocket?.on('activity-created', () => { broadcasts++ })
        const lookup = t.mock.method(projectModel, 'find', () => { throw new Error('Synthetic project lookup failure') })
        const prefix = `/api/workspaces/${current._id}`
        const [method, route, body] = action === 'permissions'
          ? ['PUT', `${prefix}/permissions`, { permissions: { MEMBER: { manageBoards: false } } }]
          : action === 'demotion' ? ['PATCH', `${prefix}/members/${viewer._id}`, { role: 'VIEWER' }]
            : ['DELETE', action === 'removal' ? `${prefix}/members/${viewer._id}` : prefix, undefined]
        const response = await api.request(method, route, body, tokens[0])
        const calls = lookup.mock.callCount()
        lookup.mock.restore()
        api.io.to(room).emit('activity-created', { message: 'Must not reach revoked subscribers' })
        await delay(50)
        assert.equal(broadcasts, 0)
        assert.equal(api.io.sockets.sockets.has(socketId), false)
        assert.equal(socket.connected, false)
        if (ownerSocket) {
          assert.equal(api.io.sockets.sockets.has(ownerSocketId), false)
          assert.equal(ownerSocket.connected, false)
        }
        assert.equal(response.status, 200)
        assert.equal(calls, 0, 'eviction must not depend on a project database lookup')
        const saved = await WorkspaceModel.findById(current._id)
        if (action === 'permissions') assert.equal(saved.permissions.MEMBER.manageBoards, false)
        if (action === 'demotion') assert.equal(saved.members[0].role, 'VIEWER')
        if (action === 'removal') assert.equal(saved.members.length, 0)
        if (action === 'deletion') assert.equal(saved.status, false)
      })
    }
  })
  await t.test('scoped literal search, removal and soft deletion', async () => {
    assert.equal((await api.request('GET', '/api/users/search-all?q=owner', undefined, tokens[0])).status, 400)
    assert.equal((await api.request('GET', `/api/users/search-all?workspaceId=${workspace._id}&q=owner`, undefined, tokens[5])).status, 403)
    assert.deepEqual((await api.request('GET', `/api/users/search-all?workspaceId=${workspace._id}&q=.*`, undefined, tokens[0])).data.payload, [])
    assert.equal((await api.request('GET', `${path}/analytics?q[bad]=x`, undefined, tokens[0])).status, 400)
    assert.equal((await api.request('DELETE', `${path}/members/${owner._id}`, undefined, tokens[0])).status, 403)
    assert.equal((await api.request('DELETE', `${path}/members/${viewer._id}`, undefined, tokens[4])).status, 200)
    assert.equal((await api.request('GET', path, undefined, tokens[4])).status, 403)
    assert.equal((await api.request('DELETE', path, undefined, tokens[1])).status, 403)
    assert.equal((await api.request('DELETE', path, undefined, tokens[0])).status, 200)
    const retained = await WorkspaceModel.findById(workspace._id)
    assert.equal(retained.status, false)
    assert.ok(retained.deletedAt)
    assert.ok(await projectModel.findById(project._id))
    assert.ok(await ListModel.findById(list._id))
    assert.ok(await taskModel.findById(card._id))
    assert.equal((await projectModel.findById(project._id)).members.some((id) => id.equals(viewer._id)), true)
    assert.equal((await api.request('GET', path, undefined, tokens[0])).status, 403)
  })
})
