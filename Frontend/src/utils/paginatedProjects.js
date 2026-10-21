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

// The server caps every paged read, so a board with more rows than one page
// needs the whole collection before the store can decide that a row was
// deleted. Follow the signed cursor until the server reports no more pages;
// a malformed page or a cursor that does not advance fails closed instead of
// silently returning a partial collection.
export async function fetchAllPages({ url, limit = null, request = axios } = {}) {
  if (!url) throw new Error('A page url is required')
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    throw new Error('Invalid page size')
  }
  const rows = new Map()
  const seenCursors = new Set()
  let cursor = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams()
    // The server caps a page on its own, so the first request stays exactly
    // the plain resource url.
    if (limit) params.set('limit', String(limit))
    if (cursor) params.set('cursor', cursor)
    const query = params.toString()
    const response = await request.get(query ? `${url}?${query}` : url, { withCredentials: true })
    const payload = response?.data?.payload
    if (!Array.isArray(payload)) throw new Error('Invalid page')
    for (const row of payload) if (row?._id) rows.set(String(row._id), row)

    if (response.data.hasMore !== true) return [...rows.values()]
    const nextCursor = response.data.nextCursor
    if (typeof nextCursor !== 'string' || !nextCursor || seenCursors.has(nextCursor)) {
      throw new Error('Invalid cursor')
    }
    seenCursors.add(nextCursor)
    cursor = nextCursor
  }
  throw new Error('Pagination limit exceeded')
}
