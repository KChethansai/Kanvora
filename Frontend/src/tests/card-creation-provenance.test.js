// Creation provenance for the card collection.
//
// A card read is authoritative about which cards exist. It is NOT
// authoritative about a card that was created while the read was in flight:
// the response predates the creation, so replacing the collection with it
// would delete a card that the server holds and that the user has already
// seen.
//
// This mirrors the protection the list collection already has
// (markListCreation / localListCreations).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useProjectStore } from '../store/projectStore'
import { clearCardCreation, markCardCreation } from '../store/projectSlices/cardSlice'
import { beginBoardSession } from '../store/projectStoreUtils'

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(), off: vi.fn(), emit: vi.fn(),
    removeAllListeners: vi.fn(), disconnect: vi.fn()
  })
}))

const user = { _id: 'user-1' }
const listId = 'list-1'

beforeEach(() => {
  vi.resetAllMocks()
  useProjectStore.getState().resetBoard()
  beginBoardSession('project-1', user)
})

describe('card creation provenance', () => {
  it('keeps a card that was created while the card read was in flight', async () => {
    let resolveCards
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveCards = resolve }))

    const pending = useProjectStore.getState().fetchCards(listId)

    // A peer creates a card. The client learns about it while the read runs.
    const peerCard = { _id: 'card-peer', listId, title: 'Peer card' }
    markCardCreation(peerCard)
    useProjectStore.setState({
      cards: { [listId]: [peerCard] }
    })

    // The server answers with the snapshot it took before the creation.
    resolveCards({ data: { payload: [], hasMore: false } })
    await pending

    expect(useProjectStore.getState().cards[listId].map((c) => c._id)).toEqual(['card-peer'])
  })

  it('does not keep a card that was deleted while the read was in flight', async () => {
    let resolveCards
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveCards = resolve }))

    const pending = useProjectStore.getState().fetchCards(listId)

    const peerCard = { _id: 'card-peer', listId, title: 'Peer card' }
    markCardCreation(peerCard)
    useProjectStore.setState({ cards: { [listId]: [peerCard] } })

    // The card is deleted before the read answers. The deletion clears the
    // creation mark, so the read must not bring the card back.
    clearCardCreation('card-peer')
    useProjectStore.setState({ cards: { [listId]: [] } })

    resolveCards({ data: { payload: [], hasMore: false } })
    await pending

    expect(useProjectStore.getState().cards[listId]).toEqual([])
  })

  it('replaces a card that the server still has with the server version', async () => {
    axios.get.mockResolvedValue({
      data: { payload: [{ _id: 'card-1', listId, title: 'Server title' }], hasMore: false }
    })

    await useProjectStore.getState().fetchCards(listId)

    expect(useProjectStore.getState().cards[listId].map((c) => c.title)).toEqual(['Server title'])
  })

  // Session-reset invariants.
  //
  // resetCardFetches() empties the provenance collections but deliberately does
  // NOT rewind the monotonic counters that stamp them. Rewinding a counter
  // would let a read or mutation from the previous session collide with one
  // from the new session and pass its ownership check, which is how a stale
  // response gets applied to a fresh board. These two tests fail if a future
  // cleanup "tidies up" the counters along with the maps.
  it('discards a card read that started before the board session was reset', async () => {
    let resolveStale
    axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve }))
    const stale = useProjectStore.getState().fetchCards(listId)

    // The board session ends before the old read answers.
    useProjectStore.getState().resetCardFetches()

    axios.get.mockResolvedValueOnce({
      data: { payload: [{ _id: 'fresh', listId, title: 'Fresh' }], hasMore: false }
    })
    await useProjectStore.getState().fetchCards(listId)

    // The old read answers with the previous session's payload.
    resolveStale({ data: { payload: [{ _id: 'stale', listId, title: 'Stale' }], hasMore: false } })
    await stale

    expect(useProjectStore.getState().cards[listId].map((c) => c._id)).toEqual(['fresh'])
  })

  it('does not retain a creation that predates the board session reset', async () => {
    const oldCard = { _id: 'card-old', listId, title: 'Old session' }
    markCardCreation(oldCard)
    useProjectStore.setState({ cards: { [listId]: [oldCard] } })

    useProjectStore.getState().resetCardFetches()

    let resolveCards
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveCards = resolve }))
    const pending = useProjectStore.getState().fetchCards(listId)
    // The authoritative response does not contain the previous session's card.
    resolveCards({ data: { payload: [], hasMore: false } })
    await pending

    expect(useProjectStore.getState().cards[listId]).toEqual([])
  })
})
