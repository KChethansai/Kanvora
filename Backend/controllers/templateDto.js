// templateDto: response shaping for template and project resources.
// Write controls follow the scoped policy the write routes use, never the
// caller's account-wide role or the resource's creator field.
export const ownerOf = (item, userId) => String(item.creatorId?._id || item.creatorId) === userId
export const favouriteOf = (item, userId) => (item.favourites || []).some((id) => String(id) === userId)

export function buildTemplateDto(item, userId, type = 'template', favourite = favouriteOf(item, userId), canWrite = ownerOf(item, userId)) {
  const own = ownerOf(item, userId)
  const details = item.publishDetails?.toObject?.() || item.publishDetails || {}
  return {
    _id: item._id, title: item.title, description: item.description,
    category: type === 'project' ? details.category?.trim() || 'Project' : item.category,
    creatorId: item.creatorId?._id || item.creatorId,
    creatorName: type === 'project' ? item.creatorId?.name || 'Unknown' : item.creatorName,
    images: type === 'project' ? item.img ? [item.img] : [] : item.images,
    isPublished: item.isPublished, isEditable: item.isEditable,
    capabilities: { edit: Boolean(canWrite), delete: Boolean(canWrite) },
    isViewOnly: !canWrite, allowPublicEdit: false, favourite,
    publishDetails: own ? details : {
      companyName: details.companyName || '', website: details.website || '',
      templateType: details.templateType || '', category: details.category || ''
    },
    createdAt: item.createdAt, updatedAt: item.updatedAt, type
  }
}
