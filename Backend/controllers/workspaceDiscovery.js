// workspaceDiscovery: bounded keyset scan for the workspaces a user may read.
// The scan is split out of the controller so it can be exercised without MongoDB.
const MEMBER_ROLES = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']

export async function collectAccessibleWorkspaces({
  find,
  canRead,
  userId,
  limit = 100,
  pageSize = 200,
  maxScan = 5000
}) {
  const accessible = []
  let cursor = null
  let scanned = 0

  while (accessible.length < limit && scanned < maxScan) {
    const query = {
      status: { $ne: false },
      isActive: { $ne: false },
      $or: [
        { owner: userId },
        { members: { $elemMatch: { user: userId, role: { $in: MEMBER_ROLES } } } }
      ]
    }
    // The list keeps its previous order (most recently updated first). The
    // cursor is therefore composite, so a row can never be skipped or repeated
    // when two rows share an updatedAt value.
    if (cursor) {
      query.$and = [{
        $or: [
          { updatedAt: { $lt: cursor.updatedAt } },
          { updatedAt: cursor.updatedAt, _id: { $lt: cursor._id } }
        ]
      }]
    }
    const page = await find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(Math.min(pageSize, maxScan - scanned))
      .maxTimeMS(5000)
    if (page.length === 0) break
    scanned += page.length
    const last = page[page.length - 1]
    cursor = { updatedAt: last.updatedAt, _id: last._id }
    for (const workspace of page) {
      if (canRead(workspace, userId)) accessible.push(workspace)
      if (accessible.length >= limit) break
    }
    if (page.length < pageSize) break
  }

  return accessible
}
