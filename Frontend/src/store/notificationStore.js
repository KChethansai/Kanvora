import { getAccountEpoch, isAccountEpochCurrent } from '../utils/accountEpoch'
// notificationStore: Zustand store for all notification state and API calls.
import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { closeSocket, getSocket } from './projectStoreUtils'

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

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  socketBound: false,

  // ─── Socket ─────────────────────────────────────────────────────────────────

  bindUserRoom: (userId) => {
    const epoch = getAccountEpoch()
    if (!userId || get().socketBound) return

    const sock = getSocket()
    sock.emit('join-user', userId)

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
        return { notifications: next, unreadCount: next.filter((n) => !n.read).length }
      })
    })

    set({ socketBound: true })
  },

  unbindUserRoom: () => {
    closeSocket()
    set({ socketBound: false })
  },

  reset: () => {
    closeSocket()
    notificationFetchGeneration++
    localNotifications.clear()
    localOverrides.clear()
    previousResponseMark = 0
    set({ notifications: [], unreadCount: 0, loading: false, socketBound: false })
  },

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  fetchNotifications: async () => {
    const epoch = getAccountEpoch()
    const generation = ++notificationFetchGeneration
    // A monotonic marker, not a clock: two deliveries in the same millisecond
    // must still be ordered correctly.
    const deliveryMark = nextNotificationDelivery
    const overrideMark = nextLocalOverride
    set({ loading: true })
    try {
      const res = await axios.get(`${API_BASE_URL}/notifications`, {
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch)) return
      // A newer read owns the collection.
      if (generation !== notificationFetchGeneration) return
      const list = res.data.payload || []
      const known = new Set(list.map((n) => String(n._id)))
      // A notification delivered while this read was in flight is not in the
      // response. The read is authoritative about the notifications it saw,
      // but not about one that arrived after it began.
      const retained = [...localNotifications.values()]
        .filter((entry) => entry.mark > deliveryMark && !known.has(String(entry.notification._id)))
        .map((entry) => entry.notification)
      for (const id of known) localNotifications.delete(id)
      const merged = [...list, ...retained]
        // A deletion is authoritative until the session ends.
        .filter((notification) => !isDeleted(notification._id))
        // A read state or invite decision the user set after this read began
        // is newer than the response, so the response must not undo it.
        .map((notification) => applyOverrides(notification, overrideMark))
      set({
        notifications: merged,
        unreadCount: merged.filter((n) => !n.read).length,
        loading: false
      })
      pruneSupersededOverrides()
      previousResponseMark = overrideMark
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      set({ loading: false })
    }
  },

  // ─── Read ────────────────────────────────────────────────────────────────────

  markRead: async (id) => {
    const item = get().notifications.find((n) => n._id === id)
    // optimistic
    rememberOverride(id, { read: true }, item ? !item.read : undefined)
    set((s) => {
      const updated = s.notifications.map((n) =>
        n._id === id ? { ...n, read: true } : n
      )
      return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length }
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
      return { notifications: updated, unreadCount: 0, loading: false }
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
    // The notification is gone: a read that is still in flight must not
    // bring it back.
    rememberOverride(id, { deleted: true }, removed ? !removed.read : undefined)
    set((s) => {
      const updated = s.notifications.filter((n) => n._id !== id)
      return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length }
    })
    try {
      await axios.delete(`${API_BASE_URL}/notifications/${id}`, { withCredentials: true })
    } catch {
      // The server refused. An unprunable tombstone would hide the row for the
      // rest of the session, so it is rolled back with the optimistic removal.
      dropOverride(id)
      if (removed) {
        set((s) => {
          if (s.notifications.some((n) => n._id === id)) return {}
          const next = [...s.notifications]
          next.splice(Math.min(index, next.length), 0, removed)
          return { notifications: next, unreadCount: next.filter((n) => !n.read).length }
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
      unreadCount: s.notifications
        .map((n) => (n._id === id ? { ...n, read: true } : n))
        .filter((n) => !n.read).length
    }))
    return res.data
  },

  rejectInvite: async (id) => {
    const epoch = getAccountEpoch()
    const item = get().notifications.find((n) => n._id === id)
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
      unreadCount: s.notifications
        .map((n) => (n._id === id ? { ...n, read: true } : n))
        .filter((n) => !n.read).length
    }))
    return res.data
  }
}))
