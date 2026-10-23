// Notification read and local mutation reconciliation.
//
// A read that is already in flight must not undo a deletion, an invite
// decision, or a read state the user set after the read began.
//
// The deletion case is the one that regressed in V4: the test answered with an
// EMPTY payload, so it only ever asserted the case that already worked. A real
// in-flight read answers with the snapshot it took before the delete, which
// still contains the notification.
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

const notification = (id, read = false, extra = {}) => ({
  _id: id, message: `n-${id}`, read, type: 'invite', status: 'pending', ...extra
})
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

    // The read answers with the snapshot it took before the DELETE reached the
    // server, so the notification is still in it.
    resolveList({ data: { payload: [notification('gone')] } })
    await pending

    const state = useNotificationStore.getState()
    expect(state.notifications.map((n) => n._id)).toEqual([])
    expect(state.unreadCount).toBe(0)
  })

  it('restores a notification when the server refuses the delete', async () => {
    let resolveList
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
    axios.delete.mockRejectedValue(new Error('503'))

    const pending = useNotificationStore.getState().fetchNotifications()
    deliver(notification('kept'))
    await useNotificationStore.getState().deleteNotif('kept')

    // The optimistic removal was rolled back: an unprunable tombstone would
    // otherwise hide the row for the rest of the session.
    expect(useNotificationStore.getState().notifications.map((n) => n._id)).toEqual(['kept'])
    expect(useNotificationStore.getState().unreadCount).toBe(1)

    // And a later read is allowed to show it again.
    resolveList({ data: { payload: [notification('kept')] } })
    await pending
    expect(useNotificationStore.getState().notifications.map((n) => n._id)).toEqual(['kept'])
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

  it('does not revert an accepted invite to pending', async () => {
    let resolveList
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
    axios.post.mockResolvedValue({ data: { message: 'Invite accepted', payload: {} } })

    const pending = useNotificationStore.getState().fetchNotifications()
    deliver(notification('inv'))
    await useNotificationStore.getState().acceptInvite('inv')

    // The read answers with the snapshot it took before the acceptance.
    resolveList({ data: { payload: [notification('inv', false)] } })
    await pending

    const after = useNotificationStore.getState().notifications.find((n) => n._id === 'inv')
    expect(after?.status).toBe('accepted')
    expect(after?.read).toBe(true)
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('does not revert a rejected invite to pending', async () => {
    let resolveList
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
    axios.post.mockResolvedValue({ data: { message: 'Invite rejected', payload: {} } })

    const pending = useNotificationStore.getState().fetchNotifications()
    deliver(notification('inv2'))
    await useNotificationStore.getState().rejectInvite('inv2')

    resolveList({ data: { payload: [notification('inv2', false)] } })
    await pending

    const after = useNotificationStore.getState().notifications.find((n) => n._id === 'inv2')
    expect(after?.status).toBe('rejected')
    expect(after?.read).toBe(true)
  })

  it('discards a read that was in flight when every notification was marked read', async () => {
    let resolveList
    axios.get.mockImplementation(() => new Promise((resolve) => { resolveList = resolve }))
    axios.put.mockResolvedValue({ data: { message: 'marked' } })

    const pending = useNotificationStore.getState().fetchNotifications()
    deliver(notification('a'))
    deliver(notification('b'))
    await useNotificationStore.getState().markAllRead()

    // The snapshot predates the read-all, so it must not be applied at all.
    resolveList({ data: { payload: [notification('a', false), notification('b', false)] } })
    await pending

    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(0)
    expect(state.notifications.every((n) => n.read)).toBe(true)
    expect(state.loading).toBe(false)
  })

  it('clears deletion tombstones on reset so a later session can see the row', async () => {
    axios.delete.mockResolvedValue({ data: { message: 'deleted' } })
    deliver(notification('session-one'))
    await useNotificationStore.getState().deleteNotif('session-one')
    expect(useNotificationStore.getState().notifications).toEqual([])

    // A different account, or the same one after a logout.
    useNotificationStore.getState().reset()
    useNotificationStore.getState().bindUserRoom('user-2')
    deliver(notification('session-one'))
    expect(useNotificationStore.getState().notifications.map((n) => n._id)).toEqual(['session-one'])
  })
})
