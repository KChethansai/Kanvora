import Template from '../models/template.js'
import { projectModel } from '../models/ProjectModel.js'
import { findProject } from '../authorization/resources.js'

const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const visible = (userId) => ({ $or: [{ isPublished: true }, { creatorId: userId }] })
const templateFilter = (userId) => ({ type: { $ne: 'fav-marker' }, ...visible(userId) })
const projectFilter = (userId) => ({ status: true, archivedAt: null, ...visible(userId) })
const ownerOf = (item, userId) => String(item.creatorId?._id || item.creatorId) === userId
const favouriteOf = (item, userId) => (item.favourites || []).some((id) => String(id) === userId)
const fail = (res, error) => res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: error.name === 'ValidationError' ? 'Invalid template data' : 'Internal Server Error' })

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
  if (body.images !== undefined && (!Array.isArray(body.images) || body.images.length > 20 || body.images.some((image) => typeof image !== 'string' || image.length > 2000 || !/^https?:\/\//i.test(image)))) return false
  if (body.publishDetails !== undefined) {
    const details = body.publishDetails
    if (!details || typeof details !== 'object' || Array.isArray(details) || Object.entries(details).some(([key, value]) =>
      !['companyName', 'website', 'contactEmail', 'templateType', 'category', 'notes'].includes(key) || typeof value !== 'string' || value.length > (key === 'notes' ? 10000 : 2000))) return false
  }
  return true
}

async function visibleResource(id, userId) {
  const template = await Template.findOne({ _id: id, ...templateFilter(userId) })
  if (template) return { item: template, type: 'template' }
  const project = await projectModel.findOne({ _id: id, ...projectFilter(userId) }).populate('creatorId', 'name')
  return project ? { item: project, type: 'project' } : null
}

export const createTemplate = async (req, res) => {
  try {
    if (!validInput(req.body, true)) return res.status(400).json({ message: 'Invalid template data' })
    const userId = String(req.user.id)
    const template = await Template.create({ ...req.body, creatorId: userId, creatorName: req.user.name || req.body.creatorName || 'Unknown' })
    res.status(201).json({ message: 'Template created successfully', payload: dto(template, userId) })
  } catch (error) { fail(res, error) }
}

export const getTemplates = async (req, res) => {
  try {
    const userId = String(req.user.id)
    const templates = await Template.find(templateFilter(userId)).sort({ createdAt: -1 })
    const projects = await projectModel.find(projectFilter(userId)).populate('creatorId', 'name').sort({ createdAt: -1 })
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
