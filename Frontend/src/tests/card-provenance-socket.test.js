// The card provenance must work on the real socket path.
//
// The store test drives the creation mark directly; this test delivers the
// same events the application receives, so a change that removes the socket
// wiring fails here.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useProjectStore } from '../store/projectStore'
import { beginBoardSession, closeSocket } from '../store/projectStoreUtils'

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
const listId = 'list-1'

beforeEach(() => {
  vi.resetAllMocks()
  closeSocket()
  ioState.handlers = {}
  ioState.emits = []
  useProjectStore.getState().resetBoard()
  beginBoardSession(projectId, user)
  useProjectStore.getState().joinProject(projectId, user)
  // The board's lists are known, so a card event for one of them applies.
  useProjectStore.setState({ lists: [{ _id: listId, projectId, title: 'To do' }] })
})

describe('card provenance on the socket path', () => {
  it('keeps a card that a peer created while the card read was in flight', async () => {
    let resolveCards
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveCards = resolve }))

    const pending = useProjectStore.getState().fetchCards(listId)

    // The peer creates a card and the event arrives over the socket.
    ioState.handlers['card-created']({
      _id: 'card-peer', listId, projectId, title: 'Peer card', order: 0
    })
    expect(useProjectStore.getState().cards[listId]).toHaveLength(1)

    // The read answers with the snapshot it took before the creation.
    resolveCards({ data: { payload: [], hasMore: false } })
    await pending

    expect(useProjectStore.getState().cards[listId].map((c) => c._id)).toEqual(['card-peer'])
  })

  it('does not resurrect a card that a peer deleted', async () => {
    let resolveCards
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveCards = resolve }))

    const pending = useProjectStore.getState().fetchCards(listId)
    ioState.handlers['card-created']({
      _id: 'card-peer', listId, projectId, title: 'Peer card', order: 0
    })
    ioState.handlers['card-deleted']({ cardId: 'card-peer', listId })

    resolveCards({ data: { payload: [], hasMore: false } })
    await pending

    expect(useProjectStore.getState().cards[listId]).toEqual([])
  })

  it('keeps a card that a peer moved into this list while the card read was in flight', async () => {
    let resolveCards
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveCards = resolve }))

    const pending = useProjectStore.getState().fetchCards(listId)

    // The card lives in another list and a peer moves it here.
    useProjectStore.setState({
      cards: { 'list-0': [{ _id: 'card-moved', listId: 'list-0', title: 'Moved card' }] }
    })
    ioState.handlers['card-updated']({
      _id: 'card-moved', listId, projectId, title: 'Moved card', order: 0
    })

    resolveCards({ data: { payload: [], hasMore: false } })
    await pending

    const cards = useProjectStore.getState().cards
    expect(cards[listId]?.map((c) => c._id) || []).toEqual(['card-moved'])
  })
})
