import { getAccountEpoch, isAccountEpochCurrent } from '../../utils/accountEpoch'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { getBoardSession, isBoardSessionCurrent, sortByOrder, upsertCardInState } from '../projectStoreUtils'
import { fetchAllPages } from '../../utils/paginatedProjects'

const cardFetchGeneration = new Map()
let nextCardFetchGeneration = 0
const invalidateCardFetches = (...listIds) => {
  const ids = listIds.length ? listIds : [...cardFetchGeneration.keys()]
  for (const listId of ids) {
    cardFetchGeneration.set(listId, ++nextCardFetchGeneration)
  }
}

// Last server-confirmed snapshot per card. A failed mutation restores this,
// never another optimistic patch that may itself be unsaved.
const cardCommitted = new Map()
const rememberCommitted = (card, fallbackListId = null) => {
  if (!card?._id) return
  const id = String(card._id)
  const existing = cardCommitted.get(id)
  // A response that is older than what the server already confirmed must not
  // become the baseline (a late attachment or move response, for example).
  if (existing?.card?.updatedAt && card.updatedAt &&
      new Date(card.updatedAt) < new Date(existing.card.updatedAt)) return
  const listId = String(card.listId || fallbackListId || existing?.listId || '')
  cardCommitted.set(id, {
    card: { ...card, ...(card.listId || fallbackListId ? {} : { listId: existing?.listId }) },
    listId
  })
}
const committedFor = (cardId) => cardCommitted.get(String(cardId)) || null

// Mutations of one card are ordered. An older request must not overwrite a
// newer optimistic change or roll back state it no longer owns.
const cardMutationGeneration = new Map()
const beginCardMutation = (cardId) => {
  const next = (cardMutationGeneration.get(cardId) || 0) + 1
  cardMutationGeneration.set(cardId, next)
  return next
}

// A move is not an edit: it must not take over the ownership of a pending
// field update, or that update would never release its saving flag.
const cardMoveGeneration = new Map()
const beginCardMove = (cardId) => {
  const next = (cardMoveGeneration.get(cardId) || 0) + 1
  cardMoveGeneration.set(cardId, next)
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
  if (entry?.card) {
    // Without a known list the card stays where it currently is, so a restore
    // can never remove it from the board.
    const targetList = entry.listId || findCardEntry(state.cards, cardId)?.listId
    if (targetList && cards[targetList]) {
      cards[targetList] = sortByOrder([...cards[targetList], entry.card])
    } else {
      return null
    }
  }
  return { cards }
}

export const createCardSlice = (set, get) => ({
  cards: {}, // { [listId]: Card[] }
  cardSavingIds: {},

  resetCardFetches: () => {
    cardFetchGeneration.clear()
    cardCommitted.clear()
  },

  fetchCards: async (listId) => {
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    const generation = ++nextCardFetchGeneration
    cardFetchGeneration.set(listId, generation)
    try {
      // The server caps a page, so every card of the list is read before the
      // store replaces the collection. A partial page would silently drop
      // cards from the board.
      const payload = await fetchAllPages({
        url: `${API_BASE_URL}/projects-api/lists/${listId}/cards`
      })
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      if (cardFetchGeneration.get(listId) !== generation) return
      const ids = new Set(payload.map((card) => String(card._id)))
      for (const [id, entry] of cardCommitted) {
        if (entry.listId === String(listId) && !ids.has(id)) cardCommitted.delete(id)
      }
      for (const card of payload) rememberCommitted(card, listId)
      set((s) => ({
        cards: { ...s.cards, [listId]: payload }
      }))
    } catch {
      //silent
    }
  },

  createCard: async (listId, cardData) => {
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    get().pushUndoSnapshot()
    try {
      const res = await axios.post(
        `${API_BASE_URL}/projects-api/lists/${listId}/cards`,
        cardData,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      const newCard = res.data.payload
      rememberCommitted(newCard, listId)
      //socket will broadcast, but add locally too to avoid flicker
      set((s) => {
        const existing = s.cards[listId] || []
        if (existing.some((c) => c._id === newCard._id)) return {}
        return { cards: { ...s.cards, [listId]: [...existing, newCard] } }
      })
      invalidateCardFetches(listId)
      await get().persistCardOrder(listId)
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      return newCard
    } catch {
      return null
    }
  },

  updateCard: async (cardId, data) => {
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    const baseline = committedFor(cardId) || findCardEntry(get().cards, cardId)
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
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      const updated = res.data.payload
      rememberCommitted(updated)
      if (cardMutationGeneration.get(cardId) === mutation) {
        set((s) => ({
          cards: upsertCardInState(s, updated),
          cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
        }))
        invalidateCardFetches()
      }
      return updated
    } catch {
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      if (cardMutationGeneration.get(cardId) === mutation) {
        // Restore the newest server-confirmed card, not the snapshot taken when
        // this mutation started: a concurrent successful update must not be
        // rolled back by a later failure.
        const restore = committedFor(cardId) || baseline
        set((s) => ({
          ...(restoreCardInState(s, cardId, restore) || {}),
          cardSavingIds: { ...s.cardSavingIds, [cardId]: false }
        }))
      }
      return null
    }
  },

  uploadCardAttachment: async (cardId, file) => {
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    beginCardMutation(cardId)
    try {
      const body = new FormData()
      body.append('attachment', file)

      const res = await axios.post(
        `${API_BASE_URL}/projects-api/cards/${cardId}/attachments`,
        body,
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      const updated = res.data.payload
      // An attachment response may be older than a title/description edit. It
      // owns only the attachment collection, never the whole card.
      if (!Array.isArray(updated?.attachment)) return updated
      set((s) => {
        const newCards = { ...s.cards }
        for (const [lid, listCards] of Object.entries(newCards)) {
          const idx = listCards.findIndex((c) => c._id === cardId)
          if (idx !== -1) {
            newCards[lid] = [...listCards]
            newCards[lid][idx] = { ...listCards[idx], attachment: updated.attachment }
            break
          }
        }
        return { cards: newCards }
      })
      const committed = committedFor(cardId)
      if (committed?.card) rememberCommitted({ ...committed.card, attachment: updated.attachment }, committed.listId)
      return updated
    } catch {
      return null
    }
  },

  deleteCard: async (cardId, listId) => {
    const epoch = getAccountEpoch()
    const session = getBoardSession()
    get().pushUndoSnapshot()
    invalidateCardFetches(listId)
    const baseline = committedFor(cardId) || findCardEntry(get().cards, cardId)
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
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      cardCommitted.delete(String(cardId))
      invalidateCardFetches(listId)
      await get().persistCardOrder(listId)
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      return true
    } catch {
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return false
      if (cardMutationGeneration.get(cardId) === mutation) {
        const restore = committedFor(cardId) || baseline
        set((s) => ({
          ...(restoreCardInState(s, cardId, restore) || {}),
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
    const session = getBoardSession()
    const move = beginCardMove(cardId)
    try {
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/cards/${cardId}`,
        { ...data, listId: toListId },
        { withCredentials: true }
      )
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
      const moved = res.data.payload || null
      if (moved && cardMoveGeneration.get(cardId) === move) rememberCommitted(moved)
      invalidateCardFetches()
      await get().persistCardOrder(toListId)
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return
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
    const session = getBoardSession()
    const orderedIds = (get().cards[listId] || []).map((card) => card._id)
    try {
      await axios.put(
        `${API_BASE_URL}/projects-api/lists/${listId}/cards/reorder`,
        { orderedIds },
        { withCredentials: true }
      )
      return isAccountEpochCurrent(epoch) && isBoardSessionCurrent(session)
    } catch {
      if (!isAccountEpochCurrent(epoch) || !isBoardSessionCurrent(session)) return false
      // Reconcile against the server's committed order instead of leaving the
      // failed optimistic order visible.
      await get().fetchCards(listId)
      return false
    }
  }
})
