import { getAccountEpoch, isAccountEpochCurrent } from '../utils/accountEpoch'
// notificationStore: Zustand store for all notification state and API calls.
import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { closeSocket, getSocket } from './projectStoreUtils'

// The server accepts up to 50 rows per page.
export const NOTIFICATION_PAGE_SIZE = 50

// A read is authoritative about the notifications it saw. A notification that
// was delivered while a read was in flight is not in that response, so it is
// remembered here and merged back when the read lands.
let notificationFetchGeneration = 0
let nextNotificationDelivery = 0
const localNotifications = new Map()
// A local change the server may not have seen yet: a read state, an invite
// decision, or a deletion. One map, because all three answer the same
// question: "is this response older than what the user already did?".
//
// `deleted` entries are never pruned while the session lasts. Absence from a
// page is not proof that the server deleted the row, so the only exact rule is
// to keep the tombstone until reset. Read and status entries are superseded by
// a later response and are dropped one response generation after that.
let nextLocalOverride = 0
const localOverrides = new Map()
let previousResponseMark = 0
// The user room lives on the connection, not on the store. A reconnect drops it
// and `socketBound` stays true, so the listener is kept here and removed before
// it is replaced.
let userRoomRejoin = null

const rememberNotification = (notification) => {
  if (!notification?._id) return
  localNotifications.set(String(notification._id), {
    notification,
    mark: ++nextNotificationDelivery
  })
}

const patchDeliveredSnapshot = (id, patch) => {
  const entry = localNotifications.get(id)
  if (!entry) return
  const next = { ...entry.notification }
  if (patch.read !== undefined) next.read = patch.read
  if (patch.status !== undefined) next.status = patch.status
  entry.notification = next
}

// `wasUnread` is captured from the loaded item at mutation time. It is what
// makes the unread count adjustment exact instead of a guess.
const rememberOverride = (id, patch, wasUnread) => {
  if (!id) return null
  const key = String(id)
  const existing = localOverrides.get(key) || {}
  const entry = { ...existing, ...patch, mark: ++nextLocalOverride }
  if (wasUnread !== undefined) entry.wasUnread = Boolean(wasUnread)
  localOverrides.set(key, entry)
  patchDeliveredSnapshot(key, patch)
  return entry
}

const dropOverride = (id) => {
  localOverrides.delete(String(id))
}

const isDeleted = (id) => Boolean(localOverrides.get(String(id))?.deleted)

// Only a change made after the response was requested may override it.
const applyOverrides = (notification, mark) => {
  const local = localOverrides.get(String(notification._id))
  if (!local || local.mark <= mark) return notification
  const next = { ...notification }
  if (local.read !== undefined) next.read = local.read
  if (local.status !== undefined) next.status = local.status
  return next
}

const pruneSupersededOverrides = () => {
  for (const [id, entry] of localOverrides) {
    if (entry.deleted) continue
    if (entry.mark <= previousResponseMark) localOverrides.delete(id)
  }
}

const dedupeById = (items) => {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const id = item?._id === undefined || item?._id === null ? '' : String(item._id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(item)
  }
  return out
}

// A local unread change made after the response was requested is not in the
// server count, so it is applied on top of it.
const unreadAdjustmentSince = (overrideMark) => {
  let delta = 0
  for (const entry of localOverrides.values()) {
    if (entry.mark <= overrideMark) continue
    if (!entry.wasUnread) continue
    if (entry.deleted || entry.read === true) delta -= 1
  }
  return delta
}

const clampUnread = (value, total) => Math.max(0, Math.min(Number.isFinite(total) ? total : value, value))

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  // The account-wide totals answered by the server. The page is not the
  // account, so a count derived from the loaded rows would be a lower bound
  // presented as a fact.
  total: 0,
  page: 0,
  hasMore: false,
  // A delete inside the loaded window shifts the server's offset pagination, so
  // `total - loaded` is no longer an exact count of what a next page returns.
  paginationApproximate: false,
  loading: false,
  loadingMore: false,
  socketBound: false,

  // ─── Socket ─────────────────────────────────────────────────────────────────

  bindUserRoom: (userId) => {
    const epoch = getAccountEpoch()
    if (!userId || get().socketBound) return

    const sock = getSocket()
    sock.emit('join-user', userId)

    // A websocket reconnect creates a new server-side connection and the user
    // room is gone with the old one. Without this the badge freezes at its last
    // value and no further delivery arrives for the rest of the session.
    if (userRoomRejoin) sock.off('connect', userRoomRejoin)
    userRoomRejoin = () => {
      if (!isAccountEpochCurrent(epoch)) return
      sock.emit('join-user', userId)
    }
    sock.on('connect', userRoomRejoin)

    sock.off('new-notification')
    sock.on('new-notification', (notif) => {
      if (!isAccountEpochCurrent(epoch)) return
      if (!notif?._id) return
      // A notification the user deleted must not come back through a live
      // frame either.
      if (isDeleted(notif._id)) return
      rememberNotification(notif)
      set((s) => {
        // The same notification can arrive live and be present in a read.
        if (s.notifications.some((n) => n._id === notif._id)) return {}
        const next = [applyOverrides(notif, 0), ...s.notifications]
        const total = s.total + 1
        return {
          notifications: next,
          total,
          unreadCount: clampUnread(s.unreadCount + (notif.read ? 0 : 1), total)
        }
      })
    })

    set({ socketBound: true })
  },

  unbindUserRoom: () => {
    closeSocket()
    userRoomRejoin = null
    set({ socketBound: false })
  },

  reset: () => {
    closeSocket()
    notificationFetchGeneration++
    localNotifications.clear()
    localOverrides.clear()
    previousResponseMark = 0
    userRoomRejoin = null
    set({
      notifications: [],
      unreadCount: 0,
      total: 0,
      page: 0,
      hasMore: false,
      paginationApproximate: false,
      loading: false,
      loadingMore: false,
      socketBound: false
    })
  },

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  fetchNotifications: async ({ page = 1 } = {}) => {
    const epoch = getAccountEpoch()
    const generation = ++notificationFetchGeneration
    // A monotonic marker, not a clock: two deliveries in the same millisecond
    // must still be ordered correctly.
    const deliveryMark = nextNotificationDelivery
    const overrideMark = nextLocalOverride
    const isAppend = page > 1
    // An append only makes sense directly after the page it extends.
    if (isAppend && get().page !== page - 1) return
    set(isAppend ? { loadingMore: true } : { loading: true })
    try {
      const res = await axios.get(`${API_BASE_URL}/notifications`, {
        params: { page, limit: NOTIFICATION_PAGE_SIZE },
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch)) return
      // A newer read owns the collection.
      if (generation !== notificationFetchGeneration) return
      // A page-1 reset landed while this append was in flight.
      if (isAppend && get().page !== page - 1) return
      const list = res.data.payload || []
      const known = new Set(list.map((n) => String(n._id)))
      // A notification delivered while this read was in flight is not in the
      // response. The read is authoritative about the notifications it saw,
      // but not about one that arrived after it began.
      const retained = [...localNotifications.values()]
        .filter((entry) => entry.mark > deliveryMark && !known.has(String(entry.notification._id)))
        .map((entry) => entry.notification)
      for (const id of known) localNotifications.delete(id)
      const fresh = [...list, ...retained]
        // A deletion is authoritative until the session ends.
        .filter((notification) => !isDeleted(notification._id))
        // A read state or invite decision the user set after this read began
        // is newer than the response, so the response must not undo it.
        .map((notification) => applyOverrides(notification, overrideMark))
      const next = dedupeById(isAppend ? [...get().notifications, ...fresh] : fresh)
      const fallbackUnread = next.filter((n) => !n.read).length
      // An older server, or a proxy that strips unknown properties, must never
      // turn the count into NaN. Fall back to the loaded rows.
      const unreadTotal = Number.isFinite(res.data?.unreadCount) ? res.data.unreadCount : fallbackUnread
      const total = Number.isFinite(res.data?.total) ? res.data.total : next.length
      const liveUnread = retained.filter((n) => !n.read).length
      const unreadCount = clampUnread(
        unreadTotal + liveUnread + unreadAdjustmentSince(overrideMark),
        total
      )
      const hasMore = isAppend && list.length === 0 ? false : next.length < total
      set({
        notifications: next,
        unreadCount,
        total,
        page,
        hasMore,
        // A fresh first page re-aligns the window with the server.
        paginationApproximate: isAppend ? get().paginationApproximate : false,
        loading: false,
        loadingMore: false
      })
      // A delivery stamped at or before this request's mark can never satisfy
      // `mark > deliveryMark` for any later read, so it is unreachable now.
      for (const [id, entry] of localNotifications) {
        if (entry.mark <= deliveryMark) localNotifications.delete(id)
      }
      pruneSupersededOverrides()
      previousResponseMark = overrideMark
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      if (generation !== notificationFetchGeneration) return
      set({ loading: false, loadingMore: false })
    }
  },

  loadMoreNotifications: async () => {
    const { hasMore, loading, loadingMore, page } = get()
    if (!hasMore || loading || loadingMore) return
    await get().fetchNotifications({ page: page + 1 })
  },

  // ─── Read ────────────────────────────────────────────────────────────────────

  markRead: async (id) => {
    const item = get().notifications.find((n) => n._id === id)
    const wasUnread = item ? !item.read : false
    // optimistic
    rememberOverride(id, { read: true }, item ? !item.read : undefined)
    set((s) => {
      const updated = s.notifications.map((n) =>
        n._id === id ? { ...n, read: true } : n
      )
      return {
        notifications: updated,
        unreadCount: clampUnread(s.unreadCount - (wasUnread ? 1 : 0), s.total)
      }
    })
    try {
      await axios.put(`${API_BASE_URL}/notifications/${id}/read`, {}, { withCredentials: true })
    } catch { /* silent */ }
  },

  markAllRead: async () => {
    // The server marks the whole account read. Any read already in flight was
    // requested before that happened, so it must not be allowed to land and
    // report unread rows afterwards.
    notificationFetchGeneration++
    set((s) => {
      for (const notification of s.notifications) {
        rememberOverride(notification._id, { read: true }, !notification.read)
      }
      const updated = s.notifications.map((n) => ({ ...n, read: true }))
      // The server marked the whole account read. An append already in flight
      // was requested before that and is discarded by the generation bump, so
      // neither flag may be left behind.
      return { notifications: updated, unreadCount: 0, loading: false, loadingMore: false }
    })
    try {
      await axios.put(`${API_BASE_URL}/notifications/read-all`, {}, { withCredentials: true })
    } catch { /* silent */ }
  },

  // ─── Delete ──────────────────────────────────────────────────────────────────

  deleteNotif: async (id) => {
    const before = get().notifications
    const index = before.findIndex((n) => n._id === id)
    const removed = index >= 0 ? before[index] : null
    const wasUnread = Boolean(removed && !removed.read)
    // The notification is gone: a read that is still in flight must not
    // bring it back.
    rememberOverride(id, { deleted: true }, removed ? !removed.read : undefined)
    set((s) => {
      const updated = s.notifications.filter((n) => n._id !== id)
      const total = removed ? Math.max(0, s.total - 1) : s.total
      return {
        notifications: updated,
        total,
        unreadCount: clampUnread(s.unreadCount - (wasUnread ? 1 : 0), total)
      }
    })
    try {
      await axios.delete(`${API_BASE_URL}/notifications/${id}`, { withCredentials: true })
      // Rows after this one move up by one on the server, so the next page
      // skips the row that took this one's place.
      if (get().hasMore) set({ paginationApproximate: true })
    } catch {
      // The server refused. An unprunable tombstone would hide the row for the
      // rest of the session, so it is rolled back with the optimistic removal.
      dropOverride(id)
      if (removed) {
        set((s) => {
          if (s.notifications.some((n) => n._id === id)) return {}
          const next = [...s.notifications]
          next.splice(Math.min(index, next.length), 0, removed)
          const total = s.total + 1
          return {
            notifications: next,
            total,
            unreadCount: clampUnread(s.unreadCount + (wasUnread ? 1 : 0), total)
          }
        })
      }
    }
  },

  // ─── Invite ──────────────────────────────────────────────────────────────────

  sendInvite: async ({ projectId, recipientEmail }) => {
    const epoch = getAccountEpoch()
    const res = await axios.post(
      `${API_BASE_URL}/notifications/invite`,
      { projectId, recipientEmail },
      { withCredentials: true }
    )
    if (!isAccountEpochCurrent(epoch)) return
    return res.data
  },

  acceptInvite: async (id) => {
    const epoch = getAccountEpoch()
    const item = get().notifications.find((n) => n._id === id)
    const wasUnread = item ? !item.read : false
    const res = await axios.post(
      `${API_BASE_URL}/notifications/${id}/accept`,
      {},
      { withCredentials: true }
    )
    if (!isAccountEpochCurrent(epoch)) return
    rememberOverride(id, { status: 'accepted', read: true }, item ? !item.read : undefined)
    // update local state
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n._id === id ? { ...n, status: 'accepted', read: true } : n
      ),
      unreadCount: clampUnread(s.unreadCount - (wasUnread ? 1 : 0), s.total)
    }))
    return res.data
  },

  rejectInvite: async (id) => {
    const epoch = getAccountEpoch()
    const item = get().notifications.find((n) => n._id === id)
    const wasUnread = item ? !item.read : false
    const res = await axios.post(
      `${API_BASE_URL}/notifications/${id}/reject`,
      {},
      { withCredentials: true }
    )
    if (!isAccountEpochCurrent(epoch)) return
    rememberOverride(id, { status: 'rejected', read: true }, item ? !item.read : undefined)
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n._id === id ? { ...n, status: 'rejected', read: true } : n
      ),
      unreadCount: clampUnread(s.unreadCount - (wasUnread ? 1 : 0), s.total)
    }))
    return res.data
  }
}))
