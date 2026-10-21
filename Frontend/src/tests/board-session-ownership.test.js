// Board-session ownership: a response may only write into the store while the
// board session that started it is still the active one, and an authoritative
// list response is the truth about which lists exist.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useProjectStore } from '../store/projectStore'
import {
  beginBoardSession,
  getBoardSession,
  invalidateBoardSession,
  isBoardSessionCurrent,
  setActiveBoard
} from '../store/projectStoreUtils'

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn()
  })
}))

const user = { _id: 'user-1' }

beforeEach(() => {
  vi.resetAllMocks()
  useProjectStore.getState().resetBoard()
})

describe('board session identity', () => {
  it('starts a new session for each board and keeps it while that board stays active', () => {
    const first = beginBoardSession('A', user)

    expect(isBoardSessionCurrent(first)).toBe(true)
    expect(getBoardSession()).toBe(first)

    // Re-joining the same board must not orphan the requests it already started.
    expect(setActiveBoard('A', user)).toBe(first)
    expect(isBoardSessionCurrent(first)).toBe(true)

    // Another board always owns a new session.
    const second = setActiveBoard('B', user)
    expect(second).not.toBe(first)
    expect(isBoardSessionCurrent(first)).toBe(false)
    expect(isBoardSessionCurrent(second)).toBe(true)
  })

  it('invalidates the board session so responses from the old board are stale', () => {
    const session = beginBoardSession('A', user)

    invalidateBoardSession()

    expect(isBoardSessionCurrent(session)).toBe(false)
  })

  it('clears board state and ends the board session on reset', () => {
    const session = beginBoardSession('A', user)
    useProjectStore.setState({
      lists: [{ _id: 'list-1', projectId: 'A', title: 'To Do' }],
      cards: { 'list-1': [{ _id: 'card-1', listId: 'list-1' }] },
      activeProject: { _id: 'A' },
      loadedProjects: { A: true }
    })

    useProjectStore.getState().resetBoard()

    const state = useProjectStore.getState()
    expect(state.lists).toEqual([])
    expect(state.cards).toEqual({})
    expect(state.activeProject).toBeNull()
    expect(state.loadedProjects).toEqual({})
    expect(isBoardSessionCurrent(session)).toBe(false)
  })
})

describe('authoritative list reads', () => {
  it('does not write the previous board\'s lists after the board switched', async () => {
    beginBoardSession('A', user)

    let resolveA
    axios.get.mockImplementation((url) => {
      if (url.includes('/projects/A/lists')) {
        return new Promise((resolve) => { resolveA = resolve })
      }
      return Promise.resolve({ data: { payload: [{ _id: 'b-list', projectId: 'B' }] } })
    })

    const boardA = useProjectStore.getState().fetchLists('A')

    // The user navigates to another board while A is still loading.
    setActiveBoard('B', user)
    await useProjectStore.getState().fetchLists('B')
    expect(useProjectStore.getState().lists.map((list) => list._id)).toEqual(['b-list'])

    resolveA({ data: { payload: [{ _id: 'a-list', projectId: 'A' }] } })
    await boardA

    expect(useProjectStore.getState().lists.map((list) => list._id)).toEqual(['b-list'])
  })

  it('removes a list the authoritative response omits and drops its card bucket', async () => {
    beginBoardSession('A', user)
    useProjectStore.setState({
      lists: [
        { _id: 'list-1', projectId: 'A', title: 'Kept', order: 0 },
        { _id: 'list-2', projectId: 'A', title: 'Deleted on the server', order: 1 }
      ],
      cards: {
        'list-1': [{ _id: 'card-1', listId: 'list-1', title: 'One' }],
        'list-2': [{ _id: 'card-2', listId: 'list-2', title: 'Two' }]
      }
    })

    axios.get.mockResolvedValue({
      data: { payload: [{ _id: 'list-1', projectId: 'A', title: 'Kept', order: 0 }] }
    })

    await useProjectStore.getState().fetchLists('A')

    const state = useProjectStore.getState()
    expect(state.lists.map((list) => list._id)).toEqual(['list-1'])
    expect(state.cards['list-1']).toHaveLength(1)
    expect(state.cards['list-2']).toBeUndefined()
  })

  it('keeps a list created locally while the list read was still in flight', async () => {
    beginBoardSession('A', user)

    let resolveLists
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveLists = resolve }))
    axios.post.mockResolvedValue({
      data: { payload: { _id: 'list-new', projectId: 'A', title: 'New list', order: 1 } }
    })

    const pending = useProjectStore.getState().fetchLists('A')
    await useProjectStore.getState().createList('A', 'New list')
    expect(useProjectStore.getState().lists.map((list) => list._id)).toEqual(['list-new'])

    // The server has not seen the new list yet.
    resolveLists({ data: { payload: [] } })
    await pending

    expect(useProjectStore.getState().lists.map((list) => list._id)).toEqual(['list-new'])
  })
})

describe('project detail reads', () => {
  it('does not set activeProject when the board is reset while the read is in flight', async () => {
    beginBoardSession('A', user)

    let resolveProject
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveProject = resolve }))

    const pending = useProjectStore.getState().fetchProject('A')
    useProjectStore.getState().resetBoard()
    expect(useProjectStore.getState().activeProject).toBeNull()

    resolveProject({ data: { payload: { _id: 'A', title: 'Board A' } } })
    await pending

    expect(useProjectStore.getState().activeProject).toBeNull()
  })

  it('does not let a pending read restore a cache that a mutation invalidated', async () => {
    beginBoardSession('A', user)

    let resolveProject
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveProject = resolve }))

    const pending = useProjectStore.getState().fetchProject('A')
    expect(useProjectStore.getState().loadingProject).toBe(true)

    // A membership or board change invalidates the pending read.
    useProjectStore.getState().invalidateProjectCaches()

    resolveProject({ data: { payload: { _id: 'A', title: 'Board A' } } })
    await pending

    expect(useProjectStore.getState().activeProject).toBeNull()
    // The discarded read must not leave the board loading forever.
    expect(useProjectStore.getState().loadingProject).toBe(false)
  })
})

describe('list ordering', () => {
  it('restores the server order when a reorder fails', async () => {
    beginBoardSession('A', user)
    const original = [
      { _id: 'l1', projectId: 'A', title: 'One', order: 0 },
      { _id: 'l2', projectId: 'A', title: 'Two', order: 1 }
    ]
    useProjectStore.setState({ lists: original })

    axios.put.mockRejectedValueOnce(new Error('offline'))
    axios.get.mockResolvedValueOnce({ data: { payload: original } })

    const saved = await useProjectStore
      .getState()
      .reorderLists('A', [original[1], original[0]])

    expect(saved).toBe(false)
    expect(useProjectStore.getState().lists.map((list) => list._id)).toEqual(['l1', 'l2'])
  })
})
