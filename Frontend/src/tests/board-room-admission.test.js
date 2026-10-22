// Board room admission and read order.
//
// The board must be in its socket room BEFORE the authoritative reads start.
// A peer change that happens while the board is still loading is then either
// part of the read or delivered live; it can never fall between the two and
// be lost.
//
// The ordering itself lives in the board component, so the order is asserted
// against the source; the behaviour is asserted against the store.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectStore } from '../store/projectStore'
import { beginBoardSession } from '../store/projectStoreUtils'

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
const source = readFileSync(resolve(import.meta.dirname, '../components/Project.jsx'), 'utf8')

beforeEach(() => {
  vi.resetAllMocks()
  ioState.handlers = {}
  ioState.emits = []
  useProjectStore.getState().resetBoard()
})

describe('board room admission', () => {
  it('joins the room before the board reads begin', () => {
    const effect = source.slice(
      source.indexOf('//fetch project data and join socket room'),
      source.indexOf('//hydrate every visible list with its current cards')
    )
    const join = effect.indexOf('joinProject(projectId, currentUser)')
    const listRead = effect.indexOf('await fetchLists(projectId)')
    const projectRead = effect.indexOf('await fetchProject(projectId')
    expect(join).toBeGreaterThan(-1)
    expect(listRead).toBeGreaterThan(-1)
    expect(projectRead).toBeGreaterThan(-1)
    // The room admission must come first: a change that happens while the
    // board is loading is then either read or delivered, never lost.
    expect(join).toBeLessThan(listRead)
    expect(join).toBeLessThan(projectRead)
  })

  it('registers every board event handler when the room is joined', () => {
    beginBoardSession(projectId, user)
    useProjectStore.getState().joinProject(projectId, user)

    for (const event of ['list-created', 'list-updated', 'list-deleted', 'lists-reordered',
      'card-created', 'card-updated', 'card-deleted', 'cards-reordered',
      'project-updated', 'project-deleted', 'presence-updated',
      'typing-started', 'typing-stopped', 'activity-created']) {
      expect(typeof ioState.handlers[event]).toBe('function')
    }
  })

  it('keeps a list that a peer created while the board was loading', () => {
    beginBoardSession(projectId, user)
    useProjectStore.getState().joinProject(projectId, user)
    useProjectStore.setState({ lists: [] })

    ioState.handlers['list-created']({ _id: 'list-peer', projectId, title: 'Peer list', order: 0 })

    expect(useProjectStore.getState().lists.map((l) => l._id)).toEqual(['list-peer'])
  })
})
