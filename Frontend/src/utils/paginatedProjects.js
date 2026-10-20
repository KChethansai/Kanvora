import axios from 'axios'
import { API_BASE_URL } from '../config/api'

const MAX_PAGES = 200

const projectPageUrl = ({ workspaceId, limit, cursor }) => {
  const params = new URLSearchParams({ limit: String(limit) })
  if (workspaceId) params.set('workspaceId', workspaceId)
  if (cursor) params.set('cursor', cursor)
  return `${API_BASE_URL}/projects-api/projects?${params.toString()}`
}

// Follow the server's signed cursor until hasMore is false. A malformed page or
// a cursor that does not advance fails closed instead of looping or silently
// showing a partial list.
export async function fetchAllProjects({ workspaceId = null, limit = 100, request = axios } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid project page size')
  const projects = new Map()
  const seenCursors = new Set()
  let cursor = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await request.get(projectPageUrl({ workspaceId, limit, cursor }), { withCredentials: true })
    const payload = response?.data?.payload
    if (!Array.isArray(payload)) throw new Error('Invalid project page')
    for (const project of payload) if (project?._id) projects.set(String(project._id), project)

    if (response.data.hasMore !== true) return [...projects.values()]
    const nextCursor = response.data.nextCursor
    if (typeof nextCursor !== 'string' || !nextCursor || seenCursors.has(nextCursor)) {
      throw new Error('Invalid project cursor')
    }
    seenCursors.add(nextCursor)
    cursor = nextCursor
  }
  throw new Error('Project pagination limit exceeded')
}
