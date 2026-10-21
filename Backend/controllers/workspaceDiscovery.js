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
    if (cursor) query._id = { $lt: cursor }
    const page = await find(query)
      .sort({ _id: -1 })
      .limit(Math.min(pageSize, maxScan - scanned))
      .maxTimeMS(5000)
    if (page.length === 0) break
    scanned += page.length
    cursor = page[page.length - 1]._id
    for (const workspace of page) {
      if (canRead(workspace, userId)) accessible.push(workspace)
      if (accessible.length >= limit) break
    }
    if (page.length < pageSize) break
  }

  return accessible
}
