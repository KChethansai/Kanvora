// The server caps every paged board read. The store must follow the signed
// cursor until the collection is complete before it decides that a list or a
// card is missing from the server: a partial page would look like a deletion.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useProjectStore } from '../store/projectStore'

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

const page = (rows, nextCursor, hasMore) => ({
  data: {
    payload: rows,
    nextCursor: nextCursor ?? null,
    hasMore: hasMore ?? Boolean(nextCursor)
  }
})

beforeEach(() => {
  vi.resetAllMocks()
  useProjectStore.getState().resetBoard()
})

describe('board reads follow the server cursor', () => {
  it('collects every list page before deciding that a list was deleted', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('cursor=next-2')) return Promise.resolve(page([{ _id: 'list-3', projectId: 'p1' }]))
      return Promise.resolve(page([{ _id: 'list-1', projectId: 'p1' }], 'next-2'))
    })

    await useProjectStore.getState().fetchLists('p1')

    expect(axios.get).toHaveBeenCalledTimes(2)
    expect(useProjectStore.getState().lists.map((list) => list._id)).toEqual(['list-1', 'list-3'])
  })

  it('collects every card page before replacing the cards of a list', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('cursor=next-2')) {
        return Promise.resolve(page([{ _id: 'card-2', listId: 'list-1' }]))
      }
      return Promise.resolve(page([{ _id: 'card-1', listId: 'list-1' }], 'next-2'))
    })

    await useProjectStore.getState().fetchCards('list-1')

    expect(axios.get).toHaveBeenCalledTimes(2)
    expect(useProjectStore.getState().cards['list-1'].map((card) => card._id)).toEqual(['card-1', 'card-2'])
  })

  it('fails closed when the server reports more pages without a usable cursor', async () => {
    axios.get.mockResolvedValue(page([{ _id: 'list-1', projectId: 'p1' }], '', true))

    await useProjectStore.getState().fetchLists('p1')

    // The incomplete collection must not replace the board state.
    expect(useProjectStore.getState().lists).toEqual([])
  })

  it('stops instead of looping when the cursor does not advance', async () => {
    axios.get.mockResolvedValue(page([{ _id: 'list-1', projectId: 'p1' }], 'same-cursor'))

    await useProjectStore.getState().fetchLists('p1')

    expect(axios.get).toHaveBeenCalledTimes(2)
    expect(useProjectStore.getState().lists).toEqual([])
  })
})
