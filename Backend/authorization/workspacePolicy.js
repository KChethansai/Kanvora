const id = (value) => value?._id?.toString() || value?.toString()
const validId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
const ranks = { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1, VIEWER: 0 }

export function workspaceRole(workspace, userId) {
  if (!validId(userId) || !workspace ||
    (workspace.get ? workspace.get('status') : workspace.status) === false ||
    (workspace.get ? workspace.get('isActive') : workspace.isActive) === false) return null
  if (id(workspace.owner) === userId) return 'OWNER'
  const matches = (workspace.members || []).filter((member) => id(member.user) === userId)
  // Duplicate legacy entries are ambiguous, so refuse to select either role.
  if (matches.length > 1) return null
  const role = matches[0]?.role
  return ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'].includes(role) ? role : null
}

export function workspaceCan(workspace, actorId, action, options = {}) {
  const role = workspaceRole(workspace, actorId)
  if (!role) return false
  const reduced = (capability) => workspace.permissions?.[role]?.[capability] === false
  const managesMembers = role === 'OWNER' ||
    (['ADMIN', 'MANAGER'].includes(role) && !reduced('manageMembers'))
  const grantable = (nextRole) => ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'].includes(nextRole) &&
    managesMembers && ranks[nextRole] < ranks[role]
  if (action === 'read') return true
  if (action === 'deleteWorkspace' || action === 'managePermissions') return role === 'OWNER'
  if (action === 'manageWorkspace') return role === 'OWNER' || (role === 'ADMIN' && !reduced('manageWorkspace'))
  if (action === 'manageMembers') return managesMembers
  if (action === 'manageBoards') return role === 'OWNER' ||
    (['ADMIN', 'MANAGER', 'MEMBER'].includes(role) && !reduced('manageBoards'))
  if (action === 'invite') return grantable(options.role)
  if (!['changeRole', 'removeMember'].includes(action) || !validId(options.targetUserId)) return false
  if (id(workspace.owner) === options.targetUserId) return false
  const targetRole = workspaceRole(workspace, options.targetUserId)
  if (!targetRole) return false
  if (action === 'removeMember' && options.targetUserId === actorId) return true
  if (options.targetUserId === actorId || !managesMembers || ranks[targetRole] >= ranks[role]) return false
  return action === 'removeMember' || grantable(options.role)
}
