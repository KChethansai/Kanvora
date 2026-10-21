import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useProjectStore } from '../store/projectStore'

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

beforeEach(() => {
  vi.resetAllMocks()
  useProjectStore.getState().resetBoard()
})

describe('board fetch and delete failure handling', () => {
  it('does not let a stale project list response replace the active board or strand its loading flag', async () => {
    let resolveA
    axios.get.mockImplementation((url) => {
      if (url.includes('/A/lists')) return new Promise((resolve) => { resolveA = resolve })
      return Promise.resolve({ data: { payload: [{ _id: 'b-list' }] } })
    })

    const a = useProjectStore.getState().fetchLists('A')
    const b = useProjectStore.getState().fetchLists('B')
    await b
    resolveA({ data: { payload: [{ _id: 'a-list' }] } })
    await a

    expect(useProjectStore.getState().lists).toEqual([{ _id: 'b-list' }])
    expect(useProjectStore.getState().loadingLists).toMatchObject({ A: false, B: false })

    axios.get.mockResolvedValueOnce({ data: { payload: [{ _id: 'a-list' }] } })
    await useProjectStore.getState().fetchLists('A')
    expect(useProjectStore.getState().lists).toEqual([{ _id: 'a-list' }])
  })

  it('restores an optimistic card delete when the server rejects it', async () => {
    const card = { _id: 'card-1', title: 'Keep me' }
    useProjectStore.setState({ cards: { 'list-1': [card] }, lists: [{ _id: 'list-1' }] })
    axios.delete.mockRejectedValueOnce(new Error('offline'))

    const deleted = await useProjectStore.getState().deleteCard('card-1', 'list-1')
    expect(deleted).toBe(false)
    expect(useProjectStore.getState().cards['list-1']).toEqual([card])
  })

  it('ignores a list created for a project the user already left', async () => {
    useProjectStore.setState({ activeProject: { _id: 'project-b' }, lists: [] })
    axios.post.mockResolvedValueOnce({ data: { payload: { _id: 'list-a', order: 0 } } })

    await useProjectStore.getState().createList('project-a', 'Old list')
    expect(useProjectStore.getState().lists).toEqual([])
  })

  it('inserts a list created while the new project is still loading', async () => {
    let resolveFetch
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve }))
    const pending = useProjectStore.getState().fetchLists('project-b')
    useProjectStore.setState({ activeProject: { _id: 'project-a' }, lists: [] })
    axios.post.mockResolvedValueOnce({ data: { payload: { _id: 'list-b', order: 0, projectId: 'project-b' } } })
    await useProjectStore.getState().createList('project-b', 'New list')
    expect(useProjectStore.getState().lists).toEqual([{ _id: 'list-b', order: 0, projectId: 'project-b' }])

    resolveFetch({ data: { payload: [] } })
    await pending
    expect(useProjectStore.getState().lists).toEqual([{ _id: 'list-b', order: 0, projectId: 'project-b' }])
  })

  it('rolls back only the card whose mutation failed', async () => {
    const a = { _id: 'card-a', title: 'A', order: 0, listId: 'list-1' }
    const b = { _id: 'card-b', title: 'B', order: 1, listId: 'list-1' }
    useProjectStore.setState({ cards: { 'list-1': [a, b] }, lists: [{ _id: 'list-1' }] })
    axios.put.mockRejectedValueOnce(new Error('offline'))

    expect(await useProjectStore.getState().updateCard('card-a', { title: 'A failed' })).toBe(null)
    expect(useProjectStore.getState().cards['list-1']).toEqual([a, b])
  })

  it('does not let a stale failure roll back a newer card mutation', async () => {
    const card = { _id: 'card-a', title: 'Original', order: 0, listId: 'list-1' }
    useProjectStore.setState({ cards: { 'list-1': [card] }, lists: [{ _id: 'list-1' }] })
    let rejectFirst
    let resolveSecond
    axios.put
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))

    const first = useProjectStore.getState().updateCard('card-a', { title: 'First' })
    const second = useProjectStore.getState().updateCard('card-a', { title: 'Second' })
    resolveSecond({ data: { payload: { ...card, title: 'Second' } } })
    await second
    rejectFirst(new Error('offline'))
    await first

    const current = useProjectStore.getState().cards['list-1'][0]
    expect(current.title).toBe('Second')
  })

  it('reports project deletion outcomes and clears discovery caches', async () => {
    useProjectStore.setState({
      projects: [{ _id: 'project-a', title: 'A' }],
      activeProject: { _id: 'project-a' },
      cache: { 'projects:all': { data: [], timestamp: Date.now() }, unrelated: 1 },
      loadedProjects: { 'project-a': true }
    })
    axios.delete.mockRejectedValueOnce(new Error('offline'))
    expect(await useProjectStore.getState().deleteProject('project-a')).toBe(false)
    expect(useProjectStore.getState().projects).toHaveLength(1)

    axios.delete.mockResolvedValueOnce({ data: {} })
    expect(await useProjectStore.getState().deleteProject('project-a')).toBe(true)
    expect(useProjectStore.getState().projects).toEqual([])
    expect(useProjectStore.getState().activeProject).toBe(null)
    expect(useProjectStore.getState().loadedProjects['project-a']).toBeUndefined()
    expect(useProjectStore.getState().cache).toEqual({ unrelated: 1 })
  })
})
