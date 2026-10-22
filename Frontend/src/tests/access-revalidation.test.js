// Access changes must reach the client.
//
// The server is authoritative: it refuses a write the client is no longer
// allowed to make and it drops the socket of a member whose access was
// revoked. The client must then revalidate the board, so its capabilities
// (and the controls derived from them) match what the server will accept.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectStore } from '../store/projectStore'
import { beginBoardSession, closeSocket, peekSocket } from '../store/projectStoreUtils'

const ioState = vi.hoisted(() => ({ handlers: {}, emits: [] }))
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (event, handler) => { ioState.handlers[event] = handler },
    off: vi.fn(),
    emit: (...args) => ioState.emits.push(args),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn()
  })
}))

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

const user = { _id: 'user-1' }
const projectId = 'project-1'

beforeEach(() => {
  vi.resetAllMocks()
  // The socket is a singleton: closing it makes the next getSocket() create a
  // fresh one, so its handlers are registered again.
  closeSocket()
  ioState.handlers = {}
  ioState.emits = []
  useProjectStore.getState().resetBoard()
  beginBoardSession(projectId, user)
})

describe('access change revalidation', () => {
  it('revalidates the board when the server closes the socket', async () => {
    const fetchProject = vi.fn().mockResolvedValue({ _id: projectId })
    const fetchLists = vi.fn().mockResolvedValue([])
    useProjectStore.setState({ fetchProject, fetchLists, cards: {} })
    useProjectStore.getState().joinProject(projectId, user)

    // The server revoked the access and closed the socket.
    ioState.handlers.disconnect('io server disconnect')
    await vi.waitFor(() => expect(fetchLists).toHaveBeenCalled())

    expect(fetchProject).toHaveBeenCalledWith(projectId, { force: true })
    expect(fetchLists).toHaveBeenCalledWith(projectId, { force: true })
  })

  it('does not revalidate for a transport drop, which reconnects on its own', () => {
    const fetchProject = vi.fn().mockResolvedValue({ _id: projectId })
    const fetchLists = vi.fn().mockResolvedValue([])
    useProjectStore.setState({ fetchProject, fetchLists, cards: {} })
    useProjectStore.getState().joinProject(projectId, user)

    ioState.handlers.disconnect('transport close')

    expect(fetchProject).not.toHaveBeenCalled()
  })

  it('stops reconnecting a socket the server closed on purpose', () => {
    useProjectStore.getState().joinProject(projectId, user)
    const socket = peekSocket()
    ioState.handlers.disconnect('io server disconnect')
    expect(socket.disconnect).toHaveBeenCalled()
  })
})
