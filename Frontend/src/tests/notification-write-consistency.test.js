// Notification write consistency.
//
// A mark-read or mark-all-read that the server refuses must not leave the
// client claiming the account is read. The write is optimistic, so the failure
// path has to reconcile with server truth (a timeout may hide a commit) and, if
// that is impossible, restore exactly what the user had before the action.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useNotificationStore } from '../store/notificationStore'
import { invalidateAccountEpoch } from '../utils/accountEpoch'

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

const notification = (id, read = false, extra = {}) => ({
  _id: id, message: `n-${id}`, read, type: 'card', ...extra
})
const deliver = (notif) => ioState.handlers['new-notification'](notif)
const seed = (items, unreadCount, total = items.length) => {
  useNotificationStore.setState({
    notifications: items,
    unreadCount,
    total,
    page: 1,
    hasMore: false,
    loading: false,
    loadingMore: false,
    writeError: null
  })
}
const state = () => useNotificationStore.getState()
const readOf = (id) => state().notifications.find((n) => n._id === id)?.read

const listResponse = (payload, unreadCount) => ({
  data: { payload, unreadCount, total: payload.length }
})

beforeEach(() => {
  vi.resetAllMocks()
  ioState.handlers = {}
  ioState.emits = []
  useNotificationStore.getState().reset()
  useNotificationStore.getState().bindUserRoom('user-1')
})

describe('mark-read failure reconciliation', () => {
  it('restores the row and the badge when the server rejects the write', async () => {
    seed([notification('a', false), notification('b', true)], 1)
    axios.put.mockRejectedValue({ response: { status: 500 } })
    axios.get.mockResolvedValue(listResponse([notification('a', false), notification('b', true)], 1))

    await state().markRead('a')

    // The authoritative read still reports 'a' unread, so the client must too.
    expect(readOf('a')).toBe(false)
    expect(state().unreadCount).toBe(1)
    expect(state().writeError).toMatch(/could not mark/i)
    expect(axios.get).toHaveBeenCalled()
  })

  it('treats a refused session write as a failed mutation, not a silent success', async () => {
    seed([notification('a', false)], 1)
    axios.put.mockRejectedValue({ response: { status: 401 } })
    axios.get.mockRejectedValue(new Error('offline'))

    await state().markRead('a')

    expect(readOf('a')).toBe(false)
    expect(state().unreadCount).toBe(1)
    expect(state().writeError).toBeTruthy()
  })

  it('keeps the optimistic read when a timeout hid a committed write', async () => {
    seed([notification('a', false)], 1)
    axios.put.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }))
    // The server committed before the response was lost.
    axios.get.mockResolvedValue(listResponse([notification('a', true)], 0))

    await state().markRead('a')

    expect(readOf('a')).toBe(true)
    expect(state().unreadCount).toBe(0)
    expect(state().writeError).toMatch(/could not mark/i)
  })
})

describe('mark-all-read failure reconciliation', () => {
  it('never leaves the badge at zero after a rejected mark-all', async () => {
    seed([notification('a', false), notification('b', false), notification('c', true)], 2)
    axios.put.mockRejectedValue({ response: { status: 500 } })
    axios.get.mockRejectedValue(new Error('offline'))

    await state().markAllRead()

    expect(state().unreadCount).toBe(2)
    expect(state().notifications.map((n) => n.read)).toEqual([false, false, true])
    expect(state().writeError).toMatch(/could not mark everything/i)
  })

  it('does not mark a notification that arrived during the failed action', async () => {
    seed([notification('a', false)], 1)
    let rejectWrite
    axios.put.mockImplementation(() => new Promise((resolve, reject) => { rejectWrite = reject }))
    axios.get.mockRejectedValue(new Error('offline'))

    const pending = state().markAllRead()
    deliver(notification('late', false))
    rejectWrite({ response: { status: 500 } })
    await pending

    expect(readOf('late')).toBe(false)
    expect(state().unreadCount).toBe(2)
  })

  it('reconciles against a server that did commit before the timeout', async () => {
    seed([notification('a', false), notification('b', true)], 1)
    axios.put.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }))
    axios.get.mockResolvedValue(listResponse([notification('a', true), notification('b', true)], 0))

    await state().markAllRead()

    expect(state().notifications.every((n) => n.read)).toBe(true)
    expect(state().unreadCount).toBe(0)
  })
})

describe('concurrent mutation safety', () => {
  it('a later successful read wins over an earlier failed one', async () => {
    seed([notification('a', false)], 1)
    let rejectFirst
    axios.put
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectFirst = reject }))
      .mockResolvedValueOnce({ data: {} })
    axios.get.mockRejectedValue(new Error('offline'))

    const first = state().markRead('a')
    await state().markRead('a')
    rejectFirst({ response: { status: 500 } })
    await first

    expect(readOf('a')).toBe(true)
    expect(state().unreadCount).toBe(0)
  })

  it('a deletion made during a failed read keeps the row deleted', async () => {
    seed([notification('a', false), notification('b', false)], 2)
    let rejectWrite
    axios.put.mockImplementation(() => new Promise((resolve, reject) => { rejectWrite = reject }))
    axios.delete.mockResolvedValue({ data: {} })
    // The server really deleted 'a'; the reconciliation read reports that.
    axios.get.mockResolvedValue(listResponse([notification('b', false)], 1))

    const pending = state().markRead('a')
    await state().deleteNotif('a')
    rejectWrite({ response: { status: 500 } })
    await pending

    expect(state().notifications.some((n) => n._id === 'a')).toBe(false)
    expect(state().unreadCount).toBe(1)
  })

  it('does not restore state after the account changed', async () => {
    seed([notification('a', false)], 1)
    let rejectWrite
    axios.put.mockImplementation(() => new Promise((resolve, reject) => { rejectWrite = reject }))
    const pending = state().markRead('a')
    // Sign-out/account switch invalidates the epoch and clears the store.
    invalidateAccountEpoch()
    useNotificationStore.getState().reset()
    rejectWrite({ response: { status: 500 } })
    await pending

    expect(state().notifications).toEqual([])
    expect(state().unreadCount).toBe(0)
    expect(state().writeError).toBe(null)
  })

  it('reports a failed delete instead of silently restoring the row', async () => {
    seed([notification('d', false)], 1)
    axios.delete.mockRejectedValue({ response: { status: 500 } })
    await state().deleteNotif('d')
    expect(state().notifications.map((n) => n._id)).toEqual(['d'])
    expect(state().unreadCount).toBe(1)
    // A silent pop-out-and-back reads as a missed click, so the failure is
    // reported the way a failed read is.
    expect(state().writeError).toMatch(/could not delete/i)
  })

  it('never restores a deleted row into a different account', async () => {
    seed([notification('d', false)], 1)
    let rejectWrite
    axios.delete.mockImplementation(() => new Promise((resolve, reject) => { rejectWrite = reject }))
    const pending = state().deleteNotif('d')
    invalidateAccountEpoch()
    state().reset()
    state().setAccount?.('user-2')
    rejectWrite({ response: { status: 500 } })
    await pending
    expect(state().notifications).toEqual([])
    expect(state().writeError).toBe(null)
  })
})
