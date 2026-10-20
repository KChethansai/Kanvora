import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { sortByOrder } from '../projectStoreUtils'

const listFetchGeneration = new Map()
let latestListProject = null

export const createListSlice = (set, get) => ({
  loadingLists: {},
  lists: [],

  resetListFetches: () => {
    listFetchGeneration.clear()
    latestListProject = null
  },

  fetchLists: async (projectId) => {
    const state = get()

    if (state.loadingLists?.[projectId]) return

    const generation = (listFetchGeneration.get(projectId) || 0) + 1
    listFetchGeneration.set(projectId, generation)
    latestListProject = projectId
    set((state) => ({
      loadingLists: {
        ...state.loadingLists,
        [projectId]: true
      }
    }))

    try {
      const res = await axios.get(
        `${API_BASE_URL}/projects-api/projects/${projectId}/lists`,
        {
          withCredentials: true
        }
      )
      const lists = res.data.payload || []
      if (listFetchGeneration.get(projectId) !== generation || latestListProject !== projectId) return lists
      set({ lists })
      return lists
    } catch {
      return []
    } finally {
      if (listFetchGeneration.get(projectId) === generation) {
        set((state) => ({
          loadingLists: {
            ...state.loadingLists,
            [projectId]: false
          }
        }))
      }
    }
  },

  createList: async (projectId, title) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/projects-api/projects/${projectId}/lists`,
        { title },
        { withCredentials: true }
      )
      const newList = res.data.payload
      //socket will add it, but we also add locally to avoid flicker
      set((s) => {
        if (String(s.activeProject?._id) !== String(projectId)) return {}
        if (s.lists.some((l) => l._id === newList._id)) return {}
        return { lists: sortByOrder([...s.lists, newList]) }
      })
      return newList
    } catch {
      return null
    }
  },

  deleteList: async (listId) => {
    try {
      await axios.delete(`${API_BASE_URL}/projects-api/lists/${listId}`, {
        withCredentials: true
      })
      set((s) => {
        const newCards = { ...s.cards }
        delete newCards[listId]
        return {
          lists: s.lists.filter((l) => l._id !== listId),
          cards: newCards
        }
      })
    } catch {
      //silent
    }
  },

  updateList: async (listId, data) => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/lists/${listId}`,
        data,
        {
          withCredentials: true
        }
      )
      const updated = res.data.payload
      set((s) => ({
        lists: s.lists.map((list) =>
          list._id === listId ? { ...list, ...updated } : list
        )
      }))
      return updated
    } catch {
      return null
    }
  },

  reorderLists: async (projectId, newOrder) => {
    get().pushUndoSnapshot()
    //optimistic update
    set({ lists: newOrder })
    try {
      await axios.put(
        `${API_BASE_URL}/projects-api/projects/${projectId}/lists/reorder`,
        { orderedIds: newOrder.map((l) => l._id) },
        { withCredentials: true }
      )
    } catch {
      //silent - socket will correct if needed
    }
  }
})
