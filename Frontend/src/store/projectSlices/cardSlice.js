import { getAccountEpoch, isAccountEpochCurrent } from '../../utils/accountEpoch'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { sortByOrder, upsertCardInState } from '../projectStoreUtils'

const cardFetchGeneration = new Map()
let nextCardFetchGeneration = 0
const invalidateCardFetches = (...listIds) => {
  const ids = listIds.length ? listIds : [...cardFetchGeneration.keys()]
  for (const listId of ids) {
    cardFetchGeneration.set(listId, ++nextCardFetchGeneration)
  }
}

// Mutations of one card are ordered. An older request must not overwrite a
// newer optimistic change or roll back state it no longer owns.
const cardMutationGeneration = new Map()
const beginCardMutation = (cardId) => {
  const next = (cardMutationGeneration.get(cardId) || 0) + 1
  cardMutationGeneration.set(cardId, next)
  return next
}

const findCardEntry = (cards, cardId) => {
  for (const [listId, listCards] of Object.entries(cards || {})) {
    const card = listCards.find((item) => item._id === cardId)
    if (card) return { card, listId }
  }
  return null
}

const restoreCardInState = (state, cardId, entry) => {
  const current = findCardEntry(state.cards, cardId)?.card
  if (entry?.card && current?.updatedAt && entry.card.updatedAt &&
      new Date(current.updatedAt) > new Date(entry.card.updatedAt)) return null
  const cards = {}
  for (const [listId, listCards] of Object.entries(state.cards)) {
    cards[listId] = listCards.filter((card) => card._id !== cardId)
  }
  if (entry?.card && cards[entry.listId]) {
    cards[entry.listId] = sortByOrder([...cards[entry.listId], entry.card])
  }
  return { cards }
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
    const previous = findCardEntry(get().cards, cardId)
    const mutation = beginCardMutation(cardId)
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
      if (cardMutationGeneration.get(cardId) === mutation) {
        set((s) => ({
          cards: upsertCardInState(s, updated),
          cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
        }))
        invalidateCardFetches()
      }
      return updated
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      if (cardMutationGeneration.get(cardId) === mutation) {
        set((s) => ({
          ...(restoreCardInState(s, cardId, previous) || {}),
          cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
        }))
      }
      return null
    }
  },

  uploadCardAttachment: async (cardId, file) => {
    const epoch = getAccountEpoch()
    beginCardMutation(cardId)
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
    const previous = findCardEntry(get().cards, cardId)
    const mutation = beginCardMutation(cardId)
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
      if (!isAccountEpochCurrent(epoch)) return false
      if (cardMutationGeneration.get(cardId) === mutation) {
        set((s) => ({
          ...(restoreCardInState(s, cardId, previous) || {}),
          cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
        }))
      }
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
    beginCardMutation(cardId)
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
    for (const card of newOrder) beginCardMutation(card._id)
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
