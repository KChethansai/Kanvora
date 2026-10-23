// Notification pagination.
//
// The page is not the account. A client that owns the first page cannot derive
// how much it has not seen, so the server answers the account-wide totals and
// the client only decides which page to ask for next.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useNotificationStore, NOTIFICATION_PAGE_SIZE } from '../store/notificationStore'

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

const rows = (from, count, read = true) =>
  Array.from({ length: count }, (_, index) => ({
    _id: `n-${from + index}`,
    message: `m-${from + index}`,
    read,
    type: 'card',
    createdAt: new Date(2026, 0, 1, 0, 0, from + index).toISOString()
  }))

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const deliver = (notif) => ioState.handlers['new-notification'](notif)

beforeEach(() => {
  vi.resetAllMocks()
  ioState.handlers = {}
  ioState.emits = []
  useNotificationStore.getState().reset()
  useNotificationStore.getState().bindUserRoom('user-1')
})

describe('notification pagination', () => {
  it('asks for the first page with the server page size', async () => {
    axios.get.mockResolvedValue({ data: { payload: [], unreadCount: 0, total: 0 } })

    await useNotificationStore.getState().fetchNotifications()

    expect(axios.get).toHaveBeenCalledTimes(1)
    const [url, config] = axios.get.mock.calls[0]
    expect(url).toContain('/notifications')
    expect(config.params).toEqual({ page: 1, limit: NOTIFICATION_PAGE_SIZE })
  })

  it('appends the next page without duplicating a row', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { payload: rows(0, 50), unreadCount: 10, total: 60 } })
      .mockResolvedValueOnce({ data: { payload: rows(50, 10), unreadCount: 10, total: 60 } })

    await useNotificationStore.getState().fetchNotifications()
    await useNotificationStore.getState().loadMoreNotifications()

    expect(axios.get).toHaveBeenCalledTimes(2)
    const [, secondConfig] = axios.get.mock.calls[1]
    expect(secondConfig.params).toEqual({ page: 2, limit: NOTIFICATION_PAGE_SIZE })

    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(60)
    expect(new Set(state.notifications.map((n) => n._id)).size).toBe(60)
    expect(state.page).toBe(2)
    expect(state.hasMore).toBe(false)
  })

  it('reports the account unread count even when only one page is loaded', async () => {
    axios.get.mockResolvedValue({
      data: { payload: rows(0, 50, false), unreadCount: 40, total: 60 }
    })

    await useNotificationStore.getState().fetchNotifications()

    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(50)
    expect(state.unreadCount).toBe(40)
    expect(state.total).toBe(60)
  })

  it('does not ask for another page when everything is loaded', async () => {
    axios.get.mockResolvedValue({
      data: { payload: rows(0, 3), unreadCount: 3, total: 3 }
    })

    await useNotificationStore.getState().fetchNotifications()
    expect(useNotificationStore.getState().hasMore).toBe(false)

    await useNotificationStore.getState().loadMoreNotifications()
    expect(axios.get).toHaveBeenCalledTimes(1)
  })

  it('stops paginating when the server answers an empty page past the end', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { payload: rows(0, 50), unreadCount: 0, total: 51 } })
      .mockResolvedValueOnce({ data: { payload: [], unreadCount: 0, total: 51 } })

    await useNotificationStore.getState().fetchNotifications()
    expect(useNotificationStore.getState().hasMore).toBe(true)

    await useNotificationStore.getState().loadMoreNotifications()
    // A stale total must not leave the control permanently asking for rows the
    // server does not have.
    expect(useNotificationStore.getState().hasMore).toBe(false)
    expect(useNotificationStore.getState().notifications).toHaveLength(50)
  })

  it('discards an append that resolves after a first page was reloaded', async () => {
    const pageTwo = deferred()
    let call = 0
    axios.get.mockImplementation(() => {
      call += 1
      if (call === 1) return Promise.resolve({ data: { payload: rows(0, 50), unreadCount: 0, total: 80 } })
      if (call === 2) return pageTwo.promise
      return Promise.resolve({ data: { payload: rows(0, 50), unreadCount: 0, total: 80 } })
    })

    await useNotificationStore.getState().fetchNotifications()
    const appending = useNotificationStore.getState().loadMoreNotifications()
    // The panel is reopened before the append answers.
    await useNotificationStore.getState().fetchNotifications()

    pageTwo.resolve({ data: { payload: rows(50, 50), unreadCount: 0, total: 80 } })
    await appending

    const state = useNotificationStore.getState()
    expect(state.page).toBe(1)
    expect(state.notifications).toHaveLength(50)
    expect(state.notifications[0]._id).toBe('n-0')
  })

  it('keeps the loaded page and clears the spinner when a page request fails', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { payload: rows(0, 50), unreadCount: 0, total: 80 } })
      .mockRejectedValueOnce(new Error('network'))

    await useNotificationStore.getState().fetchNotifications()
    await useNotificationStore.getState().loadMoreNotifications()

    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(50)
    expect(state.loadingMore).toBe(false)
    expect(state.page).toBe(1)
  })

  it('survives a response without the new totals instead of producing NaN', async () => {
    axios.get.mockResolvedValue({
      data: { payload: [{ _id: 'a', message: 'm', read: false, type: 'card' }] }
    })

    await useNotificationStore.getState().fetchNotifications()

    const state = useNotificationStore.getState()
    expect(Number.isNaN(state.unreadCount)).toBe(false)
    expect(state.unreadCount).toBe(1)
    expect(state.total).toBe(1)
    expect(state.hasMore).toBe(false)
  })

  it('counts a live delivery once and raises the account totals', async () => {
    axios.get.mockResolvedValue({
      data: { payload: rows(0, 2), unreadCount: 0, total: 2 }
    })
    await useNotificationStore.getState().fetchNotifications()

    deliver({ _id: 'live-1', message: 'live', read: false, type: 'card' })

    const state = useNotificationStore.getState()
    expect(state.notifications.filter((n) => n._id === 'live-1')).toHaveLength(1)
    expect(state.total).toBe(3)
    expect(state.unreadCount).toBe(1)
  })

  it('lowers the count when a loaded unread notification is marked read', async () => {
    axios.put.mockResolvedValue({ data: { message: 'marked' } })
    axios.get.mockResolvedValue({
      data: { payload: rows(0, 2, false), unreadCount: 2, total: 2 }
    })
    await useNotificationStore.getState().fetchNotifications()

    await useNotificationStore.getState().markRead('n-0')

    expect(useNotificationStore.getState().unreadCount).toBe(1)
  })

  it('never reports a negative count after repeated local removals', async () => {
    axios.delete.mockResolvedValue({ data: { message: 'deleted' } })
    axios.get.mockResolvedValue({
      data: { payload: [{ _id: 'only', message: 'm', read: false, type: 'card' }], unreadCount: 0, total: 1 }
    })
    await useNotificationStore.getState().fetchNotifications()

    await useNotificationStore.getState().deleteNotif('only')

    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(0)
    expect(state.total).toBe(0)
  })
})
