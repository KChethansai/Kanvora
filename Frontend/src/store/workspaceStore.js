// workspaceStore store: centralizes client state and API calls for this domain.
import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'

// Workspace store keeps workspace membership and active workspace state synchronized.
export const useWorkspaceStore = create((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  members: [],
  loading: false,
  error: null,
  analytics: null,
  permissions: null,
  cache: {},

  // Workspaces

  //fetch all workspaces for the logged-in user
  fetchWorkspaces: async () => {
    const cached = get().cache.workspaces
    if (cached && Date.now() - cached.timestamp < 60 * 1000) {
      set({ workspaces: cached.data, activeWorkspace: cached.data[0] || null })
      return cached.data
    }
    set({ loading: true })
    try {
      const res = await axios.get(`${API_BASE_URL}/api/workspaces`, {
        withCredentials: true
      })
      const list = Array.isArray(res.data) ? res.data : res.data.payload || []
      const active = get().activeWorkspace
      const nextActive =
        list.find((workspace) => workspace._id === active?._id) ||
        list[0] ||
        null
      set((s) => ({
        workspaces: list,
        activeWorkspace: nextActive,
        loading: false,
        cache: { ...s.cache, workspaces: { data: list, timestamp: Date.now() } }
      }))
      return list
    } catch {
      set({ loading: false })
      return []
    }
  },

  fetchWorkspace: async (workspaceId) => {
    if (!workspaceId) return null
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/workspaces/${workspaceId}`,
        {
          withCredentials: true
        }
      )
      const workspace = res.data.payload || res.data
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w._id === workspace._id ? workspace : w
        ),
        activeWorkspace: workspace
      }))
      return workspace
    } catch {
      return null
    }
  },

  //create a new workspace
  createWorkspace: async ({ name }) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/workspaces`,
        { name },
        { withCredentials: true }
      )
      const ws = res.data.payload || res.data
      set((s) => ({ workspaces: [ws, ...s.workspaces], activeWorkspace: ws }))
      return ws
    } catch (err) {
      throw err
    }
  },

  //update workspace name
  updateWorkspace: async (id, data) => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/workspaces/${id}`,
        data,
        {
          withCredentials: true
        }
      )
      const updated = res.data.payload || res.data
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w._id === id ? updated : w)),
        activeWorkspace:
          s.activeWorkspace?._id === id ? updated : s.activeWorkspace
      }))
      return updated
    } catch (err) {
      throw err
    }
  },

  //delete workspace
  deleteWorkspace: async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/workspaces/${id}`, {
        withCredentials: true
      })
      set((s) => ({
        workspaces: s.workspaces.filter((w) => w._id !== id),
        activeWorkspace:
          s.activeWorkspace?._id === id ? null : s.activeWorkspace
      }))
    } catch (err) {
      throw err
    }
  },

  setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),

  // Members

  updateMemberRole: async (workspaceId, userId, role) => {
    set({ error: null })
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/members/${userId}`,
        { role },
        { withCredentials: true }
      )
      const updated = res.data.payload || res.data
      set((s) => {
        const cache = { ...s.cache }
        delete cache.workspaces
        const isActive = s.activeWorkspace?._id === workspaceId
        return {
          workspaces: s.workspaces.map((w) => w._id === workspaceId ? updated : w),
          activeWorkspace: isActive ? updated : s.activeWorkspace,
          members: isActive ? updated.members : s.members,
          cache,
          error: null
        }
      })
      return updated
    } catch (err) {
      set({ error: err.response?.data?.message || 'Could not update role' })
      throw err
    }
  },

  //fetch workspace members by fetching the single workspace
  fetchMembers: async (workspaceId) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/workspaces/${workspaceId}`,
        {
          withCredentials: true
        }
      )
      const ws = res.data.payload || res.data
      set({ members: ws.members || [], activeWorkspace: ws })
    } catch {
      set({ members: [] })
    }
  },

  //invite member by email - backend needs to look up user by email first
  inviteMember: async (workspaceId, email, role = 'MEMBER') => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/members`,
        { email, role },
        { withCredentials: true }
      )
      return res.data
    } catch (err) {
      throw err
    }
  },

  //remove member
  removeMember: async (workspaceId, userId) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/members/${userId}`,
        { withCredentials: true }
      )
      await get().fetchWorkspace(workspaceId)
      set((s) => ({
        members: s.members.filter((m) => m.user?._id !== userId)
      }))
    } catch (err) {
      throw err
    }
  },

  fetchWorkspaceAnalytics: async (workspaceId, filters = {}) => {
    try {
      const { search = '', status = 'ALL' } = filters
      const params = new URLSearchParams()
      if (search.trim()) params.append('q', search.trim())
      if (status) params.append('status', status)

      const queryString = params.toString() ? `?${params.toString()}` : ''
      const res = await axios.get(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/analytics${queryString}`,
        { withCredentials: true }
      )
      set({ analytics: res.data.payload })
      return res.data.payload
    } catch {
      return null
    }
  },

  fetchPermissions: async (workspaceId) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/permissions`,
        { withCredentials: true }
      )
      set({ permissions: res.data.payload })
      return res.data.payload
    } catch {
      return null
    }
  },

  updatePermissions: async (workspaceId, permissions) => {
    const res = await axios.put(
      `${API_BASE_URL}/api/workspaces/${workspaceId}/permissions`,
      { permissions },
      { withCredentials: true }
    )
    set({ permissions: res.data.payload })
    return res.data.payload
  }
}))
