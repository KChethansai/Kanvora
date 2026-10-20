import Template from '../models/template.js'
import { projectModel } from '../models/ProjectModel.js'
import { ListModel } from '../models/ListModel.js'
import { WorkspaceModel } from '../models/Workspace.js'
import { findProject } from '../authorization/resources.js'
import { workspaceCan } from '../authorization/workspacePolicy.js'
import { withTransaction } from '../utils/transactions.js'
import { UserModel } from '../models/usermodel.js'

const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const visible = (userId) => ({ $or: [{ isPublished: true }, { creatorId: userId }] })
const templateFilter = (userId) => ({ type: { $ne: 'fav-marker' }, ...visible(userId) })
const projectFilter = (userId) => ({ status: true, archivedAt: null, ...visible(userId) })
const ownerOf = (item, userId) => String(item.creatorId?._id || item.creatorId) === userId
const favouriteOf = (item, userId) => (item.favourites || []).some((id) => String(id) === userId)
const fail = (res, error) => res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: error.name === 'ValidationError' ? 'Invalid template data' : 'Internal Server Error' })

const safeWebUrl = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}

async function visibleProject(project, userId) {
  const actor = project.isPublished ? String(project.creatorId?._id || project.creatorId || '') : userId
  // A publication flag cannot revive a deleted parent or a removed creator's grant.
  return Boolean(await findProject(String(project._id), actor, 'read'))
}

function dto(item, userId, type = 'template', favourite = favouriteOf(item, userId)) {
  const own = ownerOf(item, userId)
  const details = item.publishDetails?.toObject?.() || item.publishDetails || {}
  return {
    _id: item._id, title: item.title, description: item.description,
    category: type === 'project' ? details.category?.trim() || 'Project' : item.category,
    creatorId: item.creatorId?._id || item.creatorId,
    creatorName: type === 'project' ? item.creatorId?.name || 'Unknown' : item.creatorName,
    images: type === 'project' ? item.img ? [item.img] : [] : item.images,
    isPublished: item.isPublished, isEditable: item.isEditable,
    isViewOnly: !own, allowPublicEdit: false, favourite,
    publishDetails: own ? details : {
      companyName: details.companyName || '', website: details.website || '',
      templateType: details.templateType || '', category: details.category || ''
    },
    createdAt: item.createdAt, updatedAt: item.updatedAt, type
  }
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
  return project && await visibleProject(project, userId) ? { item: project, type: 'project' } : null
}

export const createTemplate = async (req, res) => {
  try {
    if (!validInput(req.body, true)) return res.status(400).json({ message: 'Invalid template data' })
    const userId = String(req.user.id)
    const creator = await UserModel.findById(userId).select('name')
    if (!creator) return res.status(401).json({ message: 'Please sign in again' })
    const template = await Template.create({ ...req.body, creatorId: userId, creatorName: creator.name })
    res.status(201).json({ message: 'Template created successfully', payload: dto(template, userId) })
  } catch (error) { fail(res, error) }
}

export const getTemplates = async (req, res) => {
  try {
    const userId = String(req.user.id)
    const templates = await Template.find(templateFilter(userId)).sort({ createdAt: -1 })
    const candidates = await projectModel.find(projectFilter(userId)).populate('creatorId', 'name').sort({ createdAt: -1 })
    const projects = []
    for (const project of candidates) if (await visibleProject(project, userId)) projects.push(project)
    const markers = await Template.find({ type: 'fav-marker', projectRef: { $in: projects.map((p) => p._id) }, favourites: userId }).select('projectRef')
    const favourites = new Set(markers.map((marker) => String(marker.projectRef)))
    res.status(200).json({ message: 'Templates fetched successfully', payload: [
      ...templates.map((item) => dto(item, userId)),
      ...projects.map((item) => dto(item, userId, 'project', favourites.has(String(item._id))))
    ] })
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
    res.status(200).json({ message: 'Template fetched successfully', payload: dto(item, userId, type, favourite) })
  } catch (error) { fail(res, error) }
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
      target = await Template.findOne({ type: 'fav-marker', projectRef: id })
      if (!target) target = await Template.create({ type: 'fav-marker', projectRef: id, title: `fav-marker-${id}`, creatorId: userId, creatorName: 'system', category: 'system' })
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
  const project = await projectModel.findOne({ _id: id, status: true, archivedAt: null, isPublished: true })
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
    res.status(200).json({ message: 'Published status updated successfully', payload: dto(resource.item, userId, resource.type) })
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
    res.status(200).json({ message: 'Template updated successfully', payload: dto(resource.item, userId, resource.type) })
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
