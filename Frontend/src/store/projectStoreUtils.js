import { io } from 'socket.io-client'
import { API_BASE_URL } from '../config/api'

// Singleton socket connection shared by board pages and dashboard surfaces.
let socket = null
let connectedOnce = false
let activeBoard = null
let resyncHandler = null
// A monotonic identity for the board currently being viewed. Account epochs
// answer "who is signed in"; this answers "which board owns this response".
let boardSession = 0

export const getBoardSession = () => boardSession
export const isBoardSessionCurrent = (session) => session === boardSession
export const getActiveBoardProjectId = () => activeBoard?.projectId || null

export const beginBoardSession = (projectId, user = null) => {
  boardSession += 1
  activeBoard = projectId ? { projectId, user } : null
  return boardSession
}

export const setActiveBoard = (projectId, user = null) => {
  // Joining the same board during its initial load keeps the session that the
  // in-flight list/project requests already captured. A different board always
  // starts a new session.
  if (projectId && activeBoard?.projectId === projectId) {
    activeBoard = { projectId, user }
    return boardSession
  }
  return beginBoardSession(projectId, user)
}

export const invalidateBoardSession = () => {
  boardSession += 1
  activeBoard = null
  resyncHandler = null
  return boardSession
}

export const setSocketResync = (handler) => {
  resyncHandler = typeof handler === 'function' ? handler : null
}

export const getSocket = () => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket']
    })

    // Rooms live on the server connection. After any reconnect the client must
    // rejoin the board it is currently viewing and refetch missed state.
    socket.on('connect', () => {
      if (!connectedOnce) {
        connectedOnce = true
        return
      }
      if (activeBoard) socket.emit('join-project', activeBoard.projectId, activeBoard.user)
      resyncHandler?.()
    })

    socket.on('disconnect', (reason) => {
      // The server disconnects sockets whose authenticated session or access
      // was revoked. Automatic reconnect would only produce an auth failure
      // loop, so recovery requires a fresh login.
      if (reason !== 'io server disconnect') return
      socket.disconnect()
      // The access of this account may have changed while the board was open.
      // The board is revalidated, so its capabilities - and the controls
      // derived from them - match what the server will now accept.
      resyncHandler?.()
    })
  }

  return socket
}

export const closeSocket = () => {
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
  connectedOnce = false
  activeBoard = null
  resyncHandler = null
  boardSession += 1
}

export const peekSocket = () => socket

export const cardMatches = (cardId) => (card) => card._id === cardId

// Board order is server-owned. Events can arrive out of order or while an
// optimistic update is in flight, so every merge re-sorts the affected list.
export const sortByOrder = (items = []) => [...items].sort((left, right) => {
  const leftOrder = Number(left?.order)
  const rightOrder = Number(right?.order)
  const order = (Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER) -
    (Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER)
  if (order !== 0) return order
  return String(left?._id || '').localeCompare(String(right?._id || ''))
})

export const mergeOrdered = (items = [], orderedIds = []) => {
  const byId = new Map(items.map((item) => [String(item._id), item]))
  const ordered = orderedIds.map((id, index) => {
    const item = byId.get(String(id))
    return item ? { ...item, order: index } : null
  }).filter(Boolean)
  const seen = new Set(ordered.map((item) => String(item._id)))
  const extras = sortByOrder(items.filter((item) => !seen.has(String(item._id))))
  return [...ordered, ...extras]
}

export const upsertCardInState = (state, card) => {
  const newCards = { ...state.cards }
  const nextListId = card.listId?.toString()
  let found = false

  for (const [lid, listCards] of Object.entries(newCards)) {
    const idx = listCards.findIndex(cardMatches(card._id))
    if (idx !== -1) {
      found = true
      if (nextListId && nextListId !== lid) {
        newCards[lid] = listCards.filter((c) => c._id !== card._id)
        newCards[nextListId] = sortByOrder([
          ...(newCards[nextListId] || []),
          { ...listCards[idx], ...card, listId: nextListId }
        ])
      } else {
        newCards[lid] = sortByOrder(listCards.map((existing) =>
          existing._id === card._id ? { ...existing, ...card } : existing
        ))
      }
      break
    }
  }

  if (!found && nextListId && newCards[nextListId]) {
    newCards[nextListId] = sortByOrder([...newCards[nextListId], card])
  }

  return newCards
}

export const findLocalCard = (cards, cardId) => {
  for (const listCards of Object.values(cards)) {
    const found = listCards.find(cardMatches(cardId))
    if (found) return found
  }
  return null
}

export const isIncomingCardNewer = (incoming, local) => {
  if (!local?.updatedAt || !incoming?.updatedAt) return true
  return new Date(incoming.updatedAt) > new Date(local.updatedAt)
}

export const compactActivity = (activityFeed, activity) =>
  [activity, ...activityFeed].slice(0, 60)

export const cacheTtl = 60 * 1000
export const isFresh = (timestamp) => timestamp && Date.now() - timestamp < cacheTtl
