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
})
