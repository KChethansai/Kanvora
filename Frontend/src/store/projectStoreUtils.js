import { io } from 'socket.io-client'
import { API_BASE_URL } from '../config/api'

// Singleton socket connection shared by board pages and dashboard surfaces.
let socket = null

export const getSocket = () => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket']
    })
  }

  return socket
}

export const closeSocket = () => {
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
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
