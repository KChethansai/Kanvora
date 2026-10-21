// ProjectsAPI routes: Express endpoints for this backend resource.
import exp from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import mongoose from 'mongoose'
import { verifyRolesToken } from '../middlewares/verifyRolesToken.js'
import { projectModel } from '../models/ProjectModel.js'
import { ListModel } from '../models/ListModel.js'
import { taskModel } from '../models/Taskmodel.js'
import { WorkspaceModel } from '../models/Workspace.js'
import { ActivityModel } from '../models/Activity.js'
import { getIO, revokeProjectAccess, revokeProjectRoom } from '../socket.js'
import { upload } from '../config/multer.js'
import { uploadToCloudinary } from '../config/uploadToCloudinary.js'
import { hasImageSignature } from '../utils/image.js'
import { privateAttachmentUrl } from '../config/media.js'
import { env } from '../config/env.js'
import { uploadLimiter } from '../config/security.js'
import { canAccessProject, canEditProject, findProject, findList, findTask, projectCapabilities, workspaceRole } from '../authorization/resources.js'
import { nextSequence, withTransaction } from '../utils/transactions.js'
import { MAX_PAGE_SIZE, decodeKeysetCursor, encodeKeysetCursor, keysetAfter, parsePageLimit } from '../utils/keysetCursor.js'
import { analyticsPipeline, foldAnalytics } from '../utils/projectAnalytics.js'
import { appendAttachment, safeFileName } from '../utils/cardAttachments.js'

export const projectsApp = exp.Router()

const auth = verifyRolesToken('MEMBER', 'ADMIN', 'MANAGER', 'VIEWER')
const write = verifyRolesToken('MEMBER', 'ADMIN', 'MANAGER', 'VIEWER')

const findAccessibleProject = (id, userId) => findProject(id, userId)
const findEditableProject = (id, userId) => findProject(id, userId, 'edit')
const findManageableProject = (id, userId) => findProject(id, userId, 'manage')
const findAccessibleList = (id, userId) => findList(id, userId)
const findEditableList = (id, userId, session = null) => findList(id, userId, 'edit', session)
const findEditableCard = (id, userId, session = null) => findTask(id, userId, 'edit', session)
const canAccessWorkspace = (workspace, userId) => workspaceRole(workspace, userId) !== null

const badRequest = (message = 'Invalid update payload') => {
  const error = new Error(message)
  error.status = 400
  throw error
}
const objectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0)
const date = (value) => value === null || (typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)))
const boundedNumber = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
const strictObject = (value, keys) => {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some((key) => !keys.includes(key))) badRequest()
}
const check = (valid) => { if (!valid) badRequest() }
const projectDetailLimits = {
  companyName: 200, website: 2000, contactEmail: 254, templateType: 200, category: 200, notes: 10000
}
const httpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
const validateProjectDetails = (details) => {
  strictObject(details, Object.keys(projectDetailLimits))
  for (const [key, max] of Object.entries(projectDetailLimits)) {
    if (key in details) check(typeof details[key] === 'string' && details[key].length <= max)
  }
  if (details.website && !httpUrl(details.website)) badRequest('Invalid publish website')
  if (details.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.contactEmail)) badRequest('Invalid publish contact email')
}
const validateProjectPayload = (body) => {
  strictObject(body, ['title', 'description', 'color', 'img', 'workspaceId', 'isEditable', 'isPublished', 'publishDetails'])
  if ('title' in body) check(text(body.title, 240, true))
  if ('description' in body) check(text(body.description, 50000))
  if ('color' in body) check(text(body.color, 120, true))
  if ('img' in body) check(body.img === '' || body.img === null || (typeof body.img === 'string' && body.img.length <= 2048))
  if ('workspaceId' in body) check(body.workspaceId === '' || body.workspaceId === null || objectId(body.workspaceId))
  for (const key of ['isEditable', 'isPublished']) {
    if (key in body) check([true, false, 'true', 'false'].includes(body[key]))
  }
  if (body.publishDetails !== undefined && body.publishDetails !== null) validateProjectDetails(body.publishDetails)
}
const validateNested = (values, keys, existing, validate) => {
  check(Array.isArray(values) && values.length <= 100)
  for (const value of values) {
    strictObject(value, [...keys, '_id'])
    if (value._id !== undefined) check(objectId(value._id) && existing?.some((item) => String(item._id) === value._id))
    validate(value)
  }
}
// List order is owned by the reorder endpoint; general edits cannot set it.
const validateListPayload = (body) => {
  strictObject(body, ['title'])
  if ('title' in body) check(text(body.title, 240, true))
  return body
}
const validateCardPayload = async (body, projectId, card = null) => {
  strictObject(body, ['title', 'description', 'richDescription', 'dueDate', 'labels', 'priority', 'status',
    'estimatedMinutes', 'recurring', 'subtasks', 'checklists', 'watchers', 'memberId', 'memberIds',
    ...(card ? ['order', 'listId'] : [])])
  if (!card || 'title' in body) check(text(body.title, 240, true))
  for (const key of ['description', 'richDescription']) if (key in body) check(text(body[key], 50000))
  if ('dueDate' in body) check(date(body.dueDate))
  if ('priority' in body) check(['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(body.priority))
  if ('status' in body) check(body.status === null || ['TO-DO', 'IN-PROGRESS', 'DONE'].includes(body.status))
  if ('order' in body) check(boundedNumber(body.order, 1000000))
  if ('listId' in body) check(objectId(body.listId))
  if ('estimatedMinutes' in body) check(boundedNumber(body.estimatedMinutes, 10000000))
  if ('recurring' in body) {
    strictObject(body.recurring, ['enabled', 'interval', 'nextRunAt'])
    if ('enabled' in body.recurring) check(typeof body.recurring.enabled === 'boolean')
    if ('interval' in body.recurring) check(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'].includes(body.recurring.interval))
    if ('nextRunAt' in body.recurring) check(date(body.recurring.nextRunAt))
  }
  if ('labels' in body) validateNested(body.labels, ['text', 'color'], card?.labels, (label) => {
    check(text(label.text, 100, true) && text(label.color, 100, true))
  })
  if ('subtasks' in body) validateNested(body.subtasks, ['title', 'completed', 'assigneeId'], card?.subtasks, (subtask) => {
    check(text(subtask.title, 240, true))
    if ('completed' in subtask) check(typeof subtask.completed === 'boolean')
    if ('assigneeId' in subtask) check(subtask.assigneeId === null || objectId(subtask.assigneeId))
  })
  if ('checklists' in body) validateNested(body.checklists, ['title', 'items'], card?.checklists, (list) => {
    check(text(list.title, 240, true))
    validateNested(list.items, ['title', 'completed'], card?.checklists?.find((item) => String(item._id) === list._id)?.items, (item) => {
      check(text(item.title, 240, true))
      if ('completed' in item) check(typeof item.completed === 'boolean')
    })
  })
  for (const key of ['watchers', 'memberIds']) if (key in body) {
    check(Array.isArray(body[key]) && body[key].length <= 100 && body[key].every(objectId))
    check(new Set(body[key]).size === body[key].length)
  }
  if ('memberId' in body) check(body.memberId === null || objectId(body.memberId))
  const assignees = [...(body.memberIds || []), ...(body.memberId ? [body.memberId] : []), ...(body.watchers || []),
    ...(body.subtasks || []).map((task) => task.assigneeId).filter(Boolean)]
  const project = await projectModel.findById(projectId)
  for (const userId of new Set(assignees)) check(await canAccessProject(project, userId))
  return normalizeMemberFields(body)
}

projectsApp.param('id', (req, res, next, id) => {
  if (!objectId(id)) return res.status(400).json({ message: 'Invalid resource ID' })
  next()
})

// Every paged read uses one keyset scheme. A cursor carries the sort key of
// the last row of the page, so the next page resumes exactly where the
// previous one stopped, and the trailing identifier makes the order total.
const projectKeyset = {
  fields: ['updatedAt', '_id'],
  direction: 'desc',
  encode: (project) => [project.updatedAt.toISOString(), project.id],
  decode: (keys) => [new Date(keys[0]), new mongoose.Types.ObjectId(keys[1])],
  valid: (keys) => keys.length === 2 && typeof keys[0] === 'string' &&
    !Number.isNaN(Date.parse(keys[0])) && new Date(keys[0]).toISOString() === keys[0] && objectId(keys[1])
}

const listKeyset = {
  fields: ['order', '_id'],
  direction: 'asc',
  encode: (list) => [list.order ?? 0, String(list._id)],
  decode: (keys) => [keys[0], new mongoose.Types.ObjectId(keys[1])],
  valid: (keys) => keys.length === 2 && typeof keys[0] === 'number' && Number.isFinite(keys[0]) && objectId(keys[1])
}

const cardKeyset = {
  fields: ['order', 'createdAt', '_id'],
  direction: 'asc',
  encode: (card) => [card.order ?? 0, new Date(card.createdAt ?? 0).toISOString(), String(card._id)],
  decode: (keys) => [keys[0], new Date(keys[1]), new mongoose.Types.ObjectId(keys[2])],
  valid: (keys) => keys.length === 3 && typeof keys[0] === 'number' && Number.isFinite(keys[0]) &&
    typeof keys[1] === 'string' && !Number.isNaN(Date.parse(keys[1])) && objectId(keys[2])
}

// The export keeps its own order: cards are grouped by list and then by the
// order they hold inside that list.
const exportCardKeyset = {
  fields: ['listId', 'order', '_id'],
  direction: 'asc',
  encode: (card) => [String(card.listId), card.order ?? 0, String(card._id)],
  decode: (keys) => [new mongoose.Types.ObjectId(keys[0]), keys[1], new mongoose.Types.ObjectId(keys[2])],
  valid: (keys) => keys.length === 3 && objectId(keys[0]) && typeof keys[1] === 'number' &&
    Number.isFinite(keys[1]) && objectId(keys[2])
}

const decodeScopedCursor = (cursor, scope, keyset, message) =>
  decodeKeysetCursor(cursor, scope, { validate: keyset.valid, message })

// Read one page of rows for a keyset. The query asks for one row more than
// the page size, so "has more" is known without a second count query.
const readPage = async ({ model, filter, keyset, position, limit, decorate = null, lean = false }) => {
  const query = model.find(position
    ? { $and: [filter, keysetAfter(keyset.fields, keyset.decode(position), keyset.direction)] }
    : filter)
  if (decorate) decorate(query)
  if (lean) query.lean()
  return query
    .sort(Object.fromEntries(keyset.fields.map((field) => [field, keyset.direction === 'desc' ? -1 : 1])))
    .limit(limit + 1)
}

const projectListing = async (userId, query, endpoint = 'projects') => {
  const { workspaceId, cursor, limit: requestedLimit } = query
  if (workspaceId !== undefined && !objectId(workspaceId)) badRequest('Invalid workspace ID')
  const maximum = endpoint === 'recent' ? 5 : MAX_PAGE_SIZE
  const limit = parsePageLimit(requestedLimit, maximum, 'Invalid project limit')
  const scope = { userId, workspaceId: workspaceId || null, endpoint }
  let position = cursor === undefined ? null : decodeScopedCursor(cursor, scope, projectKeyset, 'Invalid project cursor')
  const workspaces = await WorkspaceModel.find({ $or: [{ owner: userId }, { 'members.user': userId }] })
  const workspaceById = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]))
  const workspaceIds = workspaces.filter((workspace) => canAccessWorkspace(workspace, userId)).map((workspace) => workspace._id)
  if (workspaceId && !workspaceIds.some((id) => String(id) === workspaceId)) {
    const error = new Error('Workspace access denied')
    error.status = 403
    throw error
  }
  const standaloneGrant = {
    workspace: null,
    membershipVersion: 1,
    directGrants: {
      $elemMatch: {
        user: userId,
        role: { $in: ['MEMBER', 'VIEWER'] },
        grantedBy: { $ne: null },
        createdAt: { $ne: null }
      }
    }
  }
  const filter = { status: { $ne: false }, ...(workspaceId ? { workspace: workspaceId } : {
    $or: [{ workspace: { $in: workspaceIds } }, { workspace: null, creatorId: userId }, standaloneGrant]
  }) }
  const accessible = []
  while (accessible.length <= limit) {
    const projects = await projectModel.find(position
      ? { $and: [filter, keysetAfter(projectKeyset.fields, projectKeyset.decode(position), projectKeyset.direction)] }
      : filter)
      .sort({ updatedAt: -1, _id: -1 }).limit(100)
    for (const project of projects) {
      position = projectKeyset.encode(project)
      if (await canAccessProject(project, userId)) accessible.push(project)
      if (accessible.length > limit) break
    }
    if (accessible.length > limit || projects.length < 100) break
  }
  const hasMore = accessible.length > limit
  const page = accessible.slice(0, limit)
  const nextCursor = hasMore ? encodeKeysetCursor(scope, projectKeyset.encode(page[page.length - 1])) : null
  await projectModel.populate(page, [{ path: 'workspace', select: 'name' }, { path: 'creatorId', select: 'name email' }])
  const payload = []
  for (const project of page) {
    const workspaceIdValue = project.workspace?._id || project.workspace
    const workspace = workspaceIdValue ? workspaceById.get(String(workspaceIdValue)) ?? project.workspace : null
    payload.push({
      ...project.toObject(),
      title: project.title || project.name,
      capabilities: await projectCapabilities(project, userId, workspace)
    })
  }
  return { payload, nextCursor, hasMore }
}

const uploadImageFile = async (file, folder, { privateAsset = false } = {}) => {
  if (!file) return null
  if (!hasImageSignature(file.buffer, file.mimetype)) {
    const invalid = new Error('The uploaded file is not a valid JPEG or PNG image')
    invalid.status = 400
    throw invalid
  }
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {
    const err = new Error('Cloudinary image uploads are not configured')
    err.status = 503
    throw err
  }
  const uploaded = await uploadToCloudinary(file.buffer, folder, { privateAsset })
  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    fileName: file.originalname,
    fileType: file.mimetype,
    size: file.size
  }
}

const normalizeMemberFields = (body = {}) => {
  if (!Object.prototype.hasOwnProperty.call(body, 'memberIds') &&
      !Object.prototype.hasOwnProperty.call(body, 'memberId')) {
    return body
  }

  let memberIds = []
  if (Array.isArray(body.memberIds)) {
    memberIds = body.memberIds
      .map((id) => (id?._id || id)?.toString())
      .filter(Boolean)
  } else if (body.memberId) {
    memberIds = [(body.memberId?._id || body.memberId).toString()]
  }

  return {
    ...body,
    memberIds,
    memberId: memberIds[0] || null
  }
}

const populateCardMembers = (query) =>
  query.populate('memberId', 'name email profilePic').populate('memberIds', 'name email profilePic')

// The people a board was shared with. A board member list is seeded with the
// workspace members when the board is created, so it is the audience that can
// hold a socket in the board room.
const boardAudience = (project) => new Set([
  String(project.creatorId?._id || project.creatorId || ''),
  ...(project.members || []).map((member) => String(member?._id || member || ''))
].filter((id) => objectId(id)))

// Evict the sockets of a board that can no longer be read. The members lose
// their admission to the board and every remaining socket in the room leaves
// as well, so the room never outlives the board.
const evictProjectSockets = (project) => {
  const projectId = String(project._id)
  for (const userId of boardAudience(project)) revokeProjectAccess(projectId, userId)
  revokeProjectRoom(projectId)
}

// Analytics never materialise the board. The totals are counts and the
// breakdowns are grouped aggregations, so the peak memory is bounded by the
// number of groups instead of by the number of cards.
export const buildProjectAnalytics = async (projectId) => {
  const boardId = new mongoose.Types.ObjectId(String(projectId))
  const [lists, activity, facets] = await Promise.all([
    ListModel.countDocuments({ projectId: boardId }),
    ActivityModel.countDocuments({ project: projectId }),
    taskModel.aggregate(analyticsPipeline(boardId, ListModel.collection.collectionName, new Date()))
  ])
  return foldAnalytics(facets, { lists, activity })
}

// The export is a complete board by definition, so it is never truncated. The
// reads are paged instead, so one query never materialises the whole
// collection at once.
const buildProjectExport = async (project) => {
  const lists = []
  let listPosition = null
  for (;;) {
    const page = await readPage({
      model: ListModel,
      filter: { projectId: project._id },
      keyset: listKeyset,
      position: listPosition,
      limit: MAX_PAGE_SIZE,
      lean: true
    })
    if (!page.length) break
    lists.push(...page)
    if (page.length <= MAX_PAGE_SIZE) break
    listPosition = listKeyset.encode(page[page.length - 1])
  }
  const cards = []
  let cardPosition = null
  for (;;) {
    const page = await readPage({
      model: taskModel,
      filter: { projectId: project._id, listId: { $in: lists.map((list) => list._id) }, isActive: true },
      keyset: exportCardKeyset,
      position: cardPosition,
      limit: MAX_PAGE_SIZE,
      lean: true
    })
    if (!page.length) break
    cards.push(...page)
    if (page.length <= MAX_PAGE_SIZE) break
    cardPosition = exportCardKeyset.encode(page[page.length - 1])
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    board: { ...project.toObject(), title: project.title || project.name },
    lists,
    cards
  }
}

// Projects

// GET /projects-api/projects - all projects for the logged-in user
projectsApp.get('/projects', auth, async (req, res, next) => {
  try {
    const page = await projectListing(req.user.id, req.query)
    res.status(200).json({ message: 'Projects fetched', ...page })
  } catch (err) {
    console.error('Error in GET /projects:', err)
    next(err)
  }
})

// GET /projects-api/projects/recent - 5 most recently updated
projectsApp.get('/projects/recent', auth, async (req, res, next) => {
  try {
    const page = await projectListing(req.user.id, req.query, 'recent')
    res.status(200).json({ message: 'Recent projects fetched', ...page })
  } catch (err) {
    next(err)
  }
})

// GET /projects-api/projects/:id - single project
projectsApp.get('/projects/:id', auth, async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })
    await project.populate([{ path: 'workspace', select: 'name' }, { path: 'creatorId', select: 'name email' }, { path: 'members', select: 'name email' }])

    res.status(200).json({
      message: 'Project fetched',
      payload: {
        ...project.toObject(),
        title: project.title || project.name,
        capabilities: await projectCapabilities(project, req.user.id)
      }
    })
  } catch (err) {
    next(err)
  }
})

projectsApp.get('/projects/:id/analytics', auth, async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })
    res.status(200).json({
      message: 'Project analytics fetched',
      payload: await buildProjectAnalytics(project._id)
    })
  } catch (err) {
    next(err)
  }
})

projectsApp.get('/projects/:id/export', auth, async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })
    const auditEntry = {
      actor: req.user.id,
      action: 'PROJECT_EXPORTED',
      meta: { requestId: req.requestId }
    }
    project.auditLogs.push(auditEntry)
    // A read-only export must not rewrite the whole project document; append
    // the audit entry atomically so a concurrent edit cannot be clobbered.
    await projectModel.updateOne(
      { _id: project._id },
      { $push: { auditLogs: auditEntry } }
    )
    res.status(200).json({
      message: 'Project export generated',
      payload: await buildProjectExport(project)
    })
  } catch (err) {
    next(err)
  }
})

projectsApp.put('/projects/:id/archive', auth, async (req, res, next) => {
  try {
    strictObject(req.body, ['archived'])
    if (typeof req.body.archived !== 'boolean') badRequest('archived must be a boolean')
    const project = await findProject(req.params.id, req.user.id, req.body.archived === false ? 'restore' : 'manage')
    if (!project) return res.status(403).json({ message: 'Only the owner can archive this project' })
    project.archivedAt = req.body.archived === false ? null : new Date()
    project.auditLogs.push({
      actor: req.user.id,
      action: project.archivedAt ? 'PROJECT_ARCHIVED' : 'PROJECT_RESTORED',
      meta: { requestId: req.requestId }
    })
    await project.save()
    // Broadcast project data only. Capabilities are per recipient and must never
    // be taken from the actor who happened to make this update.
    getIO().to(`project:${project._id}`).emit('project-updated', {
      ...project.toObject(),
      title: project.title || project.name
    })
    // An archived board is still readable, so its room stays open: the live
    // project-updated event is how the archive and the restore reach the
    // other viewers. Only a board that can no longer be read is evicted.
    res.status(200).json({
      message: 'Project archive state updated',
      payload: { ...project.toObject(), capabilities: await projectCapabilities(project, req.user.id) }
    })
  } catch (err) {
    next(err)
  }
})

// POST /projects-api/projects - create project
projectsApp.post('/projects', auth, upload.single('background'), async (req, res, next) => {
  try {
    validateProjectPayload(req.body)
    const { title, description, color, img, workspaceId, isEditable, isPublished, publishDetails } = req.body
    if (!text(title, 240, true))
      return res.status(400).json({ message: 'Project title is required' })

    let workspace = null
    if (workspaceId) {
      if (!objectId(workspaceId)) badRequest('Invalid workspace ID')
      workspace = await WorkspaceModel.findById(workspaceId)
      if (!workspace || !(await canEditProject({ workspace: workspace._id }, req.user.id))) {
        return res.status(403).json({ message: 'Workspace access denied' })
      }
    } else if (!['MEMBER', 'ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only members and above can create personal projects' })
    }

    const workspaceMembers = workspace?.members?.map((member) => member.user?.toString()).filter(Boolean) || []
    const projectMembers = [...new Set([req.user.id, ...workspaceMembers])]

    const uploadedBackground = await uploadImageFile(req.file, 'project_backgrounds')

    const project = new projectModel({
      name: title.trim(),
      title: title.trim(),
      ...(description !== undefined && { description }),
      color: color || 'from-blue-500 to-blue-700',
      img: uploadedBackground?.url || img || null,
      imgPublicId: uploadedBackground?.publicId || null,
      workspace: workspaceId || null,
      creatorId: req.user.id,
      members: projectMembers,
      isEditable: isEditable === 'true' || isEditable === true,
      isPublished: isPublished === 'true' || isPublished === true,
      ...(publishDetails && { publishDetails })
    })
    await project.save()

    res.status(201).json({
      message: 'Project created',
      payload: { ...project.toObject(), capabilities: await projectCapabilities(project, req.user.id, workspace || null) }
    })
  } catch (err) {
    next(err)
  }
})

// PUT /projects-api/projects/:id - update project
projectsApp.put('/projects/:id', auth, upload.single('background'), async (req, res, next) => {
  try {
    validateProjectPayload(req.body)
    const { title, description, color, img, isEditable, isPublished, publishDetails } = req.body
    const project = await findManageableProject(req.params.id, req.user.id)
    if (!project) return res.status(403).json({ message: 'Only the owner can manage project settings' })

    const uploadedBackground = await uploadImageFile(req.file, 'project_backgrounds')

    const updated = await projectModel.findByIdAndUpdate(
      req.params.id,
      {
        ...(title && { name: title, title }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
        ...(img !== undefined && { img }),
        ...(isEditable !== undefined && { isEditable: isEditable === 'true' || isEditable === true }),
        ...(isPublished !== undefined && { isPublished: isPublished === 'true' || isPublished === true }),
        ...(publishDetails && { publishDetails }),
        ...(uploadedBackground && {
          img: uploadedBackground.url,
          imgPublicId: uploadedBackground.publicId
        })
      },
      { new: true, runValidators: true }
    )
    .populate('workspace', 'name')
    .populate('creatorId', 'name email')

    if (!updated) return res.status(404).json({ message: 'Project not found' })

    // Broadcast project data only. Capabilities are per recipient and must never
    // be taken from the actor who happened to make this update.
    getIO().to(`project:${req.params.id}`).emit('project-updated', {
      ...updated.toObject(),
      title: updated.title || updated.name
    })

    res.status(200).json({
      message: 'Project updated',
      payload: { ...updated.toObject(), capabilities: await projectCapabilities(updated, req.user.id) }
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /projects-api/projects/:id - soft delete
export const deleteProject = async (req, res, next) => {
  try {
    const project = await findManageableProject(req.params.id, req.user.id)
    if (!project) return res.status(403).json({ message: 'Only the owner can delete this project' })
    project.status = false
    await project.save()

    getIO().to(`project:${req.params.id}`).emit('project-deleted', { projectId: req.params.id })

    // The board can no longer be read by anybody. Every socket that joined it
    // leaves the room, so no client keeps receiving traffic for a deleted
    // board.
    evictProjectSockets(project)

    res.status(200).json({ message: 'Project deleted' })
  } catch (err) {
    next(err)
  }
}
projectsApp.delete('/projects/:id', auth, deleteProject)

// Lists

// GET /projects-api/projects/:id/lists
export const getProjectLists = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const limit = parsePageLimit(req.query.limit, MAX_PAGE_SIZE, 'Invalid list limit')
    const scope = { userId: String(req.user.id), projectId: String(req.params.id), endpoint: 'lists' }
    const position = req.query.cursor === undefined
      ? null
      : decodeScopedCursor(req.query.cursor, scope, listKeyset, 'Invalid list cursor')

    const rows = await readPage({
      model: ListModel,
      filter: { projectId: req.params.id },
      keyset: listKeyset,
      position,
      limit
    })
    const hasMore = rows.length > limit
    const payload = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? encodeKeysetCursor(scope, listKeyset.encode(payload[payload.length - 1])) : null
    res.status(200).json({ message: 'Lists fetched', payload, nextCursor, hasMore })
  } catch (err) {
    next(err)
  }
}
projectsApp.get('/projects/:id/lists', auth, getProjectLists)

// POST /projects-api/projects/:id/lists
projectsApp.post('/projects/:id/lists', write, async (req, res, next) => {
  try {
    strictObject(req.body, ['title'])
    const { title } = validateListPayload(req.body)
    if (!text(title, 240, true)) return res.status(400).json({ message: 'Title required' })
    const list = await withTransaction(async (session) => {
      const project = await findProject(req.params.id, req.user.id, 'edit', session)
      if (!project) return null
      const sequenced = await nextSequence({
        model: projectModel,
        filter: { _id: project._id },
        field: 'listSequence',
        session,
        maxOrder: async () => {
          const last = await ListModel.findOne({ projectId: project._id })
            .sort({ order: -1 }).select('order').session(session)
          return last?.order ?? -1
        }
      })
      if (!sequenced) return null
      const [created] = await ListModel.create([{
        title: title.trim(),
        projectId: project._id,
        order: sequenced.listSequence
      }], { session })
      return created
    })
    if (!list) return res.status(404).json({ message: 'Project not found' })

    getIO().to(`project:${req.params.id}`).emit('list-created', list)

    res.status(201).json({ message: 'List created', payload: list })
  } catch (err) {
    next(err)
  }
})

// PUT /projects-api/lists/:id
projectsApp.put('/lists/:id', write, async (req, res, next) => {
  try {
    const list = await findEditableList(req.params.id, req.user.id)
    if (!list) return res.status(404).json({ message: 'List not found' })

    const updated = await ListModel.findByIdAndUpdate(req.params.id, { $set: validateListPayload(req.body) }, { new: true, runValidators: true })
    if (!updated) return res.status(404).json({ message: 'List not found' })

    getIO().to(`project:${updated.projectId}`).emit('list-updated', updated)

    res.status(200).json({ message: 'List updated', payload: updated })
  } catch (err) {
    next(err)
  }
})

// DELETE /projects-api/lists/:id
projectsApp.delete('/lists/:id', write, async (req, res, next) => {
  try {
    const list = await withTransaction(async (session) => {
      const current = await findEditableList(req.params.id, req.user.id, session)
      if (!current) return null
      await taskModel.deleteMany({ listId: current._id, projectId: current.projectId }, { session })
      await ListModel.deleteOne({ _id: current._id }, { session })
      return current
    })
    if (!list) return res.status(404).json({ message: 'List not found' })

    getIO().to(`project:${list.projectId}`).emit('list-deleted', { listId: req.params.id })

    res.status(200).json({ message: 'List deleted' })
  } catch (err) {
    next(err)
  }
})

// PUT /projects-api/projects/:id/lists/reorder
projectsApp.put('/projects/:id/lists/reorder', write, async (req, res, next) => {
  try {
    const { orderedIds } = req.body
    strictObject(req.body, ['orderedIds'])
    if (!Array.isArray(orderedIds) || orderedIds.length > 1000 || !orderedIds.every(objectId) || new Set(orderedIds).size !== orderedIds.length) return res.status(400).json({ message: 'Invalid orderedIds' })

    const reordered = await withTransaction(async (session) => {
      const project = await findProject(req.params.id, req.user.id, 'edit', session)
      if (!project) return null
      const [matchingLists, totalLists] = await Promise.all([
        ListModel.countDocuments({ _id: { $in: orderedIds }, projectId: project._id }).session(session),
        ListModel.countDocuments({ projectId: project._id }).session(session)
      ])
      if (matchingLists !== orderedIds.length || totalLists !== orderedIds.length) {
        badRequest('Invalid list order payload')
      }
      await ListModel.bulkWrite(orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id, projectId: project._id }, update: { $set: { order: index } } }
      })), { session })
      return true
    })
    if (!reordered) return res.status(404).json({ message: 'Project not found' })

    getIO().to(`project:${req.params.id}`).emit('lists-reordered', { orderedIds })

    res.status(200).json({ message: 'Lists reordered' })
  } catch (err) {
    next(err)
  }
})

// Cards

// GET /projects-api/lists/:id/cards
export const getListCards = async (req, res, next) => {
  try {
    const list = await findAccessibleList(req.params.id, req.user.id)
    if (!list) return res.status(404).json({ message: 'List not found' })

    const limit = parsePageLimit(req.query.limit, MAX_PAGE_SIZE, 'Invalid card limit')
    const scope = { userId: String(req.user.id), listId: String(req.params.id), endpoint: 'cards' }
    const position = req.query.cursor === undefined
      ? null
      : decodeScopedCursor(req.query.cursor, scope, cardKeyset, 'Invalid card cursor')

    const rows = await readPage({
      model: taskModel,
      filter: { listId: req.params.id, projectId: list.projectId, isActive: true },
      keyset: cardKeyset,
      position,
      limit,
      decorate: populateCardMembers
    })
    const hasMore = rows.length > limit
    const payload = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? encodeKeysetCursor(scope, cardKeyset.encode(payload[payload.length - 1])) : null
    res.status(200).json({ message: 'Cards fetched', payload, nextCursor, hasMore })
  } catch (err) {
    next(err)
  }
}
projectsApp.get('/lists/:id/cards', auth, getListCards)

// POST /projects-api/lists/:id/cards
projectsApp.post('/lists/:id/cards', write, async (req, res, next) => {
  try {
    const list = await findEditableList(req.params.id, req.user.id)
    if (!list) return res.status(404).json({ message: 'List not found' })

    const cardPayload = await validateCardPayload(req.body, list.projectId)

    const card = await withTransaction(async (session) => {
      const currentList = await findEditableList(req.params.id, req.user.id, session)
      if (!currentList) return null
      const sequenced = await nextSequence({
        model: ListModel,
        filter: { _id: currentList._id, projectId: currentList.projectId },
        field: 'cardSequence',
        session,
        maxOrder: async () => {
          const last = await taskModel.findOne({ listId: currentList._id, isActive: true })
            .sort({ order: -1 }).select('order').session(session)
          return last?.order ?? -1
        }
      })
      if (!sequenced) return null
      const [created] = await taskModel.create([{
        ...cardPayload,
        listId: currentList._id,
        projectId: currentList.projectId,
        creatorId: req.user.id,
        order: sequenced.cardSequence
      }], { session })
      return created
    })
    if (!card) return res.status(404).json({ message: 'List not found' })

    getIO().to(`project:${card.projectId}`).emit('card-created', { ...card.toObject(), listId: req.params.id })

    res.status(201).json({ message: 'Card created', payload: card })
  } catch (err) {
    next(err)
  }
})

// PUT /projects-api/cards/:id - update or move card
projectsApp.put('/cards/:id', write, async (req, res, next) => {
  try {
    const card = await findEditableCard(req.params.id, req.user.id)
    if (!card) return res.status(404).json({ message: 'Card not found' })

    const updatePayload = await validateCardPayload(req.body, card.projectId, card)
    if (updatePayload.order !== undefined &&
        (!updatePayload.listId || updatePayload.listId === String(card.listId))) {
      return res.status(400).json({ message: 'Use the card reorder endpoint to change order' })
    }

    const updated = await withTransaction(async (session) => {
      const current = await findEditableCard(req.params.id, req.user.id, session)
      if (!current) return null

      if (updatePayload.listId && updatePayload.listId !== String(current.listId)) {
        const targetList = await findEditableList(updatePayload.listId, req.user.id, session)
        if (!targetList || targetList.projectId.toString() !== current.projectId.toString()) {
          badRequest('Invalid target list')
        }
        if (updatePayload.order === undefined) {
          const sequenced = await nextSequence({
            model: ListModel,
            filter: { _id: targetList._id, projectId: targetList.projectId },
            field: 'cardSequence',
            session,
            maxOrder: async () => {
              const last = await taskModel.findOne({ listId: targetList._id, isActive: true })
                .sort({ order: -1 }).select('order').session(session)
              return last?.order ?? -1
            }
          })
          if (!sequenced) badRequest('Invalid target list')
          updatePayload.order = sequenced.cardSequence
        } else {
          // Make room at the requested position and keep the sequence ahead of it.
          await taskModel.updateMany({
            listId: targetList._id, isActive: true, order: { $gte: updatePayload.order }
          }, { $inc: { order: 1 } }, { session })
          await ListModel.updateOne({ _id: targetList._id }, {
            $max: { cardSequence: updatePayload.order }
          }, { session })
        }
        updatePayload.listId = targetList._id
      } else if (updatePayload.listId) {
        delete updatePayload.listId
      }

      return taskModel.findByIdAndUpdate(
        current._id,
        { $set: updatePayload },
        { new: true, runValidators: true, session }
      )
    })
    if (!updated) return res.status(404).json({ message: 'Card not found' })

    const populated = await populateCardMembers(taskModel.findById(updated._id))

    getIO().to(`project:${updated.projectId}`).emit('card-updated', populated)

    res.status(200).json({ message: 'Card updated', payload: populated })
  } catch (err) {
    next(err)
  }
})

// GET /projects-api/attachments/:id - authorized, short-lived private delivery
projectsApp.get('/attachments/:id', auth, async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid attachment ID' })
    const card = await taskModel.findOne({ 'attachment._id': req.params.id, isActive: true })
    if (!card) return res.status(404).json({ message: 'Attachment not found' })
    const authorized = await findTask(String(card._id), req.user.id, 'read')
    if (!authorized) return res.status(404).json({ message: 'Attachment not found' })
    const attachment = card.attachment.id(req.params.id)
    if (!attachment) return res.status(404).json({ message: 'Attachment not found' })
    const target = attachment.storage === 'authenticated' && attachment.publicId
      ? privateAttachmentUrl(attachment.publicId, attachment.fileType)
      : attachment.url
    res.set('Cache-Control', 'private, no-store')
    return res.redirect(302, target)
  } catch (err) {
    next(err)
  }
})

// POST /projects-api/cards/:id/attachments
export const uploadCardAttachment = async (req, res, next) => {
  try {
    const card = await findEditableCard(req.params.id, req.user.id)
    if (!card) return res.status(404).json({ message: 'Card not found' })
    if (!req.file) return res.status(400).json({ message: 'Image attachment is required' })

    const image = await uploadImageFile(req.file, 'card_attachments', { privateAsset: true })
    const attachment = {
      name: safeFileName(image.fileName),
      url: image.url,
      publicId: image.publicId,
      storage: 'authenticated',
      fileType: image.fileType,
      size: image.size
    }

    // The attachment is appended atomically. A read-modify-write of the whole
    // card document would drop one attachment when two uploads land at the
    // same time.
    const updated = await appendAttachment({ cardId: card._id, attachment })
    if (!updated) return res.status(404).json({ message: 'Card not found' })

    // Re-read the card so the response and the broadcast carry the committed
    // attachment list, including any attachment a concurrent upload added.
    const populated = await populateCardMembers(taskModel.findById(updated._id))

    getIO().to(`project:${updated.projectId}`).emit('card-updated', populated)

    res.status(201).json({ message: 'Attachment uploaded', payload: populated })
  } catch (err) {
    next(err)
  }
}
projectsApp.post('/cards/:id/attachments', write, uploadLimiter, upload.single('attachment'), uploadCardAttachment)

// DELETE /projects-api/cards/:id
projectsApp.delete('/cards/:id', write, async (req, res, next) => {
  try {
    const card = await withTransaction(async (session) => {
      const accessibleCard = await findEditableCard(req.params.id, req.user.id, session)
      if (!accessibleCard) return null
      return taskModel.findOneAndDelete({ _id: accessibleCard._id }, { session })
    })
    if (!card) return res.status(404).json({ message: 'Card not found' })

    getIO().to(`project:${card.projectId}`).emit('card-deleted', {
      cardId: req.params.id,
      listId: card.listId?.toString()
    })

    res.status(200).json({ message: 'Card deleted' })
  } catch (err) {
    next(err)
  }
})

// PUT /projects-api/lists/:id/cards/reorder
projectsApp.put('/lists/:id/cards/reorder', write, async (req, res, next) => {
  try {
    const { orderedIds } = req.body
    strictObject(req.body, ['orderedIds'])
    if (!Array.isArray(orderedIds) || orderedIds.length > 1000 || !orderedIds.every(objectId) || new Set(orderedIds).size !== orderedIds.length) return res.status(400).json({ message: 'Invalid orderedIds' })

    const reordered = await withTransaction(async (session) => {
      const list = await findEditableList(req.params.id, req.user.id, session)
      if (!list) return null
      const [matchingCards, activeCards] = await Promise.all([
        taskModel.countDocuments({
          _id: { $in: orderedIds }, listId: list._id, projectId: list.projectId, isActive: true
        }).session(session),
        taskModel.countDocuments({
          listId: list._id, projectId: list.projectId, isActive: true
        }).session(session)
      ])
      // The payload must be the complete active permutation for this list.
      if (matchingCards !== orderedIds.length || activeCards !== orderedIds.length) badRequest('Invalid card order payload')
      await taskModel.bulkWrite(orderedIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id, listId: list._id, projectId: list.projectId, isActive: true },
          update: { $set: { order: index } }
        }
      })), { session })
      return list
    })
    if (!reordered) return res.status(404).json({ message: 'List not found' })

    getIO().to(`project:${reordered.projectId}`).emit('cards-reordered', { listId: req.params.id, orderedIds })

    res.status(200).json({ message: 'Cards reordered' })
  } catch (err) {
    next(err)
  }
})
