// notificationController controller: request handlers and domain-side persistence logic.
import mongoose from 'mongoose'
import { NotificationModel } from '../models/NotificationModel.js'
import { projectModel } from '../models/ProjectModel.js'
import { WorkspaceModel } from '../models/Workspace.js'
import { UserModel } from '../models/usermodel.js'
import { findProject, workspaceRole } from '../authorization/resources.js'
import { logger } from '../utils/logger.js'
import { getIO } from '../socket.js'

const emitToUser = (userId, event, data) => {
  try { getIO().to(`user:${userId}`).emit(event, data) } catch { /* Socket may not be initialized. */ }
}
const validId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
const fields = '_id user sender project message type status readLink read createdAt updatedAt'
const safeNotification = (notification) => {
  const value = notification.toObject ? notification.toObject() : notification
  const result = Object.fromEntries(fields.split(' ').filter((key) => value[key] !== undefined).map((key) => [key, value[key]]))
  const projectId = value.project?._id || value.project
  const link = value.readLink || ''
  const base = `/projects/${projectId}`
  result.readLink = ['card', 'member', 'mention', 'invite', 'activity'].includes(value.type) &&
    (link === base || (['card', 'mention'].includes(value.type) && new RegExp(`^${base}\\?cardId=[a-f\\d]{24}$`, 'i').test(link))) ? link : ''
  return result
}
const populate = [{ path: 'sender', select: 'name profilePic' }, { path: 'project', select: 'name' }]
const failure = (res, error) => {
  logger.error('Notification operation failed:', error.name)
  return res.status(error.status === 400 ? 400 : 500).json({ message: error.status === 400 ? 'Invalid request' : 'Server error' })
}
const missing = (res) => res.status(404).json({ message: 'Notification or project not found' })
const checkId = (req, res) => {
  if (validId(req.params.id)) return true
  res.status(400).json({ message: 'Invalid notification ID' })
  return false
}

export const getNotifications = async (req, res) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 30 : Number(req.query.limit)
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ message: 'Invalid pagination' })
  }
  try {
    const notifications = await NotificationModel.find({ user: req.user.id }).select(fields)
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate(populate).lean()
    res.status(200).json({ message: 'Notifications fetched', payload: notifications.map(safeNotification) })
  } catch (error) { failure(res, error) }
}

export const markAllRead = async (req, res) => {
  try {
    await NotificationModel.updateMany({ user: req.user.id, read: false }, { $set: { read: true } })
    res.status(200).json({ message: 'All marked as read' })
  } catch (error) { failure(res, error) }
}

export const markOneRead = async (req, res) => {
  if (!checkId(req, res)) return
  try {
    const notification = await NotificationModel.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { $set: { read: true } }, { new: true }).select(fields).populate(populate)
    if (!notification) return missing(res)
    res.status(200).json({ message: 'Marked as read', payload: safeNotification(notification) })
  } catch (error) { failure(res, error) }
}

export const deleteNotification = async (req, res) => {
  if (!checkId(req, res)) return
  try {
    const notification = await NotificationModel.findOneAndDelete({ _id: req.params.id, user: req.user.id })
    if (!notification) return missing(res)
    res.status(200).json({ message: 'Notification deleted' })
  } catch (error) { failure(res, error) }
}

export const sendInvite = async (req, res) => {
  const body = req.body
  if (!body || Object.keys(body).some((key) => !['projectId', 'recipientEmail', 'role'].includes(key)) ||
    !validId(body.projectId) || typeof body.recipientEmail !== 'string' || body.recipientEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.recipientEmail.trim()) ||
    (body.role !== undefined && !['MEMBER', 'VIEWER'].includes(body.role))) {
    return res.status(400).json({ message: 'Invalid invitation' })
  }
  try {
    const project = await findProject(body.projectId, req.user.id, 'manage')
    if (!project) return missing(res)
    const recipient = await UserModel.findOne({ email: body.recipientEmail.toLowerCase().trim() }).select('email')
    if (!recipient) return missing(res)
    if (recipient.id === req.user.id) return res.status(400).json({ message: 'You cannot invite yourself' })
    if (project.workspace && !workspaceRole(await WorkspaceModel.findById(project.workspace), recipient.id)) {
      return res.status(403).json({ message: 'Workspace membership is required first' })
    }
    const scope = { issuanceScope: project.workspace ? 'workspace' : 'standalone', issuanceWorkspace: project.workspace || null }
    const duplicate = await NotificationModel.exists({ user: recipient._id, project: project._id, type: 'invite', status: 'pending', invitationVersion: 2, ...scope, expiresAt: { $gt: new Date() } })
    if (duplicate) return res.status(400).json({ message: 'An invite is already pending' })
    const sender = await UserModel.findById(req.user.id).select('name')
    const notification = await NotificationModel.create({ user: recipient._id, sender: req.user.id, project: project._id,
      type: 'invite', invitationVersion: 2, ...scope, recipientEmail: recipient.email, grantRole: body.role || 'MEMBER',
      expiresAt: new Date(Date.now() + 7 * 86400000), message: `${sender.name} invited you to join "${project.name}"`, readLink: `/projects/${project.id}` })
    await notification.populate(populate)
    const payload = safeNotification(notification)
    emitToUser(recipient.id, 'new-notification', payload)
    res.status(201).json({ message: 'Invite sent', payload })
  } catch (error) { failure(res, error) }
}

export const acceptInvite = async (req, res) => {
  if (!checkId(req, res)) return
  try {
    const accepted = await mongoose.connection.transaction(async (session) => {
      const notification = await NotificationModel.findOne({ _id: req.params.id, user: req.user.id,
        type: 'invite', status: 'pending', invitationVersion: 2, expiresAt: { $gt: new Date() } }).select('+recipientEmail').session(session)
      if (!notification || !['MEMBER', 'VIEWER'].includes(notification.grantRole)) return null
      const recipient = await UserModel.findById(req.user.id).select('email').session(session)
      const sender = await UserModel.findById(notification.sender).select('name profilePic').session(session).lean()
      if (!recipient || recipient.email !== notification.recipientEmail || !sender) return null
      const project = await findProject(notification.project, String(notification.sender), 'manage', session)
      if (!project) return null
      if (project.workspace) {
        if (notification.issuanceScope !== 'workspace' || String(notification.issuanceWorkspace) !== String(project.workspace)) return null
      } else if (notification.issuanceScope !== 'standalone' || notification.issuanceWorkspace !== null) return null
      let granted = false
      if (project.workspace) {
        const workspace = await WorkspaceModel.findById(project.workspace).session(session)
        if (!workspaceRole(workspace, req.user.id)) return null
        // Fence concurrent workspace membership/permission changes before consuming the invite.
        await WorkspaceModel.updateOne({ _id: workspace._id }, { $inc: { __v: 1 } }, { session })
      } else if (String(project.creatorId) !== req.user.id) {
        const grants = project.membershipVersion === 1 ? project.directGrants || [] : []
        project.directGrants = grants
        if (!grants.some((entry) => String(entry.user) === req.user.id)) {
          project.directGrants = [...grants, { user: req.user.id, role: notification.grantRole, grantedBy: notification.sender, createdAt: new Date() }]
          granted = true
        }
        project.membershipVersion = 1
      }
      // A project write fences deletion, archiving, ownership and scope changes as well as duplicate grants.
      await projectModel.updateOne({ _id: project._id }, { $set: { directGrants: project.directGrants, membershipVersion: project.membershipVersion, updatedAt: new Date() } }, { session })
      notification.status = 'accepted'
      notification.read = true
      await notification.save({ session })
      const payload = safeNotification({ ...notification.toObject(), sender, project: { _id: project._id, name: project.name } })
      return { payload, projectId: project.id, granted }
    })
    if (!accepted) return missing(res)
    if (accepted.granted) {
      try { getIO().to(`project:${accepted.projectId}`).emit('member-added', { userId: req.user.id, projectId: accepted.projectId }) } catch { /* Socket may not be initialized. */ }
    }
    res.status(200).json({ message: 'Invite accepted', payload: accepted.payload })
  } catch (error) { failure(res, error) }
}

export const rejectInvite = async (req, res) => {
  if (!checkId(req, res)) return
  try {
    const notification = await NotificationModel.findOneAndUpdate({ _id: req.params.id, user: req.user.id, type: 'invite', status: 'pending' }, { $set: { status: 'rejected', read: true } }, { new: true }).select(fields).populate(populate)
    if (!notification) return missing(res)
    res.status(200).json({ message: 'Invite rejected', payload: safeNotification(notification) })
  } catch (error) { failure(res, error) }
}

// Internal callers must authorize the resource and recipient before invoking this helper.
export const createNotification = async ({ userId, message, type = 'default', readLink = '', senderId = null, projectId = null }) => {
  try {
    const notification = await NotificationModel.create({ user: userId, sender: senderId || null, project: projectId || null, message, type, readLink })
    emitToUser(userId.toString(), 'new-notification', safeNotification(notification))
    return notification
  } catch (error) { logger.error('Notification create error:', error.name) }
}
