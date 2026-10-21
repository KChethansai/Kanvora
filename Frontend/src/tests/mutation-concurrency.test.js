// Mutation concurrency: a card keeps a committed baseline (the last value the
// server confirmed). A failed mutation restores that baseline - never another
// unsaved optimistic patch - and only the operation that owns the latest
// mutation may clear the saving flag.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useProjectStore } from '../store/projectStore'

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

const LIST_ID = 'list-1'

const serverCard = (overrides = {}) => ({
  _id: 'card-1',
  listId: LIST_ID,
  title: 'Server title',
  description: 'Server description',
  order: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

// Load the board so the store holds the server-confirmed card and the slice
// records it as the committed baseline.
const seedBoard = async (cards) => {
  useProjectStore.setState({
    lists: [{ _id: LIST_ID, projectId: 'project-1', title: 'To Do', order: 0 }],
    cards: {}
  })
  axios.get.mockResolvedValue({ data: { payload: cards } })
  await useProjectStore.getState().fetchCards(LIST_ID)
}

const cardInStore = () => useProjectStore.getState().cards[LIST_ID][0]

beforeEach(() => {
  vi.resetAllMocks()
  // Ends the current board session, so every request in a test starts from a
  // clean, single-owner board.
  useProjectStore.getState().resetBoard()
})

describe('card mutation concurrency', () => {
  it('leaves the card at the last server-confirmed value when two overlapping updates both fail', async () => {
    const confirmed = serverCard()
    await seedBoard([confirmed])

    axios.put.mockRejectedValue(new Error('offline'))

    const first = useProjectStore.getState().updateCard('card-1', { title: 'First attempt' })
    const second = useProjectStore.getState().updateCard('card-1', { title: 'Second attempt' })
    await Promise.all([first, second])

    expect(useProjectStore.getState().cards[LIST_ID]).toEqual([confirmed])
  })

  it('does not revert an already-successful update of the same card when a later update fails', async () => {
    const confirmed = serverCard()
    await seedBoard([confirmed])

    axios.put.mockResolvedValueOnce({
      data: {
        payload: { ...confirmed, title: 'Renamed', updatedAt: '2026-02-01T00:00:00.000Z' }
      }
    })
    await useProjectStore.getState().updateCard('card-1', { title: 'Renamed' })

    axios.put.mockRejectedValueOnce(new Error('offline'))
    await useProjectStore.getState().updateCard('card-1', { description: 'Draft description' })

    expect(cardInStore().title).toBe('Renamed')
    expect(cardInStore().description).toBe('Server description')
  })

  it('does not revert another card\'s already-successful update when this card fails', async () => {
    const confirmed = serverCard()
    const other = { ...serverCard(), _id: 'card-2', title: 'Other server title', order: 1 }
    await seedBoard([confirmed, other])

    axios.put.mockResolvedValueOnce({ data: { payload: { ...other, title: 'Other saved' } } })
    await useProjectStore.getState().updateCard('card-2', { title: 'Other saved' })

    axios.put.mockRejectedValueOnce(new Error('offline'))
    await useProjectStore.getState().updateCard('card-1', { title: 'Failed edit' })

    const cards = useProjectStore.getState().cards[LIST_ID]
    expect(cards.find((card) => card._id === 'card-1').title).toBe('Server title')
    expect(cards.find((card) => card._id === 'card-2').title).toBe('Other saved')
  })

  it('keeps a confirmed overlapping success when the newest mutation fails', async () => {
    const confirmed = serverCard()
    await seedBoard([confirmed])

    let resolveStale
    let rejectLatest
    axios.put
      .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve }))
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectLatest = reject }))

    const stale = useProjectStore.getState().updateCard('card-1', { title: 'Confirmed rename' })
    const latest = useProjectStore.getState().updateCard('card-1', { title: 'Failed rename' })

    // The server accepted the first edit even though it is no longer the
    // newest request. Its confirmed value must survive the later failure.
    resolveStale({
      data: {
        payload: { ...confirmed, title: 'Confirmed rename', updatedAt: '2026-04-01T00:00:00.000Z' }
      }
    })
    await stale
    rejectLatest(new Error('offline'))
    await latest

    expect(cardInStore().title).toBe('Confirmed rename')
  })

  it('does not let a late attachment response overwrite a newer title', async () => {
    const confirmed = serverCard()
    await seedBoard([confirmed])

    let resolveAttachment
    axios.post.mockImplementation(
      () => new Promise((resolve) => { resolveAttachment = resolve })
    )
    axios.put.mockResolvedValue({
      data: {
        payload: { ...confirmed, title: 'New title', updatedAt: '2026-03-01T00:00:00.000Z' }
      }
    })

    const attachment = useProjectStore
      .getState()
      .uploadCardAttachment('card-1', new File(['payload'], 'note.txt'))
    await useProjectStore.getState().updateCard('card-1', { title: 'New title' })

    resolveAttachment({
      data: {
        payload: {
          ...confirmed,
          title: 'Stale title from the attachment response',
          // The API owns the card attachment collection (Backend/models/Taskmodel.js).
          attachment: [{ name: 'note.txt' }],
          attachments: [{ name: 'note.txt' }]
        }
      }
    })
    await attachment

    expect(cardInStore().title).toBe('New title')
    expect(cardInStore().attachment ?? cardInStore().attachments).toEqual([
      { name: 'note.txt' }
    ])
  })

  it('clears the saving flag with the operation that owns the latest mutation', async () => {
    const confirmed = serverCard()
    await seedBoard([confirmed])

    let resolveStale
    let resolveLatest
    axios.put
      .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLatest = resolve }))

    const stale = useProjectStore.getState().updateCard('card-1', { title: 'Stale' })
    const latest = useProjectStore.getState().updateCard('card-1', { title: 'Latest' })
    expect(useProjectStore.getState().cardSavingIds['card-1']).toBe(true)

    resolveStale({ data: { payload: { ...confirmed, title: 'Stale' } } })
    await stale
    // The stale operation no longer owns the card, so it must not release the
    // flag the latest operation still holds.
    expect(useProjectStore.getState().cardSavingIds['card-1']).toBe(true)

    resolveLatest({ data: { payload: { ...confirmed, title: 'Latest' } } })
    await latest
    expect(useProjectStore.getState().cardSavingIds['card-1']).toBe(false)
  })

  it('restores the server order when persisting a card order fails', async () => {
    const confirmed = serverCard()
    await seedBoard([confirmed])

    useProjectStore.setState({ cards: { [LIST_ID]: [{ ...confirmed, order: 7 }] } })

    axios.put.mockRejectedValueOnce(new Error('offline'))
    axios.get.mockResolvedValueOnce({ data: { payload: [confirmed] } })

    const persisted = await useProjectStore.getState().persistCardOrder(LIST_ID)

    expect(persisted).toBe(false)
    expect(useProjectStore.getState().cards[LIST_ID]).toEqual([confirmed])
  })
})
