import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { upsertCardInState } from '../projectStoreUtils'

const cardFetchGeneration = new Map()
const invalidateCardFetches = (...listIds) => {
  const ids = listIds.length ? listIds : [...cardFetchGeneration.keys()]
  for (const listId of ids) {
    cardFetchGeneration.set(listId, (cardFetchGeneration.get(listId) || 0) + 1)
  }
}

export const createCardSlice = (set, get) => ({
  cards: {}, // { [listId]: Card[] }
  cardSavingIds: {},

  fetchCards: async (listId) => {
    const generation = (cardFetchGeneration.get(listId) || 0) + 1
    cardFetchGeneration.set(listId, generation)
    try {
      const res = await axios.get(
        `${API_BASE_URL}/projects-api/lists/${listId}/cards`,
        { withCredentials: true }
      )
      if (cardFetchGeneration.get(listId) !== generation) return
      set((s) => ({
        cards: { ...s.cards, [listId]: res.data.payload || [] }
      }))
    } catch {
      //silent
    }
  },

  createCard: async (listId, cardData) => {
    get().pushUndoSnapshot()
    try {
      const res = await axios.post(
        `${API_BASE_URL}/projects-api/lists/${listId}/cards`,
        cardData,
        { withCredentials: true }
      )
      const newCard = res.data.payload
      //socket will broadcast, but add locally too to avoid flicker
      set((s) => {
        const existing = s.cards[listId] || []
        if (existing.some((c) => c._id === newCard._id)) return {}
        return { cards: { ...s.cards, [listId]: [...existing, newCard] } }
      })
      invalidateCardFetches(listId)
      await get().persistCardOrder(listId)
      return newCard
    } catch {
      return null
    }
  },

  updateCard: async (cardId, data) => {
    const previousCards = get().cards
    invalidateCardFetches()
    set((s) => ({
      cardSavingIds: { ...s.cardSavingIds, [cardId]: true },
      cards: upsertCardInState(s, { _id: cardId, ...data })
    }))
    try {
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/cards/${cardId}`,
        data,
        { withCredentials: true }
      )
      const updated = res.data.payload
      set((s) => ({
        cards: upsertCardInState(s, updated),
        cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
      }))
      invalidateCardFetches()
      return updated
    } catch {
      set((s) => ({
        cards: previousCards,
        cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
      }))
      return null
    }
  },

  uploadCardAttachment: async (cardId, file) => {
    try {
      const body = new FormData()
      body.append('attachment', file)

      const res = await axios.post(
        `${API_BASE_URL}/projects-api/cards/${cardId}/attachments`,
        body,
        { withCredentials: true }
      )
      const updated = res.data.payload
      set((s) => {
        const newCards = { ...s.cards }
        for (const [lid, listCards] of Object.entries(newCards)) {
          const idx = listCards.findIndex((c) => c._id === cardId)
          if (idx !== -1) {
            newCards[lid] = [...listCards]
            newCards[lid][idx] = { ...listCards[idx], ...updated }
            break
          }
        }
        return { cards: newCards }
      })
      return updated
    } catch {
      return null
    }
  },

  deleteCard: async (cardId, listId) => {
    get().pushUndoSnapshot()
    invalidateCardFetches(listId)
    //optimistic remove
    set((s) => ({
      cards: {
        ...s.cards,
        [listId]: (s.cards[listId] || []).filter((c) => c._id !== cardId)
      }
    }))
    try {
      await axios.delete(`${API_BASE_URL}/projects-api/cards/${cardId}`, {
        withCredentials: true
      })
      invalidateCardFetches(listId)
      await get().persistCardOrder(listId)
    } catch {
      //silent
    }
  },

  //move card between lists - optimistic only; persisted via moveCard
  moveCardBetweenLists: (
    cardId,
    fromListId,
    toListId,
    toIndex = null,
    cardPatch = {}
  ) => {
    set((s) => {
      const fromCards = [...(s.cards[fromListId] || [])]
      const idx = fromCards.findIndex((c) => c._id === cardId)
      if (idx === -1) return {}
      const [card] = fromCards.splice(idx, 1)
      const nextCard = { ...card, ...cardPatch }

      if (fromListId === toListId) {
        if (toIndex === null) {
          fromCards.splice(idx, 0, nextCard)
          return { cards: { ...s.cards, [fromListId]: fromCards } }
        }
        const insertAt = toIndex === null ? fromCards.length : toIndex
        fromCards.splice(insertAt, 0, nextCard)
        return { cards: { ...s.cards, [fromListId]: fromCards } }
      }

      const toCards = [...(s.cards[toListId] || [])]
      const insertAt = toIndex === null ? toCards.length : toIndex
      toCards.splice(insertAt, 0, { ...nextCard, listId: toListId })
      return {
        cards: { ...s.cards, [fromListId]: fromCards, [toListId]: toCards }
      }
    })
  },

  //persist card move to backend
  moveCard: async (cardId, toListId, data = {}) => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/cards/${cardId}`,
        { ...data, listId: toListId },
        { withCredentials: true }
      )
      const moved = res.data.payload || null
      invalidateCardFetches()
      await get().persistCardOrder(toListId)
      return moved
    } catch {
      return null
    }
  },

  reorderCardsInList: (listId, newOrder) => {
    set((s) => ({ cards: { ...s.cards, [listId]: newOrder } }))
  },

  persistCardOrder: async (listId) => {
    const orderedIds = (get().cards[listId] || []).map((card) => card._id)
    try {
      await axios.put(
        `${API_BASE_URL}/projects-api/lists/${listId}/cards/reorder`,
        { orderedIds },
        { withCredentials: true }
      )
    } catch {
      //silent; a later fetch/socket event will correct the board
    }
  }
})
