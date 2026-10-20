import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { fetchAllProjects } from '../../utils/paginatedProjects'
import { isFresh } from '../projectStoreUtils'

let projectFetchGeneration = 0
let activeProjectGeneration = 0

export const createProjectSlice = (set, get) => ({
  loadingProject: false,
  loadedProjects: {},
  projects: [],
  recentProjects: [],
  activeProject: null,
  analyticsByProject: {},

  fetchProjects: async (workspaceId = null) => {
    const generation = ++projectFetchGeneration
    const cacheKey = `projects:${workspaceId || 'all'}`
    const cached = get().cache[cacheKey]
    if (isFresh(cached?.timestamp) && generation === projectFetchGeneration) {
      set({ projects: cached.data, loading: false })
      return cached.data
    }
    set({ loading: true, projects: [] })
    try {
      const projects = await fetchAllProjects({ workspaceId })
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
      if (generation === projectFetchGeneration) set({ loading: false, projects: [] })
      return []
    }
  },

  fetchRecentProjects: async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/projects-api/projects/recent?limit=5`,
        {
          withCredentials: true
        }
      )
      set({ recentProjects: res.data.payload || [] })
    } catch {
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
      const newProject = res.data.payload
      set((s) => ({ projects: [newProject, ...s.projects] }))
      return newProject
    } catch {
      return null
    }
  },

  fetchProject: async (projectId) => {
    const state = get()

    if (
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
      if (generation === activeProjectGeneration) set({ loadingProject: false })
      return null
    }
  },

  updateProject: async (projectId, data) => {
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
      const updated = res.data.payload
      set((s) => ({
        projects: s.projects.map((b) =>
          b._id === projectId ? { ...b, ...updated } : b
        ),
        activeProject:
          s.activeProject?._id === projectId
            ? { ...s.activeProject, ...updated }
            : s.activeProject
      }))
      return updated
    } catch {
      return null
    }
  },

  deleteProject: async (projectId) => {
    try {
      await axios.delete(`${API_BASE_URL}/projects-api/projects/${projectId}`, {
        withCredentials: true
      })
      set((s) => ({
        projects: s.projects.filter((b) => b._id !== projectId),
        recentProjects: s.recentProjects.filter((b) => b._id !== projectId)
      }))
    } catch {
      //silent
    }
  },

  archiveProject: async (projectId, archived = true) => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/projects/${projectId}/archive`,
        { archived },
        { withCredentials: true }
      )
      const updated = res.data.payload
      set((s) => ({
        projects: s.projects.map((p) => (p._id === projectId ? updated : p)),
        activeProject:
          s.activeProject?._id === projectId ? updated : s.activeProject
      }))
      return updated
    } catch {
      return null
    }
  },

  exportProject: async (projectId) => {
    const res = await axios.get(
      `${API_BASE_URL}/projects-api/projects/${projectId}/export`,
      { withCredentials: true }
    )
    return res.data.payload
  },

  fetchProjectAnalytics: async (projectId) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/projects-api/projects/${projectId}/analytics`,
        { withCredentials: true }
      )
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
