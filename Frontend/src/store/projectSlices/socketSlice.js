import {
  getSocket,
  findLocalCard,
  isIncomingCardNewer,
  upsertCardInState,
  compactActivity,
  mergeOrdered,
  sortByOrder
} from '../projectStoreUtils'

export const createSocketSlice = (set) => ({
  activeUsers: [],
  typingUsers: {},
  activityFeed: [],

  joinProject: (projectId, user = null) => {
    const sock = getSocket()
    sock.emit('join-project', projectId, user)

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
      set((s) => ({
        activeProject:
          s.activeProject?._id === project._id ? project : s.activeProject,
        projects: s.projects.map((p) => (p._id === project._id ? project : p))
      }))
    })

    sock.on('project-deleted', ({ projectId }) => {
      set((s) => ({
        projects: s.projects.filter((p) => p._id !== projectId),
        activeProject:
          s.activeProject?._id === projectId ? null : s.activeProject
      }))
    })

    sock.on('list-created', (list) => {
      set((s) => {
        const already = s.lists.some((l) => l._id === list._id)
        if (already) return {}
        return { lists: sortByOrder([...s.lists, list]) }
      })
    })

    sock.on('list-updated', (list) => {
      set((s) => ({
        lists: sortByOrder(s.lists.map((l) => (l._id === list._id ? list : l)))
      }))
    })

    sock.on('list-deleted', ({ listId }) => {
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
      if (!listId) return
      set((s) => {
        const existing = s.cards[listId] || []
        if (existing.some((c) => c._id === card._id)) return {}
        return { cards: { ...s.cards, [listId]: sortByOrder([...existing, card]) } }
      })
    })

    sock.on('card-updated', (card) => {
      set((s) => {
        const local = findLocalCard(s.cards, card._id)
        if (local && !isIncomingCardNewer(card, local)) return {}
        return { cards: upsertCardInState(s, card) }
      })
    })

    sock.on('card-deleted', ({ cardId, listId }) => {
      set((s) => ({
        cards: {
          ...s.cards,
          [listId]: (s.cards[listId] || []).filter((c) => c._id !== cardId)
        }
      }))
    })

    sock.on('cards-reordered', ({ listId, orderedIds }) => {
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
    const sock = getSocket()
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
  },

  emitActivity: (projectId, activity) => {
    const sock = getSocket()
    sock.emit('activity-created', {
      room: `project:${projectId}`,
      activity
    })
  }
})
