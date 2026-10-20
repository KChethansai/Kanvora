import { describe, expect, it, vi } from 'vitest'
import { fetchAllProjects } from '../utils/paginatedProjects'
import { API_BASE_URL } from '../config/api'

const page = (ids, hasMore, nextCursor = null) => ({
  data: { payload: ids.map((id) => ({ _id: id, title: id })), hasMore, nextCursor }
})

describe('project pagination', () => {
  it('follows signed cursors until hasMore is false', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(page(['a', 'b'], true, 'cursor-1'))
      .mockResolvedValueOnce(page(['c'], true, 'cursor-2'))
      .mockResolvedValueOnce(page(['d'], false))
    const projects = await fetchAllProjects({ workspaceId: 'workspace 1', request: { get } })
    expect(projects.map((project) => project._id)).toEqual(['a', 'b', 'c', 'd'])
    expect(get.mock.calls).toEqual([
      [`${API_BASE_URL}/projects-api/projects?limit=100&workspaceId=workspace+1`, { withCredentials: true }],
      [`${API_BASE_URL}/projects-api/projects?limit=100&workspaceId=workspace+1&cursor=cursor-1`, { withCredentials: true }],
      [`${API_BASE_URL}/projects-api/projects?limit=100&workspaceId=workspace+1&cursor=cursor-2`, { withCredentials: true }]
    ])
  })

  it('deduplicates projects that move between pages', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(page(['a', 'b'], true, 'cursor-1'))
      .mockResolvedValueOnce(page(['b', 'c'], false))
    const projects = await fetchAllProjects({ request: { get } })
    expect(projects.map((project) => project._id)).toEqual(['a', 'b', 'c'])
  })

  it('fails closed on malformed pages, missing cursors and cursor loops', async () => {
    await expect(fetchAllProjects({ request: { get: vi.fn().mockResolvedValue({ data: {} }) } }))
      .rejects.toThrow('Invalid project page')
    await expect(fetchAllProjects({ request: { get: vi.fn().mockResolvedValue(page(['a'], true)) } }))
      .rejects.toThrow('Invalid project cursor')
    const get = vi.fn()
      .mockResolvedValueOnce(page(['a'], true, 'same'))
      .mockResolvedValueOnce(page(['b'], true, 'same'))
    await expect(fetchAllProjects({ request: { get } })).rejects.toThrow('Invalid project cursor')
    await expect(fetchAllProjects({ limit: 0, request: { get: vi.fn() } }))
      .rejects.toThrow('Invalid project page size')
  })
})
