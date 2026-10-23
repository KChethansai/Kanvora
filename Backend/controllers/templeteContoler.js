import Template from '../models/template.js'
import mongoose from 'mongoose'
import { projectModel } from '../models/ProjectModel.js'
import { ListModel } from '../models/ListModel.js'
import { WorkspaceModel } from '../models/Workspace.js'
import { findProject, projectPolicy } from '../authorization/resources.js'
import { workspaceCan } from '../authorization/workspacePolicy.js'
import { withTransaction } from '../utils/transactions.js'
import { UserModel } from '../models/usermodel.js'
import { buildTemplateDto, favouriteOf, ownerOf } from './templateDto.js'
import { decodeKeysetCursor, encodeKeysetCursor, keysetAfter, parsePageLimit } from '../utils/keysetCursor.js'

const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const visible = (userId) => ({ $or: [{ isPublished: true }, { creatorId: userId }] })
const templateFilter = (userId) => ({ type: { $ne: 'fav-marker' }, ...visible(userId) })
const projectFilter = (userId) => ({ status: true, archivedAt: null, ...visible(userId) })
const fail = (res, error) => {
  // Cursor and limit violations carry an explicit status; everything else is
  // either a validation failure or an unexpected server error.
  if (error.status === 400) return res.status(400).json({ message: error.message })
  return res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: error.name === 'ValidationError' ? 'Invalid template data' : 'Internal Server Error' })
}

const safeWebUrl = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}

// The candidate project and its workspace are loaded once, so the read check
// and the write-capability check share a single round trip per project.
// A publication flag cannot revive a deleted parent or a removed creator's grant.
async function projectCapabilitiesFor(project, userId, workspaces = null) {
  const actor = project.isPublished ? String(project.creatorId?._id || project.creatorId || '') : userId
  const workspaceId = project.populated?.('workspace') ? project.workspace?._id : project.workspace
  let workspace = null
  if (workspaceId) {
    const key = String(workspaceId)
    // A discovery page spans many projects that usually share a few
    // workspaces. Loading them once per page keeps the read bounded instead of
    // costing one lookup per project.
    if (workspaces?.has(key)) {
      workspace = workspaces.get(key)
    } else {
      workspace = await WorkspaceModel.findById(key)
      workspaces?.set(key, workspace)
    }
  }
  const readable = await projectPolicy(project, actor, 'read', workspace)
  if (!readable) return null
  const canWrite = await projectPolicy(project, userId, 'manage', workspace)
  return { readable: true, canWrite }
}

// Discovery is a union of two collections, so a page is produced by merging two
// independently keyset-paged streams. Each stream advances only past the rows
// this page actually consumed, which is what keeps a newly inserted row from
// making the next page skip or repeat an older one.
const DISCOVERY_PAGE_SIZE = 24
const DISCOVERY_MAX_PAGE_SIZE = 50
const DISCOVERY_SORT = { createdAt: -1, _id: -1 }
const DISCOVERY_SCOPE = 'templates-discovery'

const discoveryCursorKeys = (keys) => Array.isArray(keys) && keys.length === 2 &&
  Number.isInteger(keys[0]) && keys[0] >= 0 &&
  typeof keys[1] === 'string' && /^[a-f\d]{24}$/.test(keys[1])

const discoveryAfter = (position) => (position
  ? keysetAfter(['createdAt', '_id'], [new Date(position[0]), new mongoose.Types.ObjectId(position[1])], 'desc')
  : {})

const newerFirst = (left, right) => {
  const leftTime = new Date(left.createdAt).getTime()
  const rightTime = new Date(right.createdAt).getTime()
  if (leftTime !== rightTime) return rightTime - leftTime
  const leftId = String(left._id)
  const rightId = String(right._id)
  if (leftId === rightId) return 0
  return leftId < rightId ? 1 : -1
}

const preloadWorkspaces = async (projects, cache) => {
  const ids = [...new Set(projects
    .map((project) => (project.populated?.('workspace') ? project.workspace?._id : project.workspace))
    .filter(Boolean)
    .map(String))]
  const missing = ids.filter((id) => !cache.has(id))
  if (!missing.length) return
  const workspaces = await WorkspaceModel.find({ _id: { $in: missing } })
  for (const workspace of workspaces) cache.set(String(workspace._id), workspace)
  // A deleted workspace still has to be cached, or the next project in the
  // same page would look it up again.
  for (const id of missing) if (!cache.has(id)) cache.set(id, null)
}

// A search term is matched literally: user input is escaped, so a query such as
// ".*" cannot turn into a match-everything pattern, and the length is bounded.
const searchClause = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string' || raw.trim().length > 80) {
    const error = new Error('Invalid search')
    error.status = 400
    throw error
  }
  const text = raw.trim()
  if (!text) return null
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(escaped, 'i')
  return { $or: [{ title: pattern }, { description: pattern }, { category: pattern }] }
}

async function collectDiscoveryPage(userId, limit, cursor, search = null) {
  const wanted = limit + 1
  const collected = []
  const projectWrites = new Map()
  const workspaces = new Map()
  const streams = {
    template: { rows: [], done: false, position: cursor },
    project: { rows: [], done: false, position: cursor }
  }

  const refill = async (kind) => {
    const stream = streams[kind]
    if (stream.done) return
    // Bounded per round trip: never read more than the maximum page size, and
    // only enough to fill the page plus a small overlap.
    const take = Math.min(DISCOVERY_MAX_PAGE_SIZE, Math.max(8, wanted - collected.length + 4))
    const filter = kind === 'template' ? templateFilter(userId) : projectFilter(userId)
    // Both the visibility filter and the keyset predicate are `$or` clauses.
    // Spreading them into one object would let the cursor overwrite the
    // authorization predicate on every page after the first, so they are
    // combined explicitly instead.
    const scoped = { $and: [filter, discoveryAfter(stream.position), ...(search ? [search] : [])] }
    const query = kind === 'template'
      ? Template.find(scoped)
      : projectModel.find(scoped)
    if (kind === 'project') query.populate('creatorId', 'name')
    const batch = await query.sort(DISCOVERY_SORT).limit(take)
    if (kind === 'project') await preloadWorkspaces(batch, workspaces)
    stream.rows = batch
    // A short batch means this collection is exhausted past the cursor.
    if (batch.length < take) stream.done = true
  }

  const nextKind = () => {
    const template = streams.template.rows[0]
    const project = streams.project.rows[0]
    if (!template) return project ? 'project' : null
    if (!project) return 'template'
    return newerFirst(template, project) <= 0 ? 'template' : 'project'
  }

  for (;;) {
    if (collected.length >= wanted) break
    for (const kind of ['template', 'project']) {
      if (!streams[kind].rows.length && !streams[kind].done) await refill(kind)
    }
    const kind = nextKind()
    if (!kind) break
    const row = streams[kind].rows.shift()
    streams[kind].position = [new Date(row.createdAt).getTime(), String(row._id)]
    if (kind === 'project') {
      const capabilities = await projectCapabilitiesFor(row, userId, workspaces)
      if (!capabilities) continue
      projectWrites.set(String(row._id), capabilities.canWrite)
    }
    collected.push({ kind, row })
  }

  return { collected, projectWrites }
}

function validInput(body, create = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const strings = { title: 200, description: 10000, category: 200, creatorName: 200 }
  const fields = create ? [...Object.keys(strings), 'images', 'isPublished', 'isEditable', 'publishDetails'] : ['title', 'description', 'category', 'images', 'isPublished', 'isEditable', 'publishDetails']
  if (Object.keys(body).some((key) => !fields.includes(key))) return false
  for (const [key, max] of Object.entries(strings)) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > max || (key !== 'description' && !body[key].trim()))) return false
  }
  if (create && (!body.title?.trim() || !body.category?.trim())) return false
  for (const key of ['isPublished', 'isEditable']) if (body[key] !== undefined && typeof body[key] !== 'boolean') return false
  if (body.images !== undefined && (!Array.isArray(body.images) || body.images.length > 20 || body.images.some((image) => typeof image !== 'string' || image.length > 2000 || !safeWebUrl(image)))) return false
  if (body.publishDetails !== undefined) {
    const details = body.publishDetails
    if (!details || typeof details !== 'object' || Array.isArray(details) || Object.entries(details).some(([key, value]) =>
       !['companyName', 'website', 'contactEmail', 'templateType', 'category', 'notes'].includes(key) || typeof value !== 'string' || value.length > (key === 'notes' ? 10000 : 2000))) return false
    if (details.website && !safeWebUrl(details.website)) return false
    if (details.contactEmail && (details.contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.contactEmail))) return false
  }
  return true
}

async function visibleResource(id, userId) {
  const template = await Template.findOne({ _id: id, ...templateFilter(userId) })
  if (template) return { item: template, type: 'template' }
  const project = await projectModel.findOne({ _id: id, ...projectFilter(userId) }).populate('creatorId', 'name')
  if (!project) return null
  const capabilities = await projectCapabilitiesFor(project, userId)
  return capabilities ? { item: project, type: 'project', canWrite: capabilities.canWrite } : null
}

export const createTemplate = async (req, res) => {
  try {
    if (!validInput(req.body, true)) return res.status(400).json({ message: 'Invalid template data' })
    const userId = String(req.user.id)
    const creator = await UserModel.findById(userId).select('name')
    if (!creator) return res.status(401).json({ message: 'Please sign in again' })
    const template = await Template.create({ ...req.body, creatorId: userId, creatorName: creator.name })
    res.status(201).json({ message: 'Template created successfully', payload: buildTemplateDto(template, userId) })
  } catch (error) { fail(res, error) }
}

export const getTemplates = async (req, res) => {
  try {
    const userId = String(req.user.id)
    const limit = req.query.limit === undefined
      ? DISCOVERY_PAGE_SIZE
      : parsePageLimit(req.query.limit, DISCOVERY_MAX_PAGE_SIZE, 'Invalid limit')
    const cursor = req.query.cursor === undefined
      ? null
      : decodeKeysetCursor(
        req.query.cursor,
        { scope: DISCOVERY_SCOPE, viewer: userId },
        { validate: discoveryCursorKeys }
      )
    const search = searchClause(req.query.search)
    const { collected, projectWrites } = await collectDiscoveryPage(userId, limit, cursor, search)
    const hasMore = collected.length > limit
    const page = collected.slice(0, limit)
    const projectIds = page.filter((entry) => entry.kind === 'project').map((entry) => entry.row._id)
    // One batched lookup for the page's favourites, not one per project.
    const markers = projectIds.length
      ? await Template.find({ type: 'fav-marker', projectRef: { $in: projectIds }, favourites: userId }).select('projectRef')
      : []
    const favourites = new Set(markers.map((marker) => String(marker.projectRef)))
    const payload = page.map(({ kind, row }) => (kind === 'template'
      ? buildTemplateDto(row, userId)
      : buildTemplateDto(row, userId, 'project', favourites.has(String(row._id)), projectWrites.get(String(row._id)))))
    const last = page[page.length - 1]
    const nextCursor = hasMore && last
      ? encodeKeysetCursor(
        { scope: DISCOVERY_SCOPE, viewer: userId },
        [new Date(last.row.createdAt).getTime(), String(last.row._id)]
      )
      : null
    res.status(200).json({
      message: 'Templates fetched successfully',
      payload,
      page: { limit, hasMore, nextCursor }
    })
  } catch (error) { fail(res, error) }
}

export const getTemplateById = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid template id' })
    const userId = String(req.user.id)
    const resource = await visibleResource(req.params.id, userId)
    if (!resource) return res.status(404).json({ message: 'Template not found' })
    const { item, type } = resource
    const favourite = type === 'project' ? Boolean(await Template.exists({ type: 'fav-marker', projectRef: item._id, favourites: userId })) : favouriteOf(item, userId)
    const canWrite = type === 'template' ? ownerOf(item, userId) : Boolean(resource.canWrite)
    res.status(200).json({ message: 'Template fetched successfully', payload: buildTemplateDto(item, userId, type, favourite, canWrite) })
  } catch (error) { fail(res, error) }
}

// One board keeps one favourite marker. The marker is created with an atomic
// upsert and any duplicate a concurrent favourite left behind is collapsed
// into the marker that is kept, so the favourites of an address never split
// across two documents.
const favouriteMarker = async (id, userId) => {
  const filter = { type: 'fav-marker', projectRef: id }
  const marker = await Template.findOneAndUpdate(
    filter,
    { $setOnInsert: { type: 'fav-marker', projectRef: id, title: `fav-marker-${id}`, creatorId: userId, creatorName: 'system', category: 'system' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  const duplicates = await Template.find({ ...filter, _id: { $ne: marker._id } }).select('_id favourites')
  if (duplicates.length) {
    const merged = [...new Set([
      ...(marker.favourites || []).map((value) => String(value)),
      ...duplicates.flatMap((duplicate) => (duplicate.favourites || []).map((value) => String(value)))
    ])]
    await Template.updateOne({ _id: marker._id }, { $set: { favourites: merged.map((value) => new mongoose.Types.ObjectId(value)) } })
    await Template.deleteMany({ _id: { $in: duplicates.map((duplicate) => duplicate._id) } })
    marker.favourites = merged.map((value) => new mongoose.Types.ObjectId(value))
  }
  return marker
}

export const toggleFavourite = async (req, res) => {
  try {
    const { id } = req.params
    if (!validId(id)) return res.status(400).json({ message: 'Invalid template id' })
    const userId = String(req.user.id)
    const resource = await visibleResource(id, userId)
    if (!resource) return res.status(404).json({ message: 'Template not found' })
    let target = resource.item
    if (resource.type === 'project') {
      target = await favouriteMarker(id, userId)
    }
    const favourite = !favouriteOf(target, userId)
    await Template.updateOne({ _id: target._id }, favourite ? { $addToSet: { favourites: userId } } : { $pull: { favourites: userId } })
    res.status(200).json({ message: 'Favourite updated successfully', payload: { id, favourite } })
  } catch (error) { fail(res, error) }
}

async function writableResource(id, userId, res) {
  const template = await Template.findOne({ _id: id, type: { $ne: 'fav-marker' } })
  if (template) {
    if (ownerOf(template, userId)) return { item: template, type: 'template' }
    res.status(403).json({ message: 'Not authorized' })
    return null
  }
  // A board is resolved by its identity and its live state only. The
  // publication flag is what this resource is written to change, so it must
  // not be part of the lookup: an unpublished board is exactly the board that
  // PATCH /published and PUT /:id exist to publish.
  const project = await projectModel.findOne({ _id: id, status: true, archivedAt: null })
  if (!project) { res.status(404).json({ message: 'Template not found' }); return null }
  if (!await findProject(id, userId, 'manage')) { res.status(403).json({ message: 'Not authorized' }); return null }
  return { item: project, type: 'project' }
}

export const togglePublished = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid template id' })
    const userId = String(req.user.id)
    const resource = await writableResource(req.params.id, userId, res)
    if (!resource) return
    resource.item.isPublished = !resource.item.isPublished
    await resource.item.save()
    res.status(200).json({ message: 'Published status updated successfully', payload: buildTemplateDto(resource.item, userId, resource.type, undefined, true) })
  } catch (error) { fail(res, error) }
}

export const updateTemplate = async (req, res) => {
  try {
    if (!validId(req.params.id) || !validInput(req.body)) return res.status(400).json({ message: 'Invalid template data' })
    const userId = String(req.user.id)
    const resource = await writableResource(req.params.id, userId, res)
    if (!resource) return
    if (resource.type === 'project' && ['category', 'images'].some((key) => req.body[key] !== undefined)) return res.status(400).json({ message: 'Use project settings for project images and category' })
    for (const [key, value] of Object.entries(req.body)) resource.item[key] = value
    await resource.item.save()
    res.status(200).json({ message: 'Template updated successfully', payload: buildTemplateDto(resource.item, userId, resource.type, undefined, true) })
  } catch (error) { fail(res, error) }
}

export const useTemplate = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid template id' })
    const body = req.body ?? {}
    if (typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['workspaceId', 'title'].includes(key))) {
      return res.status(400).json({ message: 'Invalid board payload' })
    }
    if (body.workspaceId !== undefined && !validId(body.workspaceId)) {
      return res.status(400).json({ message: 'Invalid workspace ID' })
    }
    if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200)) {
      return res.status(400).json({ message: 'Invalid board title' })
    }
    const userId = String(req.user.id)
    const resource = await visibleResource(req.params.id, userId)
    if (!resource) return res.status(404).json({ message: 'Template not found' })

    let workspace = null
    if (body.workspaceId) {
      workspace = await WorkspaceModel.findById(body.workspaceId)
      if (!workspace || !workspaceCan(workspace, userId, 'manageBoards')) {
        return res.status(403).json({ message: 'Workspace access denied' })
      }
    } else if (!['MEMBER', 'ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only members and above can create personal boards' })
    }

    const title = (body.title ?? resource.item.title).trim()
    const project = await withTransaction(async (session) => {
      const [created] = await projectModel.create([{
        name: title,
        title,
        description: resource.item.description || '',
        workspace: workspace?._id ?? null,
        creatorId: userId,
        members: [],
        membershipVersion: 1,
        directGrants: [],
        isPublished: false,
        isEditable: false,
        publishDetails: {}
      }], { session })
      await ListModel.create(['To Do', 'In Progress', 'Done'].map((listTitle, order) => ({
        title: listTitle, projectId: created._id, order
      })), { session, ordered: true })
      return created
    })

    res.status(201).json({ message: 'Board created from template', payload: project })
  } catch (error) { fail(res, error) }
}

export const deleteTemplate = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid template id' })
    const resource = await writableResource(req.params.id, String(req.user.id), res)
    if (!resource) return
    if (resource.type === 'template') await resource.item.deleteOne()
    else { resource.item.isPublished = false; await resource.item.save() }
    res.status(200).json({ message: resource.type === 'template' ? 'Template deleted successfully' : 'Template removed successfully' })
  } catch (error) { fail(res, error) }
}
