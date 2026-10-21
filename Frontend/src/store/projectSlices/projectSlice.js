import { getAccountEpoch, isAccountEpochCurrent } from '../../utils/accountEpoch'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { fetchAllProjects } from '../../utils/paginatedProjects'
import { isFresh } from '../projectStoreUtils'

let projectFetchGeneration = 0
let activeProjectGeneration = 0

const withoutProjectLists = (cache = {}) => Object.fromEntries(
  Object.entries(cache).filter(([key]) => !key.startsWith('projects:'))
)

export const createProjectSlice = (set, get) => ({
  loadingProject: false,
  loadedProjects: {},
  projects: [],
  recentProjects: [],
  activeProject: null,
  analyticsByProject: {},

  resetProjects: () => {
    projectFetchGeneration += 1
    activeProjectGeneration += 1
    set({
      loadingProject: false,
      loadedProjects: {},
      projects: [],
      recentProjects: [],
      activeProject: null,
      analyticsByProject: {},
      loading: false,
      cache: {}
    })
  },

  // Membership, rename, archive and deletion changes invalidate listing caches
  // so the next navigation cannot render another state of the board.
  invalidateProjectCaches: () => set((s) => ({
    cache: withoutProjectLists(s.cache),
    loadedProjects: {}
  })),

  fetchProjects: async (workspaceId = null) => {
    const epoch = getAccountEpoch()
    const generation = ++projectFetchGeneration
    const cacheKey = `projects:${workspaceId || 'all'}`
    const cached = get().cache[cacheKey]
    if (isFresh(cached?.timestamp) && generation === projectFetchGeneration) {
      set({ projects: cached.data, loading: false })
      return cached.data
    }
    set({ loading: true, projects: [] })
    try {
      const projects = await fetchAllProjects({
        workspaceId,
        request: {
          get: (...args) => {
            // Stop pagination from issuing another account's request after a switch.
            if (!isAccountEpochCurrent(epoch)) throw new Error('Account changed')
            return axios.get(...args)
          }
        }
      })
      if (!isAccountEpochCurrent(epoch)) return
      if (generation !== projectFetchGeneration) return projects
      set((s) => ({
        projects,
        loading: false,
        cache: {
          ...s.cache,
          [cacheKey]: { data: projects, timestamp: Date.now() }
        }
      }))

      return projects
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      if (generation === projectFetchGeneration) set({ loading: false, projects: [] })
      return []
    }
  },

  fetchRecentProjects: async () => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.get(
        `${API_BASE_URL}/projects-api/projects/recent?limit=5`,
        {
          withCredentials: true
        }
      )
      if (!isAccountEpochCurrent(epoch)) return
      set({ recentProjects: res.data.payload || [] })    } catch {
      //silent
    }
  },

  createProject: async ({
    title,
    color,
    workspaceId = null,
    backgroundFile = null,
    isEditable = false,
    isPublished = false
  }) => {
    const epoch = getAccountEpoch()
    try {
      const body = backgroundFile
        ? new FormData()
        : { title, color, workspaceId, isEditable, isPublished }
      if (backgroundFile) {
        body.append('title', title)
        body.append('color', color)
        if (workspaceId) body.append('workspaceId', workspaceId)
        body.append('isEditable', isEditable)
        body.append('isPublished', isPublished)
        body.append('background', backgroundFile)
      }
      const res = await axios.post(
        `${API_BASE_URL}/projects-api/projects`,
        body,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      const newProject = res.data.payload
      set((s) => ({
        projects: [newProject, ...s.projects],
        cache: withoutProjectLists(s.cache)
      }))
      return newProject
    } catch {
      return null
    }
  },

  fetchProject: async (projectId, { force = false } = {}) => {
    const epoch = getAccountEpoch()
    const state = get()

    if (
      !force &&
      state.loadedProjects?.[projectId] &&
      state.activeProject?._id === projectId
    ) {
      return state.activeProject
    }

    const generation = ++activeProjectGeneration
    set({ loadingProject: true })

    try {
      const res = await axios.get(
        `${API_BASE_URL}/projects-api/projects/${projectId}`,
        {
          withCredentials: true
        }
      )

      const project = res.data.payload || null
      if (!isAccountEpochCurrent(epoch)) return
      if (generation !== activeProjectGeneration) return project

      set((state) => ({
        activeProject: project,
        loadingProject: false,

        loadedProjects: {
          ...state.loadedProjects,
          [projectId]: true
        },

        projects: project
          ? state.projects.some((p) => p._id === project._id)
            ? state.projects.map((p) => (p._id === project._id ? project : p))
            : [project, ...state.projects]
          : state.projects
      }))

      return project
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      if (generation === activeProjectGeneration) set({ loadingProject: false })
      return null
    }
  },

  updateProject: async (projectId, data) => {
    const epoch = getAccountEpoch()
    try {
      const body = data.backgroundFile ? new FormData() : data
      if (data.backgroundFile) {
        Object.entries(data).forEach(([key, value]) => {
          if (
            key !== 'backgroundFile' &&
            value !== undefined &&
            value !== null
          ) {
            body.append(key, value)
          }
        })
        body.append('background', data.backgroundFile)
      }
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/projects/${projectId}`,
        body,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      const updated = res.data.payload
      set((s) => ({
        projects: s.projects.map((b) =>
          b._id === projectId ? { ...b, ...updated } : b
        ),
        activeProject:
          s.activeProject?._id === projectId
            ? { ...s.activeProject, ...updated }
            : s.activeProject,
        cache: withoutProjectLists(s.cache)
      }))
      return updated
    } catch {
      return null
    }
  },

  deleteProject: async (projectId) => {
    const epoch = getAccountEpoch()
    try {
      await axios.delete(`${API_BASE_URL}/projects-api/projects/${projectId}`, {
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch)) return false
      set((s) => {
        const loadedProjects = { ...s.loadedProjects }
        delete loadedProjects[projectId]
        const analyticsByProject = { ...s.analyticsByProject }
        delete analyticsByProject[projectId]
        return {
          projects: s.projects.filter((b) => b._id !== projectId),
          recentProjects: s.recentProjects.filter((b) => b._id !== projectId),
          activeProject: String(s.activeProject?._id) === String(projectId) ? null : s.activeProject,
          loadedProjects,
          analyticsByProject,
          cache: withoutProjectLists(s.cache)
        }
      })
      return true
    } catch {
      if (!isAccountEpochCurrent(epoch)) return false
      return false
    }
  },

  archiveProject: async (projectId, archived = true) => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/projects/${projectId}/archive`,
        { archived },
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      const updated = res.data.payload
      set((s) => ({
        projects: s.projects.map((p) => (p._id === projectId ? updated : p)),
        activeProject:
          s.activeProject?._id === projectId ? updated : s.activeProject,
        cache: withoutProjectLists(s.cache)
      }))
      return updated
    } catch {
      return null
    }
  },

  exportProject: async (projectId) => {
    const epoch = getAccountEpoch()
    const res = await axios.get(
      `${API_BASE_URL}/projects-api/projects/${projectId}/export`,
      { withCredentials: true }
    )
    if (!isAccountEpochCurrent(epoch)) return
    return res.data.payload
  },

  fetchProjectAnalytics: async (projectId) => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.get(
        `${API_BASE_URL}/projects-api/projects/${projectId}/analytics`,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      set((s) => ({
        analyticsByProject: {
          ...s.analyticsByProject,
          [projectId]: res.data.payload
        }
      }))
      return res.data.payload
    } catch {
      return null
    }
  },

  setActiveProject: (project) => set({ activeProject: project })
})
