// Failure visibility.
//
// A read that fails must not look like an empty board. The failure is
// classified, so the interface can say what happened instead of showing a
// generic failure for every cause.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useProjectStore } from '../store/projectStore'
import { requestErrorKind, requestErrorMessage } from '../utils/requestError'
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

const listId = 'list-1'
const failure = (status) => Object.assign(new Error('failed'), {
  response: { status, data: { message: 'server said no' } }
})

beforeEach(() => {
  vi.resetAllMocks()
  useProjectStore.getState().resetBoard()
  beginBoardSession('project-1', { _id: 'user-1' })
})

describe('request error classification', () => {
  it('classifies the failure causes the interface must tell apart', () => {
    expect(requestErrorKind(failure(401))).toBe('unauthenticated')
    expect(requestErrorKind(failure(403))).toBe('forbidden')
    expect(requestErrorKind(failure(404))).toBe('notFound')
    expect(requestErrorKind(failure(409))).toBe('conflict')
    expect(requestErrorKind(failure(429))).toBe('rateLimited')
    expect(requestErrorKind(failure(503))).toBe('server')
    expect(requestErrorKind(new Error('offline'))).toBe('network')
  })

  it('gives every classified failure its own message', () => {
    const kinds = ['unauthenticated', 'forbidden', 'notFound', 'conflict', 'rateLimited', 'server', 'network']
    const messages = kinds.map((kind) => requestErrorMessage(kind))
    expect(new Set(messages).size).toBe(kinds.length)
    expect(requestErrorMessage('unauthenticated')).toMatch(/session|sign in/i)
  })
})

describe('card read failure visibility', () => {
  it('records a failed card read instead of showing an empty board', async () => {
    axios.get.mockRejectedValue(failure(503))

    await useProjectStore.getState().fetchCards(listId)

    const errors = useProjectStore.getState().cardReadErrors
    expect(errors[listId]).toBe('server')
  })

  it('clears the failure when the read succeeds', async () => {
    axios.get.mockRejectedValueOnce(failure(503))
    await useProjectStore.getState().fetchCards(listId)
    expect(useProjectStore.getState().cardReadErrors[listId]).toBe('server')

    axios.get.mockResolvedValueOnce({ data: { payload: [], hasMore: false } })
    await useProjectStore.getState().fetchCards(listId)

    expect(useProjectStore.getState().cardReadErrors[listId]).toBeUndefined()
  })

  it('does not report a failure when the read was superseded', async () => {
    axios.get.mockRejectedValue(failure(503))
    const pending = useProjectStore.getState().fetchCards(listId)
    useProjectStore.getState().resetCardFetches()
    await pending

    expect(useProjectStore.getState().cardReadErrors[listId]).toBeUndefined()
  })
})

describe('card write failure visibility', () => {
  it('records why a card write failed', async () => {
    axios.put.mockRejectedValue(failure(429))
    useProjectStore.setState({ cards: { [listId]: [{ _id: 'card-1', title: 'Card' }] } })

    const updated = await useProjectStore.getState().updateCard('card-1', { title: 'New' })

    expect(updated).toBeNull()
    expect(useProjectStore.getState().cardWriteError).toBe('rateLimited')
  })

  it('clears the recorded cause after a successful write', async () => {
    axios.put.mockResolvedValue({ data: { payload: { _id: 'card-1', title: 'New' } } })
    useProjectStore.setState({ cards: { [listId]: [{ _id: 'card-1', title: 'Card' }] } })

    await useProjectStore.getState().updateCard('card-1', { title: 'New' })

    expect(useProjectStore.getState().cardWriteError).toBeNull()
  })
})
