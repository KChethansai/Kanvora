// Notification read reconciliation.
//
// A notification read is authoritative about which notifications exist. It is
// not authoritative about a notification that was delivered while the read was
// in flight: the response predates the delivery, so replacing the collection
// with it would silently drop a notification the user has already received.
//
// The unread count is always recomputed from the resulting collection, never
// incremented, so a live delivery and a read can never disagree about it.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useNotificationStore } from '../store/notificationStore'

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

const notification = (id, read = false) => ({ _id: id, message: `n-${id}`, read, type: 'invite' })

// The real delivery path: the socket handler the application registers.
const deliver = (notif) => ioState.handlers['new-notification'](notif)

beforeEach(() => {
  vi.resetAllMocks()
  ioState.handlers = {}
  ioState.emits = []
  useNotificationStore.getState().reset()
  useNotificationStore.getState().bindUserRoom('user-1')
})

describe('notification read reconciliation', () => {
  it('keeps a notification that was delivered while the read was in flight', async () => {
    let resolveList
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))

    const pending = useNotificationStore.getState().fetchNotifications()

    // The live delivery arrives while the read is still running.
    deliver(notification('live'))

    // The read answers with the snapshot it took before the delivery.
    resolveList({ data: { payload: [] } })
    await pending

    const state = useNotificationStore.getState()
    expect(state.notifications.map((n) => n._id)).toEqual(['live'])
    expect(state.unreadCount).toBe(1)
  })

  it('recomputes the unread count instead of counting a delivery twice', async () => {
    axios.get.mockResolvedValue({ data: { payload: [notification('a'), notification('b', true)] } })

    await useNotificationStore.getState().fetchNotifications()

    expect(useNotificationStore.getState().unreadCount).toBe(1)
  })

  it('does not duplicate a notification that the read and the delivery both report', async () => {
    axios.get.mockResolvedValue({ data: { payload: [notification('a')] } })

    await useNotificationStore.getState().fetchNotifications()
    deliver(notification('a'))

    const state = useNotificationStore.getState()
    const ids = state.notifications.map((n) => n._id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(state.unreadCount).toBe(1)
  })

  it('ignores a read that was started before a newer one', async () => {
    let resolveFirst
    axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    axios.get.mockResolvedValueOnce({ data: { payload: [notification('new')] } })

    const first = useNotificationStore.getState().fetchNotifications()
    await useNotificationStore.getState().fetchNotifications()

    // The older read answers last and must not win.
    resolveFirst({ data: { payload: [notification('old')] } })
    await first

    expect(useNotificationStore.getState().notifications.map((n) => n._id)).toEqual(['new'])
  })
})
