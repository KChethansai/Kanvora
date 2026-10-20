import { getAccountEpoch, isAccountEpochCurrent } from '../../utils/accountEpoch'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { upsertCardInState } from '../projectStoreUtils'

const cardFetchGeneration = new Map()
let nextCardFetchGeneration = 0
const invalidateCardFetches = (...listIds) => {
  const ids = listIds.length ? listIds : [...cardFetchGeneration.keys()]
  for (const listId of ids) {
    cardFetchGeneration.set(listId, ++nextCardFetchGeneration)
  }
}

export const createCardSlice = (set, get) => ({
  cards: {}, // { [listId]: Card[] }
  cardSavingIds: {},

  resetCardFetches: () => cardFetchGeneration.clear(),

  fetchCards: async (listId) => {
    const epoch = getAccountEpoch()
    const generation = ++nextCardFetchGeneration
    cardFetchGeneration.set(listId, generation)
    try {
      const res = await axios.get(
        `${API_BASE_URL}/projects-api/lists/${listId}/cards`,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      if (cardFetchGeneration.get(listId) !== generation) return
      set((s) => ({
        cards: { ...s.cards, [listId]: res.data.payload || [] }
      }))
    } catch {
      //silent
    }
  },

  createCard: async (listId, cardData) => {
    const epoch = getAccountEpoch()
    get().pushUndoSnapshot()
    try {
      const res = await axios.post(
        `${API_BASE_URL}/projects-api/lists/${listId}/cards`,
        cardData,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      const newCard = res.data.payload
      //socket will broadcast, but add locally too to avoid flicker
      set((s) => {
        const existing = s.cards[listId] || []
        if (existing.some((c) => c._id === newCard._id)) return {}
        return { cards: { ...s.cards, [listId]: [...existing, newCard] } }
      })
      invalidateCardFetches(listId)
      await get().persistCardOrder(listId)
      if (!isAccountEpochCurrent(epoch)) return
      return newCard
    } catch {
      return null
    }
  },

  updateCard: async (cardId, data) => {
    const epoch = getAccountEpoch()
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
      if (!isAccountEpochCurrent(epoch)) return
      const updated = res.data.payload
      set((s) => ({
        cards: upsertCardInState(s, updated),
        cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
      }))
      invalidateCardFetches()
      return updated
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      set((s) => ({
        cards: previousCards,
        cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
      }))
      return null
    }
  },

  uploadCardAttachment: async (cardId, file) => {
    const epoch = getAccountEpoch()
    try {
      const body = new FormData()
      body.append('attachment', file)

      const res = await axios.post(
        `${API_BASE_URL}/projects-api/cards/${cardId}/attachments`,
        body,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
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
    const epoch = getAccountEpoch()
    get().pushUndoSnapshot()
    invalidateCardFetches(listId)
    const previousCards = get().cards
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
      if (!isAccountEpochCurrent(epoch)) return
      invalidateCardFetches(listId)
      await get().persistCardOrder(listId)
      if (!isAccountEpochCurrent(epoch)) return
      return true
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      set({ cards: previousCards })
      return false
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
    invalidateCardFetches(fromListId, toListId)
    set((s) => {
      const fromCards = [...(s.cards[fromListId] || [])]
      const idx = fromCards.findIndex((c) => c._id === cardId)
      if (idx === -1) return {}
      const [card] = fromCards.splice(idx, 1)
      const nextCard = { ...card, ...cardPatch }

      if (fromListId === toListId) {
        if (toIndex === null) {
          fromCards.splice(idx, 0, nextCard)
          return { cards: { ...s.cards, [fromListId]: fromCards.map((item, order) => ({ ...item, order })) } }
        }
        const insertAt = toIndex === null ? fromCards.length : toIndex
        fromCards.splice(insertAt, 0, nextCard)
        return { cards: { ...s.cards, [fromListId]: fromCards.map((item, order) => ({ ...item, order })) } }
      }

      const toCards = [...(s.cards[toListId] || [])]
      const insertAt = toIndex === null ? toCards.length : toIndex
      toCards.splice(insertAt, 0, { ...nextCard, listId: toListId })
      return {
        cards: {
          ...s.cards,
          [fromListId]: fromCards.map((item, order) => ({ ...item, order })),
          [toListId]: toCards.map((item, order) => ({ ...item, order }))
        }
      }
    })
  },

  //persist card move to backend
  moveCard: async (cardId, toListId, data = {}) => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/cards/${cardId}`,
        { ...data, listId: toListId },
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      const moved = res.data.payload || null
      invalidateCardFetches()
      await get().persistCardOrder(toListId)
      if (!isAccountEpochCurrent(epoch)) return
      return moved
    } catch {
      return null
    }
  },

  reorderCardsInList: (listId, newOrder) => {
    invalidateCardFetches(listId)
    set((s) => ({ cards: { ...s.cards, [listId]: newOrder.map((card, order) => ({ ...card, order })) } }))
  },

  persistCardOrder: async (listId) => {
    const epoch = getAccountEpoch()
    const orderedIds = (get().cards[listId] || []).map((card) => card._id)
    try {
      await axios.put(
        `${API_BASE_URL}/projects-api/lists/${listId}/cards/reorder`,
        { orderedIds },
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch)) return
      return true
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      //silent; a later fetch/socket event will correct the board
      return false
    }
  }
})
