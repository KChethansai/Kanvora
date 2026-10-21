import { getAccountEpoch, isAccountEpochCurrent } from '../../utils/accountEpoch'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { getActiveBoardProjectId, getBoardSession, isBoardSessionCurrent, sortByOrder } from '../projectStoreUtils'

const listFetchGeneration = new Map()
let nextListFetchGeneration = 0
let latestListProject = null
// Provenance for lists created while an authoritative fetch was already in
// flight. Only those may survive a server response that has not seen them yet.
const localListCreations = new Map()
let nextListCreation = 0

export const createListSlice = (set, get) => ({
  loadingLists: {},
  lists: [],

  resetListFetches: () => {
    listFetchGeneration.clear()
    localListCreations.clear()
    latestListProject = null
  },

  fetchLists: async (projectId, { force = false } = {}) => {
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    // A monotonic marker, not a clock: two events in the same millisecond must
    // still be ordered correctly.
    const creationMark = nextListCreation
    const state = get()

    // A board request only counts for the board that is currently open. A
    // reconnect from a previous board must not repopulate this one.
    const ownsActiveBoard = () => {
      const active = getActiveBoardProjectId()
      return active === null || String(active) === String(projectId)
    }

    if (!ownsActiveBoard()) return
    if (state.loadingLists?.[projectId] && !force) return

    const generation = ++nextListFetchGeneration
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
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session) || !ownsActiveBoard()) return
      const lists = res.data.payload || []
      if (listFetchGeneration.get(projectId) !== generation || latestListProject !== projectId) return lists
      const serverIds = new Set(lists.map((list) => String(list._id)))
      // A list that is absent from an authoritative response was deleted on the
      // server unless this client created it after the request began.
      const localCreates = get().lists.filter((list) => {
        const id = String(list._id)
        if (String(list.projectId) !== String(projectId) || serverIds.has(id)) return false
        const creation = localListCreations.get(id)
        return creation && creation.projectId === String(projectId) && creation.mark > creationMark
      })
      const retainedIds = new Set(localCreates.map((list) => String(list._id)))
      for (const list of lists) localListCreations.delete(String(list._id))
      set((current) => {
        const droppedIds = current.lists
          .filter((list) => String(list.projectId) === String(projectId) &&
            !serverIds.has(String(list._id)) && !retainedIds.has(String(list._id)))
          .map((list) => String(list._id))
        if (droppedIds.length === 0) return { lists: sortByOrder([...lists, ...localCreates]) }
        const cards = { ...current.cards }
        for (const id of droppedIds) delete cards[id]
        return { lists: sortByOrder([...lists, ...localCreates]), cards }
      })
      return lists
    } catch {
      return []
    } finally {
      if (isAccountEpochCurrent(epoch) && listFetchGeneration.get(projectId) === generation) {
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
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    try {
      const res = await axios.post(
        `${API_BASE_URL}/projects-api/projects/${projectId}/lists`,
        { title },
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return null
      const newList = res.data.payload
      localListCreations.set(String(newList._id), {
        projectId: String(projectId),
        mark: ++nextListCreation
      })
      //socket will add it, but we also add locally to avoid flicker
      set((s) => {
        const boardProjectId = latestListProject || s.activeProject?._id
        if (boardProjectId && String(boardProjectId) !== String(projectId)) return {}
        if (s.lists.some((l) => l._id === newList._id)) return {}
        return { lists: sortByOrder([...s.lists, newList]) }
      })
      return newList
    } catch {
      return null
    }
  },

  deleteList: async (listId) => {
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    const projectId = get().lists.find((list) => list._id === listId)?.projectId
    try {
      await axios.delete(`${API_BASE_URL}/projects-api/lists/${listId}`, {
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch)) return false
      if (!isBoardSessionCurrent(session)) return true
      localListCreations.delete(String(listId))
      if (projectId) listFetchGeneration.set(projectId, ++nextListFetchGeneration)
      set((s) => {
        const newCards = { ...s.cards }
        delete newCards[listId]
        return {
          lists: s.lists.filter((l) => l._id !== listId),
          cards: newCards
        }
      })
      return true
    } catch {
      return false
    }
  },

  updateList: async (listId, data) => {
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    try {
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/lists/${listId}`,
        data,
        {
          withCredentials: true
        }
      )
      if (!isAccountEpochCurrent(epoch)) return
      const updated = res.data.payload
      if (!isBoardSessionCurrent(session)) return updated
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
    const session = getBoardSession()
    get().pushUndoSnapshot()
    //optimistic update
    set({ lists: newOrder })
    try {
      await axios.put(
        `${API_BASE_URL}/projects-api/projects/${projectId}/lists/reorder`,
        { orderedIds: newOrder.map((l) => l._id) },
        { withCredentials: true }
      )
      return isBoardSessionCurrent(session)
    } catch {
      return false
    }
  }
})
