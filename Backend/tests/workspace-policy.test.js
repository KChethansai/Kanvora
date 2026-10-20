import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceCan, workspaceRole } from '../authorization/workspacePolicy.js'

const ids = ['1', '2', '3', '4', '5', '6'].map((n) => n.repeat(24))
const [owner, admin, manager, member, viewer, outsider] = ids
const workspace = { owner, status: true, members: [
  { user: admin, role: 'ADMIN' }, { user: manager, role: 'MANAGER' },
  { user: member, role: 'MEMBER' }, { user: viewer, role: 'VIEWER' }
] }

test('workspace authority is scoped and refuses inactive resources', () => {
  assert.equal(workspaceRole(workspace, owner), 'OWNER')
  assert.equal(workspaceRole(workspace, outsider), null)
  assert.equal(workspaceCan({ ...workspace, status: false }, owner, 'read'), false)
  assert.equal(workspaceCan(workspace, outsider, 'manageMembers'), false)
  assert.equal(workspaceCan(workspace, viewer, 'read'), true)
  assert.equal(workspaceCan(workspace, viewer, 'manageBoards'), false)
  assert.equal(workspaceCan(workspace, member, 'manageBoards'), true)
  assert.equal(workspaceCan(workspace, admin, 'deleteWorkspace'), false)
  assert.equal(workspaceCan(workspace, owner, 'deleteWorkspace'), true)
  assert.equal(workspaceCan(workspace, owner, 'unknown'), false)
})

test('invitation grants cannot exceed the actor role ceiling', () => {
  assert.equal(workspaceCan(workspace, member, 'invite', { role: 'MANAGER' }), false)
  assert.equal(workspaceCan(workspace, manager, 'invite', { role: 'MANAGER' }), false)
  assert.equal(workspaceCan(workspace, manager, 'invite', { role: 'MEMBER' }), true)
  assert.equal(workspaceCan(workspace, admin, 'invite', { role: 'ADMIN' }), false)
  assert.equal(workspaceCan(workspace, admin, 'invite', { role: 'MANAGER' }), true)
  assert.equal(workspaceCan(workspace, owner, 'invite', { role: 'ADMIN' }), true)
})

test('owner and peers are protected; nonowners can leave without management power', () => {
  assert.equal(workspaceCan(workspace, admin, 'changeRole', { targetUserId: owner, role: 'MEMBER' }), false)
  assert.equal(workspaceCan(workspace, manager, 'changeRole', { targetUserId: admin, role: 'MEMBER' }), false)
  assert.equal(workspaceCan(workspace, manager, 'changeRole', { targetUserId: member, role: 'VIEWER' }), true)
  assert.equal(workspaceCan(workspace, member, 'changeRole', { targetUserId: member, role: 'ADMIN' }), false)
  assert.equal(workspaceCan(workspace, owner, 'removeMember', { targetUserId: owner }), false)
  assert.equal(workspaceCan(workspace, viewer, 'removeMember', { targetUserId: viewer }), true)
  assert.equal(workspaceCan(workspace, manager, 'removeMember', { targetUserId: admin }), false)
})

test('configuration can reduce authority but cannot elevate role ceilings', () => {
  const reduced = { ...workspace, permissions: { MANAGER: { manageMembers: false },
    MEMBER: { manageMembers: true, manageWorkspace: true, manageBoards: false } } }
  assert.equal(workspaceCan(reduced, manager, 'invite', { role: 'MEMBER' }), false)
  assert.equal(workspaceCan(reduced, member, 'manageWorkspace'), false)
  assert.equal(workspaceCan(reduced, member, 'manageMembers'), false)
  assert.equal(workspaceCan(reduced, member, 'manageBoards'), false)
  assert.equal(workspaceCan(reduced, owner, 'manageMembers'), true)
  assert.equal(workspaceCan(workspace, admin, 'managePermissions'), false)
  assert.equal(workspaceCan(workspace, owner, 'managePermissions'), true)
})

test('ambiguous duplicate legacy memberships cannot select the more privileged role', () => {
  const ambiguous = { ...workspace, members: [...workspace.members, { user: member, role: 'ADMIN' }] }
  assert.equal(workspaceRole(ambiguous, member), null)
  assert.equal(workspaceCan(ambiguous, member, 'read'), false)
  assert.equal(workspaceCan(ambiguous, member, 'manageMembers'), false)
  assert.equal(workspaceRole(ambiguous, owner), 'OWNER')
})
