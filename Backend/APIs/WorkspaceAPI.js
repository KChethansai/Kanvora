// WorkspaceAPI routes: Express endpoints for this backend resource.
import express from 'express'
import {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  addMember,
  acceptInvitation,
  removeMember,
  changeMemberRole,
  revokeWorkspaceAccess
} from '../controllers/workspaceController.js'
import { verifyRolesToken } from '../middlewares/verifyRolesToekn.js'
import { UserModel } from '../models/usermodel.js'
import { WorkspaceModel } from '../models/Workspace.js'
import { projectModel } from '../models/ProjectModel.js'
import { ListModel } from '../models/ListModel.js'
import { taskModel } from '../models/Taskmodel.js'
import { ActivityModel } from '../models/Activity.js'
import InvitationModel from '../models/Invitation.js'
import { workspaceCan } from '../authorization/workspacePolicy.js'

const ACTION_LABELS = {
  CREATED_TASK: 'created a card',
  UPDATED_TASK: 'updated a card',
  ASSIGNED_USER: 'assigned a member',
  COMMENT_ADDED: 'added a comment',
  MEMBER_ADDED: 'added a member',
  MEMBER_REMOVED: 'removed a member',
  INVITE_SENT: 'sent an invite',
  INVITE_ACCEPTED: 'accepted an invite',
  BOARD_ARCHIVED: 'archived a board',
  BOARD_IMPORTED: 'imported a board',
  BOARD_EXPORTED: 'exported a board'
}

const getWorkspaceProjects = async (workspaceId) =>
  projectModel
    .find({ workspace: workspaceId, status: true })
    .select('_id title name')
    .maxTimeMS(5000)
    .lean()

const formatActivityEntry = (activity, projectById) => {
  const actorName =
    activity.actor?.name || activity.actor?.email || 'Someone'
  const verb =
    ACTION_LABELS[activity.action] ||
    activity.action?.replace(/_/g, ' ').toLowerCase() ||
    'updated the board'
  const projectName =
    projectById[activity.project?.toString()] || 'a project'

  return {
    ...activity,
    projectName,
    message: `${actorName} ${verb} in ${projectName}`
  }
}

export const workspaceApp = express.Router()

const auth = verifyRolesToken('MEMBER', 'ADMIN', 'MANAGER', 'VIEWER')
const write = auth

const canAccessWorkspaceDoc = (workspace, userId) => workspaceCan(workspace, userId, 'read')

const canManageWorkspaceDoc = (workspace, userId) => {
  return workspaceCan(workspace, userId, 'managePermissions')
}

const validId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)
const literal = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
workspaceApp.use((req, res, next) => {
  const q = req.query.q
  if ((q !== undefined && (typeof q !== 'string' || q.length > 100)) ||
      (req.query.page !== undefined && (typeof req.query.page !== 'string' || !/^[1-9]\d{0,3}$/.test(req.query.page))) ||
      (req.query.status !== undefined && !['ACTIVE', 'ARCHIVED'].includes(req.query.status))) return res.status(400).json({ message: 'Invalid query' })
  next()
})
workspaceApp.param('id', (req, res, next, id) => validId(id) ? next() : res.status(400).json({ message: 'Invalid workspace ID' }))
workspaceApp.param('userId', (req, res, next, id) => validId(id) ? next() : res.status(400).json({ message: 'Invalid user ID' }))

//create + get all
workspaceApp
  .route('/workspaces')
  .post(auth, createWorkspace)
  .get(auth, getWorkspaces)

//single workspace
workspaceApp
  .route('/workspaces/:id')
  .get(auth, getWorkspaceById)
  .put(write, updateWorkspace)
  .delete(write, deleteWorkspace)

//add member
workspaceApp.post('/workspaces/:id/members', write, addMember)

//remove member
workspaceApp.delete('/workspaces/:id/members/:userId', write, removeMember)
workspaceApp.patch('/workspaces/:id/members/:userId', write, changeMemberRole)

workspaceApp.get('/workspaces/:id/activity', auth, async (req, res, next) => {
  try {
    const workspace = await WorkspaceModel.findById(req.params.id)
    if (!canAccessWorkspaceDoc(workspace, req.user.id)) {
      return res.status(403).json({ message: 'Workspace access denied' })
    }

    const projects = await getWorkspaceProjects(req.params.id)
    const projectById = Object.fromEntries(
      projects.map((project) => [
        project._id.toString(),
        project.title || project.name || 'Project'
      ])
    )
    const projectIds = projects.map((project) => project._id)

    const activities = await ActivityModel.find({
      project: { $in: projectIds }
    })
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .skip((Number(req.query.page || 1) - 1) * 100)
      .limit(100)
      .maxTimeMS(5000)
      .lean()

    res.status(200).json({
      message: 'Workspace activity fetched',
      payload: activities.map((item) => formatActivityEntry(item, projectById))
    })
  } catch (err) {
    next(err)
  }
})

workspaceApp.get('/workspaces/:id/cards', auth, async (req, res, next) => {
  try {
    const workspace = await WorkspaceModel.findById(req.params.id)
    if (!canAccessWorkspaceDoc(workspace, req.user.id)) {
      return res.status(403).json({ message: 'Workspace access denied' })
    }

    const projects = await getWorkspaceProjects(req.params.id)
    const projectById = Object.fromEntries(
      projects.map((project) => [
        project._id.toString(),
        project.title || project.name || 'Project'
      ])
    )
    const projectIds = projects.map((project) => project._id)

    if (projectIds.length === 0) {
      return res.status(200).json({ message: 'Workspace cards fetched', payload: [] })
    }

    const lists = await ListModel.find({ projectId: { $in: projectIds } }).select('_id title projectId').maxTimeMS(5000).lean()
    const cards = await
      taskModel
        .find({ isActive: true, $or: lists.map((list) => ({ projectId: list.projectId, listId: list._id })).concat([{ _id: null }]) })
        .populate('memberId', 'name email profilePic')
        .populate('memberIds', 'name email profilePic')
        .sort({ updatedAt: -1 })
        .skip((Number(req.query.page || 1) - 1) * 100).limit(100).maxTimeMS(5000).lean()

    const listById = Object.fromEntries(
      lists.map((list) => [list._id.toString(), list.title || 'List'])
    )

    const payload = cards.map((card) => ({
      ...card,
      projectName: projectById[card.projectId?.toString()] || 'Project',
      listTitle: listById[card.listId?.toString()] || ''
    }))

    res.status(200).json({ message: 'Workspace cards fetched', payload })
  } catch (err) {
    next(err)
  }
})

workspaceApp.get('/workspaces/:id/analytics', auth, async (req, res, next) => {
  try {
    const workspace = await WorkspaceModel.findById(req.params.id)
    if (!canAccessWorkspaceDoc(workspace, req.user.id)) {
      return res.status(403).json({ message: 'Workspace access denied' })
    }
    const { q, status } = req.query
    const projectQuery = { workspace: req.params.id, status: true }

    if (q && q.trim()) {
      const searchRegex = literal(q.trim())
      projectQuery.$or = [
        { title: searchRegex },
        { name: searchRegex }
      ]
    }

    if (status === 'ACTIVE') {
      projectQuery.archivedAt = null
    } else if (status === 'ARCHIVED') {
      projectQuery.archivedAt = { $ne: null }
    }

    const projects = await projectModel
      .find(projectQuery)
      .select('_id title name archivedAt members updatedAt')
      .maxTimeMS(5000)
      .lean()
    const projectIds = projects.map((project) => project._id)
    const lists = await ListModel.find({ projectId: { $in: projectIds } }).select('_id projectId').maxTimeMS(5000).lean()
    const cardScope = { isActive: true, $or: lists.map((list) => ({ projectId: list.projectId, listId: list._id })).concat([{ _id: null }]) }
    const managesMembers = workspaceCan(workspace, req.user.id, 'manageMembers')
    const [cards, activities, invitations] = await Promise.all([
      taskModel.find(cardScope).select('memberId memberIds status dueDate').maxTimeMS(5000).lean(),
      ActivityModel.find({ project: { $in: projectIds } })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate('actor', 'name email profilePic')
        .maxTimeMS(5000).lean(),
      managesMembers ? InvitationModel.find({ workspace: req.params.id }).select('_id email role expiresAt createdAt').sort({ createdAt: -1 }).limit(100).maxTimeMS(5000).lean() : []
    ])
    const invitationCount = await InvitationModel.countDocuments({ workspace: req.params.id }).maxTimeMS(5000)
    const workloadCounts = {}
    for (const card of cards) {
      const assigneeIds = []
      if (Array.isArray(card.memberIds) && card.memberIds.length > 0) {
        assigneeIds.push(...card.memberIds.map((id) => id.toString()))
      } else if (card.memberId) {
        assigneeIds.push(card.memberId.toString())
      }

      if (assigneeIds.length === 0) {
        workloadCounts.unassigned = (workloadCounts.unassigned || 0) + 1
        continue
      }

      for (const userId of new Set(assigneeIds)) {
        workloadCounts[userId] = (workloadCounts[userId] || 0) + 1
      }
    }

    const userIds = Object.keys(workloadCounts).filter((key) => key !== 'unassigned')
    const users = userIds.length
      ? await UserModel.find({ _id: { $in: userIds } }).select('name email').lean()
      : []
    const nameById = Object.fromEntries(
      users.map((user) => [user._id.toString(), user.name || user.email || 'Unknown member'])
    )

    const workload = Object.entries(workloadCounts)
      .map(([key, count]) => ({
        userId: key === 'unassigned' ? null : key,
        name: key === 'unassigned' ? 'Unassigned' : nameById[key] || 'Unknown member',
        count
      }))
      .sort((a, b) => b.count - a.count)

    res.status(200).json({
      message: 'Workspace analytics fetched',
      payload: {
        totals: {
          projects: projects.length,
          archivedProjects: projects.filter((project) => project.archivedAt).length,
          cards: cards.length,
           invitations: invitationCount
        },
        productivity: {
          done: cards.filter((card) => card.status === 'DONE').length,
          overdue: cards.filter(
            (card) => card.dueDate && new Date(card.dueDate) < new Date() && card.status !== 'DONE'
          ).length
        },
        workload: managesMembers ? workload : [],
        recentActivity: managesMembers ? activities : [],
        invitations
      }
    })
  } catch (err) {
    next(err)
  }
})

workspaceApp.get('/workspaces/:id/permissions', auth, async (req, res, next) => {
  try {
    const workspace = await WorkspaceModel.findById(req.params.id).lean()
    if (!canAccessWorkspaceDoc(workspace, req.user.id)) {
      return res.status(403).json({ message: 'Workspace access denied' })
    }
    res.status(200).json({
      message: 'Workspace permissions fetched',
      payload: workspace.permissions || {}
    })
  } catch (err) {
    next(err)
  }
})

workspaceApp.put('/workspaces/:id/permissions', write, async (req, res, next) => {
  try {
    const permissions = req.body?.permissions
    const ceilings = { ADMIN: ['manageWorkspace', 'manageMembers', 'manageBoards'], MANAGER: ['manageMembers', 'manageBoards'], MEMBER: ['manageBoards'], VIEWER: [] }
    if (!req.body || Object.keys(req.body).some((key) => key !== 'permissions') || !permissions || typeof permissions !== 'object' || Array.isArray(permissions) || !Object.keys(permissions).length || Object.entries(permissions).some(([role, values]) => !Object.hasOwn(ceilings, role) || !values || typeof values !== 'object' || Array.isArray(values) || Object.entries(values).some(([key, value]) => !['manageWorkspace', 'manageMembers', 'manageBoards'].includes(key) || typeof value !== 'boolean' || (value && !ceilings[role].includes(key))))) return res.status(400).json({ message: 'Invalid permissions' })
    const workspace = await WorkspaceModel.findById(req.params.id)
    if (!canManageWorkspaceDoc(workspace, req.user.id)) {
      return res.status(403).json({ message: 'Workspace access denied' })
    }
    for (const [role, values] of Object.entries(permissions)) for (const [key, value] of Object.entries(values)) workspace.set(`permissions.${role}.${key}`, value)
    await workspace.save()
    revokeWorkspaceAccess(workspace)
    res.status(200).json({ message: 'Workspace permissions updated', payload: workspace.permissions })
  } catch (err) {
    next(err)
  }
})

//user search by email - used by invite flow
workspaceApp.get('/users/search', auth, async (req, res, next) => {
  try {
    const { email } = req.query
    if (typeof email !== 'string' || email.length > 254 || !validId(req.query.workspaceId))
      return res.status(400).json({ message: 'email query param required' })
    const workspace = await WorkspaceModel.findById(req.query.workspaceId)
    if (!workspaceCan(workspace, req.user.id, 'read')) return res.status(403).json({ message: 'Workspace access denied' })
    const user = await UserModel.findOne({
      _id: { $in: [workspace.owner, ...workspace.members.map((m) => m.user)] },
      email: email.toLowerCase().trim()
    }).select('_id name email profilePic').maxTimeMS(5000)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.status(200).json({ message: 'User found', payload: user })
  } catch (err) {
    next(err)
  }
})

// search users globally by name or email (partial matching)
workspaceApp.get('/users/search-all', auth, async (req, res, next) => {
  try {
    const { q } = req.query
    if (!validId(req.query.workspaceId)) return res.status(400).json({ message: 'workspaceId required' })
    const workspace = await WorkspaceModel.findById(req.query.workspaceId)
    if (!workspaceCan(workspace, req.user.id, 'read')) return res.status(403).json({ message: 'Workspace access denied' })
    if (!q || !q.trim()) {
      return res.status(200).json({ message: 'Search completed', payload: [] })
    }
    const regex = literal(q.trim())
    const users = await UserModel.find({
      _id: { $in: [workspace.owner, ...workspace.members.map((m) => m.user)] },
      $or: [
        { name: regex },
        { email: regex }
      ]
    })
      .select('_id name email profilePic')
      .limit(10)
      .maxTimeMS(5000)
      .lean()
    res.status(200).json({ message: 'Users found', payload: users })
  } catch (err) {
    next(err)
  }
})

//accept invitation (authenticated)
workspaceApp.post('/invitations/accept', auth, acceptInvitation)
