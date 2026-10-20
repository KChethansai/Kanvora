import mongoose from 'mongoose'
import { projectModel } from '../models/ProjectModel.js'
import { ListModel } from '../models/ListModel.js'
import { taskModel } from '../models/Taskmodel.js'
import { WorkspaceModel } from '../models/Workspace.js'

const id = (value) => value?._id?.toString() || value?.toString()
const validActor = (userId) => typeof userId === 'string' && /^[a-f\d]{24}$/i.test(userId)
const activeWorkspace = (workspace) => workspace &&
  (workspace.get ? workspace.get('status') : workspace.status) !== false &&
  (workspace.get ? workspace.get('isActive') : workspace.isActive) !== false

export function workspaceRole(workspace, userId) {
  if (!validActor(userId) || !activeWorkspace(workspace)) return null
  if (id(workspace.owner) === userId) return 'OWNER'
  const role = workspace.members?.find((member) => id(member.user) === userId)?.role
  return ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'].includes(role) ? role : null
}

export async function getWorkspaceRole(workspaceId, userId) {
  if (!validActor(userId) || !mongoose.isObjectIdOrHexString(id(workspaceId))) return null
  return workspaceRole(await WorkspaceModel.findById(id(workspaceId)), userId)
}

async function allowed(project, userId, action) {
  if (!validActor(userId) || !project || project.status === false) return false
  if (!['read', 'restore'].includes(action) && project.archivedAt) return false
  const workspaceId = project.populated?.('workspace') || project.workspace
  if (!workspaceId) return id(project.creatorId) === userId
  const workspace = await WorkspaceModel.findById(id(workspaceId))
  const role = workspaceRole(workspace, userId)
  if (!role) return false
  if (action === 'read' || role === 'OWNER') return true
  if (workspace.permissions?.[role]?.manageBoards === false) return false
  if (action === 'edit') return ['ADMIN', 'MANAGER', 'MEMBER'].includes(role)
  return ['ADMIN', 'MANAGER'].includes(role) || (role === 'MEMBER' && id(project.creatorId) === userId)
}

export async function canAccessProject(project, userId) { return allowed(project, userId, 'read') }
export async function canEditProject(project, userId) { return allowed(project, userId, 'edit') }
export async function canManageProject(project, userId) { return allowed(project, userId, 'manage') }

function validateId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) {
    const error = new Error('Invalid resource ID')
    error.status = 400
    throw error
  }
}

export async function findProject(projectId, userId, action = 'read') {
  validateId(projectId)
  if (!['read', 'edit', 'manage', 'restore'].includes(action)) return null
  const project = await projectModel.findById(projectId)
  return await allowed(project, userId, action) ? project : null
}

export async function findList(listId, userId, action = 'read') {
  validateId(listId)
  if (!['read', 'edit', 'manage'].includes(action)) return null
  const list = await ListModel.findById(listId)
  if (!list?.projectId) return null
  return await findProject(list.projectId, userId, action) ? list : null
}

export async function findTask(taskId, userId, action = 'read') {
  validateId(taskId)
  if (!['read', 'edit', 'manage'].includes(action)) return null
  const task = await taskModel.findById(taskId)
  if (!task || task.isActive !== true || !task.projectId || !task.listId) return null
  const list = await ListModel.findById(task.listId)
  if (!list || id(list.projectId) !== id(task.projectId)) return null
  return await findProject(task.projectId, userId, action) ? task : null
}
