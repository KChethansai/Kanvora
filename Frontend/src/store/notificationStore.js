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

const rememberNotification = (notification) => {
  if (!notification?._id) return
  localNotifications.set(String(notification._id), {
    notification,
    mark: ++nextNotificationDelivery
  })
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
      rememberNotification(notif)
      set((s) => {
        // The same notification can arrive live and be present in a read.
        if (s.notifications.some((n) => n._id === notif._id)) return {}
        const next = [notif, ...s.notifications]
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
    set({ notifications: [], unreadCount: 0, loading: false, socketBound: false })
  },

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  fetchNotifications: async () => {
    const epoch = getAccountEpoch()
    const generation = ++notificationFetchGeneration
    // A monotonic marker, not a clock: two deliveries in the same millisecond
    // must still be ordered correctly.
    const deliveryMark = nextNotificationDelivery
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
      set({
        notifications: merged,
        unreadCount: merged.filter((n) => !n.read).length,
        loading: false
      })
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      set({ loading: false })
    }
  },

  // ─── Read ────────────────────────────────────────────────────────────────────

  markRead: async (id) => {
    // optimistic
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
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0
    }))
    try {
      await axios.put(`${API_BASE_URL}/notifications/read-all`, {}, { withCredentials: true })
    } catch { /* silent */ }
  },

  // ─── Delete ──────────────────────────────────────────────────────────────────

  deleteNotif: async (id) => {
    set((s) => {
      const updated = s.notifications.filter((n) => n._id !== id)
      return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length }
    })
    try {
      await axios.delete(`${API_BASE_URL}/notifications/${id}`, { withCredentials: true })
    } catch { /* silent */ }
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
    const res = await axios.post(
      `${API_BASE_URL}/notifications/${id}/accept`,
      {},
      { withCredentials: true }
    )
    if (!isAccountEpochCurrent(epoch)) return
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
    const res = await axios.post(
      `${API_BASE_URL}/notifications/${id}/reject`,
      {},
      { withCredentials: true }
    )
    if (!isAccountEpochCurrent(epoch)) return
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
