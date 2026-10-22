// Notification read and local mutation reconciliation.
//
// A read that is already in flight must not undo a deletion or a read state
// the user set after the read began.
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
const deliver = (notif) => ioState.handlers['new-notification'](notif)

beforeEach(() => {
  vi.resetAllMocks()
  ioState.handlers = {}
  ioState.emits = []
  useNotificationStore.getState().reset()
  useNotificationStore.getState().bindUserRoom('user-1')
})

describe('notification read and local mutation reconciliation', () => {
  it('does not resurrect a notification the user deleted while a read was in flight', async () => {
    let resolveList
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
    axios.delete.mockResolvedValue({ data: { message: 'deleted' } })

    const pending = useNotificationStore.getState().fetchNotifications()
    deliver(notification('gone'))
    // The user deletes it before the read answers.
    await useNotificationStore.getState().deleteNotif('gone')

    // The read answers with the snapshot it took before the delivery.
    resolveList({ data: { payload: [] } })
    await pending

    const state = useNotificationStore.getState()
    expect(state.notifications.map((n) => n._id)).toEqual([])
    expect(state.unreadCount).toBe(0)
  })

  it('does not put a notification back into the unread count after it was read', async () => {
    let resolveList
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
    axios.put.mockResolvedValue({ data: { message: 'marked' } })

    const pending = useNotificationStore.getState().fetchNotifications()
    deliver(notification('seen'))
    await useNotificationStore.getState().markRead('seen')

    // The read answers with a snapshot that predates the read state.
    resolveList({ data: { payload: [notification('seen', false)] } })
    await pending

    const state = useNotificationStore.getState()
    expect(state.notifications.filter((n) => n._id === 'seen')).toHaveLength(1)
    expect(state.notifications[0].read).toBe(true)
    expect(state.unreadCount).toBe(0)
  })

  it('keeps the unread count right when every notification is marked read', async () => {
    let resolveList
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
    axios.put.mockResolvedValue({ data: { message: 'marked' } })

    const pending = useNotificationStore.getState().fetchNotifications()
    deliver(notification('a'))
    deliver(notification('b'))
    await useNotificationStore.getState().markAllRead()

    resolveList({ data: { payload: [notification('a', false), notification('b', false)] } })
    await pending

    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })
})
