import {
  getSocket,
  peekSocket,
  setActiveBoard,
  setSocketResync,
  isBoardSessionCurrent,
  findLocalCard,
  isIncomingCardNewer,
  upsertCardInState,
  compactActivity,
  mergeOrdered,
  sortByOrder
} from '../projectStoreUtils'
import { markListCreation } from './listSlice'
import { getAccountEpoch, isAccountEpochCurrent } from '../../utils/accountEpoch'

export const createSocketSlice = (setState, getState) => ({
  activeUsers: [],
  typingUsers: {},
  activityFeed: [],

  joinProject: (projectId, user = null) => {
    const epoch = getAccountEpoch()
    const session = setActiveBoard(projectId, user)
    // Includes already queued callbacks retained after disconnect/removeListeners.
    const set = (...args) => {
      if (isAccountEpochCurrent(epoch) && isBoardSessionCurrent(session)) setState(...args)
    }
    const sock = getSocket()
    setSocketResync(async () => {
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      await getState().fetchProject(projectId, { force: true })
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      await getState().fetchLists(projectId, { force: true })
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      const lists = getState().lists.filter((list) => String(list.projectId) === String(projectId))
      await Promise.all(lists.map((list) => {
        if (!isBoardSessionCurrent(session)) return null
        return getState().fetchCards(list._id)
      }))
    })
    sock.emit('join-project', projectId, user)

    // Events are scoped to the board that is currently open. A delayed event
    // from a previous room must not mutate the active board's state.
    const inBoard = (candidate) => String(candidate?.projectId) === String(projectId)
    const knownList = (listId) => (getState().lists || []).some((list) => String(list._id) === String(listId))

    sock.off('project-updated')
    sock.off('project-deleted')

    sock.off('list-created')
    sock.off('list-updated')
    sock.off('list-deleted')
    sock.off('lists-reordered')
    sock.off('card-created')
    sock.off('card-updated')
    sock.off('card-deleted')
    sock.off('cards-reordered')
    sock.off('presence-updated')
    sock.off('typing-started')
    sock.off('typing-stopped')
    sock.off('activity-created')

    sock.on('project-updated', (project) => {
      if (String(project?._id) !== String(projectId)) return
      const active = getState().activeProject
      const archivedChanged = active?._id === project._id &&
        Boolean(active.archivedAt) !== Boolean(project.archivedAt)
      const data = { ...project }
      delete data.capabilities
      const merge = (existing) => {
        if (existing?._id !== project._id) return data
        return {
          ...existing,
          ...data,
          // Capabilities are per user. A socket event from another actor must
          // never upgrade this recipient; archived boards fail closed.
          capabilities: project.archivedAt
            ? { read: true, edit: false, manage: false, restore: false }
            : existing.capabilities
        }
      }
      set((s) => ({
        activeProject:
          s.activeProject?._id === project._id
            ? merge(s.activeProject)
            : s.activeProject,
        projects: s.projects.map((p) =>
          p._id === project._id ? merge(p) : p
        )
      }))
      if (archivedChanged && isBoardSessionCurrent(session)) {
        getState().fetchProject(projectId, { force: true }).catch(() => {})
      }
    })

    sock.on('project-deleted', ({ projectId: deletedId }) => {
      if (String(deletedId) !== String(projectId)) return
      set((s) => ({
        projects: s.projects.filter((p) => p._id !== deletedId),
        activeProject:
          s.activeProject?._id === deletedId ? null : s.activeProject
      }))
    })

    sock.on('list-created', (list) => {
      if (!inBoard(list)) return
      // A list created by another member is a creation as well: an
      // authoritative read that started earlier must not delete it.
      markListCreation(list)
      set((s) => {
        const already = s.lists.some((l) => l._id === list._id)
        if (already) return {}
        return { lists: sortByOrder([...s.lists, list]) }
      })
    })

    sock.on('list-updated', (list) => {
      if (!inBoard(list) || !knownList(list?._id)) return
      set((s) => ({
        lists: sortByOrder(s.lists.map((l) => (l._id === list._id ? list : l)))
      }))
    })

    sock.on('list-deleted', ({ listId }) => {
      if (!knownList(listId)) return
      set((s) => {
        const newCards = { ...s.cards }
        delete newCards[listId]
        return {
          lists: s.lists.filter((l) => l._id !== listId),
          cards: newCards
        }
      })
    })

    sock.on('lists-reordered', ({ orderedIds }) => {
      set((s) => ({ lists: mergeOrdered(s.lists, orderedIds) }))
    })

    sock.on('card-created', (card) => {
      const listId = card.listId?.toString()
      if (!listId || !inBoard(card) || !knownList(listId)) return
      set((s) => {
        const existing = s.cards[listId] || []
        if (existing.some((c) => c._id === card._id)) return {}
        return { cards: { ...s.cards, [listId]: sortByOrder([...existing, card]) } }
      })
    })

    sock.on('card-updated', (card) => {
      if (!inBoard(card) || !knownList(card?.listId)) return
      set((s) => {
        const local = findLocalCard(s.cards, card._id)
        if (local && !isIncomingCardNewer(card, local)) return {}
        return { cards: upsertCardInState(s, card) }
      })
    })

    sock.on('card-deleted', ({ cardId, listId }) => {
      if (!knownList(listId)) return
      set((s) => ({
        cards: {
          ...s.cards,
          [listId]: (s.cards[listId] || []).filter((c) => c._id !== cardId)
        }
      }))
    })

    sock.on('cards-reordered', ({ listId, orderedIds }) => {
      if (!knownList(listId)) return
      set((s) => ({
        cards: {
          ...s.cards,
          [listId]: mergeOrdered(s.cards[listId] || [], orderedIds)
        }
      }))
    })

    sock.on('presence-updated', ({ room, users }) => {
      if (room === `project:${projectId}`) set({ activeUsers: users || [] })
    })

    sock.on('typing-started', ({ cardId, user }) => {
      if (!cardId || !user) return
      set((s) => ({
        typingUsers: {
          ...s.typingUsers,
          [cardId]: {
            ...(s.typingUsers[cardId] || {}),
            [user._id || user.id || user.socketId]: user
          }
        }
      }))
    })

    sock.on('typing-stopped', ({ cardId, user }) => {
      const key = user?._id || user?.id || user?.socketId
      if (!cardId || !key) return
      set((s) => {
        const nextCardTyping = { ...(s.typingUsers[cardId] || {}) }
        delete nextCardTyping[key]
        return {
          typingUsers: { ...s.typingUsers, [cardId]: nextCardTyping }
        }
      })
    })

    sock.on('activity-created', (activity) => {
      set((s) => ({ activityFeed: compactActivity(s.activityFeed, activity) }))
    })
  },

  leaveProject: (projectId) => {
    const sock = peekSocket()
    setActiveBoard(null)
    setSocketResync(null)
    if (!sock) return
    sock.emit('leave-project', projectId)
  },

  joinUserRoom: (userId) => {
    const sock = getSocket()
    sock.emit('join-user', userId)
  },

  emitTyping: ({ projectId, cardId, user, typing }) => {
    const sock = getSocket()
    sock.emit(typing ? 'typing-start' : 'typing-stop', {
      room: `project:${projectId}`,
      cardId,
      user
    })
  }
})
