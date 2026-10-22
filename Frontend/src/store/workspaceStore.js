import { getAccountEpoch, isAccountEpochCurrent } from '../utils/accountEpoch'
// workspaceStore store: centralizes client state and API calls for this domain.
import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useProjectStore } from './projectStore'

let workspaceFetchGeneration = 0
let workspaceDetailGeneration = 0
const invalidateProjectDiscovery = () => {
  const store = useProjectStore
  if (typeof store?.getState === 'function') store.getState().invalidateProjectCaches()
}
const withoutWorkspaceListCache = (cache = {}) => {
  const next = { ...cache }
  delete next.workspaces
  return next
}

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

  resetWorkspaces: () => {
    workspaceFetchGeneration++
    workspaceDetailGeneration++
    set({
      workspaces: [],
      activeWorkspace: null,
      members: [],
      loading: false,
      error: null,
      analytics: null,
      permissions: null,
      cache: {}
    })
  },

  // Workspaces

  //fetch all workspaces for the logged-in user
  fetchWorkspaces: async () => {
    const epoch = getAccountEpoch()
    const generation = ++workspaceFetchGeneration
    const cached = get().cache.workspaces
    if (cached && Date.now() - cached.timestamp < 60 * 1000) {
      const active = get().activeWorkspace
      set({
        workspaces: cached.data,
        activeWorkspace:
          cached.data.find((workspace) => workspace._id === active?._id) ||
          cached.data[0] ||
          null
      })
      return cached.data
    }
    set({ loading: true })
    try {
      const res = await axios.get(`${API_BASE_URL}/api/workspaces`, {
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch) || generation !== workspaceFetchGeneration) return
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
      if (!isAccountEpochCurrent(epoch) || generation !== workspaceFetchGeneration) return
      set({ loading: false })
      return []
    }
  },

  fetchWorkspace: async (workspaceId) => {
    const epoch = getAccountEpoch()
    const generation = ++workspaceDetailGeneration
    if (!workspaceId) return null
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/workspaces/${workspaceId}`,
        {
          withCredentials: true
        }
      )
      if (!isAccountEpochCurrent(epoch) || generation !== workspaceDetailGeneration) return
      const workspace = res.data.payload || res.data
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w._id === workspace._id ? workspace : w
        ),
        activeWorkspace: workspace,
        cache: withoutWorkspaceListCache(s.cache)
      }))
      return workspace
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      return null
    }
  },

  //create a new workspace
  createWorkspace: async ({ name }) => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/workspaces`,
        { name },
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      workspaceFetchGeneration++
      workspaceDetailGeneration++
      const ws = res.data.payload || res.data
      set((s) => ({
        workspaces: [ws, ...s.workspaces],
        activeWorkspace: ws,
        loading: false,
        cache: withoutWorkspaceListCache(s.cache)
      }))
      invalidateProjectDiscovery()
      return ws
    } catch (err) {
      if (!isAccountEpochCurrent(epoch)) return
      throw err
    }
  },

  //update workspace name
  updateWorkspace: async (id, data) => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/workspaces/${id}`,
        data,
        {
          withCredentials: true
        }
      )
      if (!isAccountEpochCurrent(epoch)) return
      workspaceFetchGeneration++
      workspaceDetailGeneration++
      const updated = res.data.payload || res.data
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w._id === id ? updated : w)),
        activeWorkspace:
          s.activeWorkspace?._id === id ? updated : s.activeWorkspace,
        loading: false,
        cache: withoutWorkspaceListCache(s.cache)
      }))
      return updated
    } catch (err) {
      if (!isAccountEpochCurrent(epoch)) return
      throw err
    }
  },

  //delete workspace
  deleteWorkspace: async (id) => {
    const epoch = getAccountEpoch()
    try {
      await axios.delete(`${API_BASE_URL}/api/workspaces/${id}`, {
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch)) return
      workspaceFetchGeneration++
      workspaceDetailGeneration++
      set((s) => ({
        workspaces: s.workspaces.filter((w) => w._id !== id),
        activeWorkspace:
          s.activeWorkspace?._id === id ? null : s.activeWorkspace,
        loading: false,
        cache: withoutWorkspaceListCache(s.cache)
      }))
      invalidateProjectDiscovery()
      return true
    } catch (err) {
      if (!isAccountEpochCurrent(epoch)) return false
      throw err
    }
  },

  setActiveWorkspace: (ws) => {
    workspaceFetchGeneration++
    workspaceDetailGeneration++
    set({ activeWorkspace: ws, loading: false })
  },

  // Members

  updateMemberRole: async (workspaceId, userId, role) => {
    const epoch = getAccountEpoch()
    set({ error: null })
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/members/${userId}`,
        { role },
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
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
      invalidateProjectDiscovery()
      return updated
    } catch (err) {
      if (!isAccountEpochCurrent(epoch)) return
      set({ error: err.response?.data?.message || 'Could not update role' })
      throw err
    }
  },

  //fetch workspace members by fetching the single workspace
  fetchMembers: async (workspaceId) => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/workspaces/${workspaceId}`,
        {
          withCredentials: true
        }
      )
      if (!isAccountEpochCurrent(epoch)) return
      const ws = res.data.payload || res.data
      set({ members: ws.members || [], activeWorkspace: ws })
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      set({ members: [] })
    }
  },

  //invite member by email - backend needs to look up user by email first
  inviteMember: async (workspaceId, email, role = 'MEMBER') => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/members`,
        { email, role },
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      return res.data
    } catch (err) {
      if (!isAccountEpochCurrent(epoch)) return
      throw err
    }
  },

  //remove member
  removeMember: async (workspaceId, userId) => {
    const epoch = getAccountEpoch()
    try {
      await axios.delete(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/members/${userId}`,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      await get().fetchWorkspace(workspaceId)
      if (!isAccountEpochCurrent(epoch)) return
      set((s) => ({
        members: s.members.filter((m) => m.user?._id !== userId),
        cache: withoutWorkspaceListCache(s.cache)
      }))
      invalidateProjectDiscovery()
    } catch (err) {
      if (!isAccountEpochCurrent(epoch)) return
      throw err
    }
  },

  fetchWorkspaceAnalytics: async (workspaceId, filters = {}) => {
    const epoch = getAccountEpoch()
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
      if (!isAccountEpochCurrent(epoch)) return
      set({ analytics: res.data.payload })
      return res.data.payload
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      return null
    }
  },

  fetchPermissions: async (workspaceId) => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/workspaces/${workspaceId}/permissions`,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      set({ permissions: res.data.payload })
      return res.data.payload
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      return null
    }
  },

  updatePermissions: async (workspaceId, permissions) => {
    const epoch = getAccountEpoch()
    const res = await axios.put(
      `${API_BASE_URL}/api/workspaces/${workspaceId}/permissions`,
      { permissions },
      { withCredentials: true }
    )
    if (!isAccountEpochCurrent(epoch)) return
    set((s) => ({ permissions: res.data.payload, cache: withoutWorkspaceListCache(s.cache) }))
    invalidateProjectDiscovery()
    return res.data.payload
  }
}))
