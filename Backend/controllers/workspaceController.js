import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { WorkspaceModel } from '../models/Workspace.js'
import { UserModel } from '../models/usermodel.js'
import InvitationModel from '../models/Invitation.js'
import { workspaceCan } from '../authorization/workspacePolicy.js'
import { revokeUserAccess } from '../socket.js'
import { sendEmail } from '../utils/email.js'
import { env } from '../config/env.js'
import { createActivity } from './ActivityController.js'

const roles = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']
const shape = (body, keys) => body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).every((key) => keys.includes(key))
const nameBody = (body) => shape(body, ['name']) && typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 200
const fail = (status, message) => Object.assign(new Error(message), { status })
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex')
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const authorized = async (req, action, options) => {
  const workspace = await WorkspaceModel.findById(req.params.id)
  if (!workspace) throw fail(404, 'Workspace not found')
  if (!workspaceCan(workspace, req.user.id, action, options)) throw fail(403, 'Workspace access denied')
  return workspace
}

export function revokeWorkspaceAccess(workspace, userIds) {
  const ids = userIds || [String(workspace.owner), ...workspace.members.map((m) => String(m.user))]
  for (const userId of new Set(ids)) revokeUserAccess(userId)
}

export const createWorkspace = async (req, res, next) => {
  try {
    if (!nameBody(req.body)) throw fail(400, 'Only a valid workspace name is allowed')
    const workspace = await WorkspaceModel.create({ name: req.body.name.trim(), owner: req.user.id, members: [{ user: req.user.id, role: 'ADMIN' }] })
    res.status(201).json({ message: 'Workspace created', payload: workspace })
  } catch (err) { next(err) }
}

export const getWorkspaces = async (req, res, next) => {
  try {
    // Fetch canonical candidates first: duplicate/legacy membership rows must not
    // consume the result cap or be populated before policy rejects them.
    const candidates = await WorkspaceModel.find({
      status: { $ne: false },
      isActive: { $ne: false },
      $or: [
        { owner: req.user.id },
        { members: { $elemMatch: { user: req.user.id, role: { $in: ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] } } } }
      ]
    }).sort({ updatedAt: -1, _id: -1 }).limit(1000).maxTimeMS(5000)
    const accessible = candidates.filter((workspace) => workspaceCan(workspace, req.user.id, 'read')).slice(0, 100)
    await WorkspaceModel.populate(accessible, [
      { path: 'owner', select: 'name email' },
      { path: 'members.user', select: 'name email profilePic' }
    ])
    res.status(200).json({ message: 'Workspaces fetched', payload: accessible })
  } catch (err) { next(err) }
}

export const getWorkspaceById = async (req, res, next) => {
  try {
    const workspace = await authorized(req, 'read')
    await workspace.populate([{ path: 'owner', select: 'name email' }, { path: 'members.user', select: 'name email profilePic' }])
    res.status(200).json({ message: 'Workspace fetched', payload: workspace })
  } catch (err) { next(err) }
}

export const updateWorkspace = async (req, res, next) => {
  try {
    if (!nameBody(req.body)) throw fail(400, 'Only a valid workspace name is allowed')
    const workspace = await authorized(req, 'manageWorkspace')
    workspace.name = req.body.name.trim()
    await workspace.save()
    res.status(200).json({ message: 'Workspace updated', payload: workspace })
  } catch (err) { next(err) }
}

export const deleteWorkspace = async (req, res, next) => {
  try {
    const workspace = await authorized(req, 'deleteWorkspace')
    workspace.status = false
    workspace.deletedAt = new Date()
    await workspace.save()
    revokeWorkspaceAccess(workspace)
    res.status(200).json({ message: 'Workspace deleted' })
  } catch (err) { next(err) }
}

export const changeMemberRole = async (req, res, next) => {
  try {
    if (!shape(req.body, ['role']) || !roles.includes(req.body.role)) throw fail(400, 'Only a valid role is allowed')
    const workspace = await authorized(req, 'changeRole', { targetUserId: req.params.userId, role: req.body.role })
    workspace.members = workspace.members.map((m) => String(m.user) === req.params.userId ? { user: m.user, role: req.body.role } : m)
    await workspace.save()
    revokeWorkspaceAccess(workspace, [req.params.userId])
    res.status(200).json({ message: 'Member role updated', payload: workspace })
  } catch (err) { next(err) }
}

export const removeMember = async (req, res, next) => {
  try {
    const workspace = await authorized(req, 'removeMember', { targetUserId: req.params.userId })
    workspace.members = workspace.members.filter((m) => String(m.user) !== req.params.userId)
    await workspace.save()
    revokeWorkspaceAccess(workspace, [req.params.userId])
    await createActivity({ actor: req.user.id, action: 'MEMBER_REMOVED', target: workspace._id, targetModel: 'Workspace', project: null }).catch(() => {})
    res.status(200).json({ message: 'Member removed' })
  } catch (err) { next(err) }
}

export const addMember = async (req, res, next) => {
  try {
    if (!shape(req.body, ['email', 'role']) || typeof req.body.email !== 'string' || req.body.email.length > 254 || !/^\S+@\S+\.\S+$/.test(req.body.email.trim()) || (req.body.role !== undefined && (typeof req.body.role !== 'string' || !roles.includes(req.body.role.toUpperCase())))) throw fail(400, 'Valid email and role required')
    const email = req.body.email.trim().toLowerCase()
    const role = (req.body.role || 'MEMBER').toUpperCase()
    const workspace = await authorized(req, 'invite', { role })
    const target = await UserModel.findOne({ email }).select('_id')
    if (target && (String(workspace.owner) === String(target._id) || workspace.members.some((m) => String(m.user) === String(target._id)))) throw fail(400, 'User is already a member')
    const raw = crypto.randomBytes(32).toString('hex')
    const tokenHash = digest(raw)
    await InvitationModel.findOneAndUpdate({ workspace: workspace._id, email }, { $set: { role: role[0] + role.slice(1).toLowerCase(), token: tokenHash, tokenHash, invitationVersion: 2, issuedBy: req.user.id, expiresAt: new Date(Date.now() + 7 * 86400000) } }, { upsert: true, runValidators: true })
    await createActivity({ actor: req.user.id, action: 'INVITE_SENT', target: workspace._id, targetModel: 'Workspace', project: null }).catch(() => {})
    const inviter = await UserModel.findById(req.user.id).select('name')
    const url = `${env.clientUrls[0] || 'http://localhost:5173'}/login#invite=${raw}`
    const text = `${inviter?.name || 'A teammate'} invited you to workspace "${workspace.name}" as ${role}. Accept within 7 days: ${url}`
    try {
      // The body and URL are escaped before interpolation.
      // nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format
      await (req.app.locals.sendEmail || sendEmail)({ to: email, subject: 'Workspace invitation', text, html: `<p>${escapeHtml(text)}</p><a href="${escapeHtml(url)}">Accept invitation</a>` })
    } catch {
      return res.status(200).json({ message: 'Invitation created', warning: 'Email delivery failed. Please reissue the invitation.' })
    }
    res.status(200).json({ message: 'Invitation sent', warning: null })
  } catch (err) { next(err) }
}

export const acceptInvitation = async (req, res, next) => {
  let session
  try {
    if (!shape(req.body, ['token']) || typeof req.body.token !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.token)) throw fail(400, 'Valid invitation token required')
    session = await mongoose.startSession()
    let payload
    await session.withTransaction(async () => {
      const invitation = await InvitationModel.findOne({ tokenHash: digest(req.body.token), invitationVersion: 2, expiresAt: { $gt: new Date() } }).session(session)
      if (!invitation) throw fail(404, 'Invitation not found; request a new invitation')
      const user = await UserModel.findById(req.user.id).session(session)
      if (!user || user.email.trim().toLowerCase() !== invitation.email) throw fail(403, 'This invitation is for a different email')
      if (user.emailVerified !== true) throw fail(403, 'Verify your email before accepting')
      const workspace = await WorkspaceModel.findById(invitation.workspace).session(session)
      const role = invitation.role.toUpperCase()
      if (!workspaceCan(workspace, String(invitation.issuedBy), 'invite', { role })) throw fail(403, 'Invitation no longer authorized; request a new invitation')
      if (String(workspace.owner) !== req.user.id && !workspace.members.some((m) => String(m.user) === req.user.id)) {
        workspace.members = [...workspace.members, { user: user._id, role }]
      }
      // Writing the workspace serializes acceptance with concurrent permission or membership changes.
      workspace.markModified('members')
      await workspace.save({ session })
      await InvitationModel.deleteOne({ _id: invitation._id }, { session })
      payload = workspace
    })
    await createActivity({ actor: req.user.id, action: 'INVITE_ACCEPTED', target: payload._id, targetModel: 'Workspace', project: null }).catch(() => {})
    res.status(200).json({ message: 'Invitation accepted', payload })
  } catch (err) { next(err) } finally { await session?.endSession() }
}
