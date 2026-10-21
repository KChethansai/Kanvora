import { beforeEach, describe, expect, it, vi } from 'vitest'
import { closeSocket } from '../store/projectStoreUtils'
import { useProjectStore } from '../store/projectStore'

const ioState = vi.hoisted(() => ({ handlers: {}, emits: [], disconnect: vi.fn() }))
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (event, handler) => { ioState.handlers[event] = handler },
    off: vi.fn(),
    emit: (...args) => ioState.emits.push(args),
    removeAllListeners: vi.fn(),
    disconnect: ioState.disconnect
  })
}))

beforeEach(() => {
  closeSocket()
  ioState.handlers = {}
  ioState.emits = []
  ioState.disconnect.mockClear()
  useProjectStore.getState().resetBoard()
})

describe('socket board scoping and recovery', () => {
  it('ignores list and card events belonging to another board', () => {
    useProjectStore.getState().joinProject('project-a', { _id: 'user-a' })

    ioState.handlers['list-created']({ _id: 'foreign-list', projectId: 'project-b', order: 0 })
    ioState.handlers['card-created']({ _id: 'foreign-card', projectId: 'project-b', listId: 'list-a', order: 0 })
    expect(useProjectStore.getState().lists).toEqual([])
    expect(useProjectStore.getState().cards).toEqual({})

    ioState.handlers['list-created']({ _id: 'list-a', projectId: 'project-a', order: 0 })
    ioState.handlers['card-created']({ _id: 'card-a', projectId: 'project-a', listId: 'list-a', order: 0 })
    expect(useProjectStore.getState().lists.map((list) => list._id)).toEqual(['list-a'])
    expect(useProjectStore.getState().cards['list-a'].map((card) => card._id)).toEqual(['card-a'])
  })

  it('rejoins the current board and refetches missed state after reconnection', async () => {
    const fetchProject = vi.fn().mockResolvedValue(null)
    const fetchLists = vi.fn().mockResolvedValue([])
    useProjectStore.setState({ fetchProject, fetchLists, cards: {} })
    useProjectStore.getState().joinProject('project-a', { _id: 'user-a' })

    ioState.handlers.connect()
    expect(fetchProject).not.toHaveBeenCalled()
    ioState.emits = []
    ioState.handlers.connect()

    expect(ioState.emits).toContainEqual(['join-project', 'project-a', { _id: 'user-a' }])
    await vi.waitFor(() => expect(fetchProject).toHaveBeenCalledWith('project-a', { force: true }))
    expect(fetchLists).toHaveBeenCalledWith('project-a')
  })

  it('does not reconnect a socket forcibly closed by the server', () => {
    useProjectStore.getState().joinProject('project-a')
    ioState.handlers.disconnect('io server disconnect')
    expect(ioState.disconnect).toHaveBeenCalled()
  })
})
