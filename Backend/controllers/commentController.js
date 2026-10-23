// Standalone comments are the canonical comment API used by card details.
import { CommentModel } from '../models/CommentModel.js'
import { UserModel } from '../models/usermodel.js'
import { projectModel } from '../models/ProjectModel.js'
import { WorkspaceModel } from '../models/Workspace.js'
import { findTask, findProject } from '../authorization/resources.js'
import { createActivity } from './ActivityController.js'
import { createNotification } from './notificationController.js'

const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const validBody = (body, fields) => body && typeof body === 'object' && !Array.isArray(body) &&
  Object.keys(body).every((key) => fields.includes(key)) &&
  typeof body.body === 'string' && body.body.trim().length > 0 && body.body.length <= 10000
const populateAuthor = (query) => query.populate('author', 'name profilePic username')

async function authorizedTask(taskId, userId, action = 'read') {
  return findTask(String(taskId), userId, action)
}

export const createComment = async (req, res, next) => {
  try {
    if (!validBody(req.body, ['taskId', 'body']) || !validId(req.body.taskId)) {
      return res.status(400).json({ message: 'Valid taskId and body (1–10000 characters) are required' })
    }
    const userId = String(req.user.id)
    const task = await authorizedTask(req.body.taskId, userId, 'edit')
    if (!task) return res.status(404).json({ message: 'Task not found' })
    const comment = await CommentModel.create({ task: task._id, author: userId, body: req.body.body.trim() })

    const project = await projectModel.findById(task.projectId)
      .select('creatorId members workspace directGrants')
    // `project.members` is the membership snapshot taken when the project was
    // created. Workspace membership is the current authority, so a teammate who
    // joined the workspace later must be part of the candidate audience.
    const workspace = project?.workspace
      ? await WorkspaceModel.findById(project.workspace).select('owner members')
      : null
    const audience = new Set([
      String(project?.creatorId ?? ''),
      ...(project?.members || []).map(String),
      ...(project?.directGrants || []).map((grant) => String(grant.user)),
      ...(workspace ? [String(workspace.owner), ...(workspace.members || []).map((entry) => String(entry.user))] : [])
    ].filter(Boolean))
    const mentions = [...new Set([...comment.body.matchAll(/@(\w+)/g)].map((match) => match[1]))]
    const mentionedUsers = mentions.length
      ? await UserModel.find({ _id: { $in: [...audience] }, username: { $in: mentions } }).select('_id')
      : []
    const recipients = new Set([
      ...mentionedUsers.map((user) => String(user._id)),
      ...(task.memberIds || []).map(String),
      ...(task.memberId ? [String(task.memberId)] : [])
    ])
    for (const recipient of recipients) {
      if (recipient === userId || !audience.has(recipient)) continue
      // Current access, not the snapshot: a revoked member must not be notified
      // even while the card still lists them as an assignee.
      if (!await findProject(String(task.projectId), recipient)) continue
      createNotification({ userId: recipient, message: `New comment on card "${task.title}"`, type: 'card' }).catch(() => {})
    }
    createActivity({ actor: userId, action: 'COMMENT_ADDED', target: comment._id, targetModel: 'Comment', project: task.projectId }).catch(() => {})
    const populated = await populateAuthor(CommentModel.findById(comment._id))
    res.status(201).json({ message: 'Comment created', payload: populated })
  } catch (err) { next(err) }
}

export const getCommentsByTask = async (req, res, next) => {
  try {
    const { limit = '50', page = '1' } = req.query
    if (!validId(req.params.taskId) || typeof limit !== 'string' || typeof page !== 'string' ||
      !/^\d+$/.test(limit) || !/^\d+$/.test(page) || Number(limit) < 1 || Number(limit) > 100 || Number(page) < 1 || Number(page) > 10000) {
      return res.status(400).json({ message: 'Invalid task id or pagination' })
    }
    const task = await authorizedTask(req.params.taskId, String(req.user.id))
    if (!task) return res.status(404).json({ message: 'Task not found' })
    const comments = await populateAuthor(CommentModel.find({ task: task._id }))
      .sort({ createdAt: -1, _id: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit))
    res.status(200).json({ message: 'Comments fetched', payload: comments })
  } catch (err) { next(err) }
}

export const updateComment = async (req, res, next) => {
  try {
    if (!validId(req.params.id) || !validBody(req.body, ['body'])) return res.status(400).json({ message: 'Invalid comment id or body' })
    const userId = String(req.user.id)
    const comment = await CommentModel.findById(req.params.id)
    if (!comment || !await authorizedTask(comment.task, userId, 'edit')) return res.status(404).json({ message: 'Comment not found' })
    if (String(comment.author) !== userId) return res.status(403).json({ message: 'Not allowed to edit this comment' })
    comment.body = req.body.body.trim()
    await comment.save()
    const populated = await populateAuthor(CommentModel.findById(comment._id))
    res.status(200).json({ message: 'Comment updated', payload: populated })
  } catch (err) { next(err) }
}

export const deleteComment = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid comment id' })
    const userId = String(req.user.id)
    const comment = await CommentModel.findById(req.params.id)
    if (!comment || !await authorizedTask(comment.task, userId)) return res.status(404).json({ message: 'Comment not found' })
    const action = String(comment.author) === userId ? 'edit' : 'manage'
    if (!await authorizedTask(comment.task, userId, action)) return res.status(403).json({ message: 'Not allowed' })
    await comment.deleteOne()
    res.status(200).json({ message: 'Comment deleted' })
  } catch (err) { next(err) }
}
