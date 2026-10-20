import { describe, expect, it } from 'vitest'
import { mergeOrdered, sortByOrder, upsertCardInState } from '../store/projectStoreUtils'

describe('realtime board convergence', () => {
  it('sorts server-ordered items numerically instead of by event arrival', () => {
    const items = [
      { _id: 'c', order: 2 },
      { _id: 'a', order: 0 },
      { _id: 'b', order: 1 }
    ]
    expect(sortByOrder(items).map((item) => item._id)).toEqual(['a', 'b', 'c'])
  })

  it('applies a reorder event even when local order fields are stale and keeps unsent extras', () => {
    const items = [
      { _id: 'a', order: 0 },
      { _id: 'b', order: 1 },
      { _id: 'new', order: 9 }
    ]
    const merged = mergeOrdered(items, ['b', 'a'])
    expect(merged.map((item) => item._id)).toEqual(['b', 'a', 'new'])
    expect(merged.map((item) => item.order)).toEqual([0, 1, 9])
  })

  it('moves a card between lists and re-sorts the destination by order', () => {
    const state = {
      cards: {
        source: [{ _id: 'moved', order: 0, listId: 'source' }],
        target: [
          { _id: 'later', order: 2, listId: 'target' },
          { _id: 'first', order: 0, listId: 'target' }
        ]
      }
    }
    const next = upsertCardInState(state, {
      _id: 'moved', listId: 'target', order: 1, title: 'Moved'
    })
    expect(next.source).toEqual([])
    expect(next.target.map((card) => card._id)).toEqual(['first', 'moved', 'later'])
    expect(next.target[1].title).toBe('Moved')
  })
})
