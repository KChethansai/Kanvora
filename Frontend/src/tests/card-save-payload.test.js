// Card save payload.
//
// A card save must carry only the fields the user actually changed: the
// server applies the submitted fields with $set, so a field the user did not
// touch overwrites a concurrent change made by another member with a stale
// value.
import { describe, expect, it } from 'vitest'
import {
  cardSaveBaseline,
  cardSaveChanges,
  cardSaveCurrent
} from '../utils/cardSavePayload'

const card = {
  _id: 'card-1',
  title: 'Original title',
  description: 'Original description',
  richDescription: 'Original description',
  dueDate: '2026-10-30T00:00:00.000Z',
  priority: 'MEDIUM',
  labels: [{ text: 'Todo', color: 'blue' }],
  estimatedMinutes: 30,
  recurring: { enabled: false, interval: 'NONE', nextRunAt: null },
  subtasks: [{ title: 'Sub', completed: false }],
  checklists: [{ title: 'Steps', items: [{ title: 'One', completed: false }] }],
  memberIds: [{ _id: 'user-1' }]
}

describe('card save payload', () => {
  it('sends nothing when the user changed nothing', () => {
    const baseline = cardSaveBaseline(card)
    const current = cardSaveCurrent({
      title: card.title,
      desc: card.description,
      richDescription: card.richDescription,
      dueDate: '2026-10-30',
      priority: card.priority,
      labels: card.labels,
      estimatedMinutes: card.estimatedMinutes,
      recurring: card.recurring,
      subtasks: card.subtasks,
      checklists: card.checklists,
      assignedMemberIds: ['user-1']
    })

    expect(cardSaveChanges(baseline, current)).toEqual({})
  })

  it('sends only the field the user edited', () => {
    const baseline = cardSaveBaseline(card)
    const current = cardSaveCurrent({
      title: 'Edited title',
      desc: card.description,
      richDescription: card.richDescription,
      dueDate: '2026-10-30',
      priority: card.priority,
      labels: card.labels,
      estimatedMinutes: card.estimatedMinutes,
      recurring: card.recurring,
      subtasks: card.subtasks,
      checklists: card.checklists,
      assignedMemberIds: ['user-1']
    })

    expect(cardSaveChanges(baseline, current)).toEqual({ title: 'Edited title' })
  })

  it('sends a field the user cleared', () => {
    const baseline = cardSaveBaseline(card)
    const current = cardSaveCurrent({
      title: card.title,
      desc: '',
      richDescription: '',
      dueDate: '2026-10-30',
      priority: card.priority,
      labels: card.labels,
      estimatedMinutes: card.estimatedMinutes,
      recurring: card.recurring,
      subtasks: card.subtasks,
      checklists: card.checklists,
      assignedMemberIds: ['user-1']
    })

    const changes = cardSaveChanges(baseline, current)
    expect(changes.description).toBe('')
    expect(changes.richDescription).toBe('')
  })

  it('does not treat an untouched empty estimate as a change', () => {
    const withoutEstimate = cardSaveBaseline({ ...card, estimatedMinutes: undefined })
    const current = cardSaveCurrent({
      title: card.title,
      desc: card.description,
      richDescription: card.richDescription,
      dueDate: '2026-10-30',
      priority: card.priority,
      labels: card.labels,
      estimatedMinutes: 0,
      recurring: card.recurring,
      subtasks: card.subtasks,
      checklists: card.checklists,
      assignedMemberIds: ['user-1']
    })

    expect(cardSaveChanges(withoutEstimate, current)).toEqual({})
  })

  it('sends the assignment when it changed and derives nothing else', () => {
    const baseline = cardSaveBaseline(card)
    const current = cardSaveCurrent({
      title: card.title,
      desc: card.description,
      richDescription: card.richDescription,
      dueDate: '2026-10-30',
      priority: card.priority,
      labels: card.labels,
      estimatedMinutes: card.estimatedMinutes,
      recurring: card.recurring,
      subtasks: card.subtasks,
      checklists: card.checklists,
      assignedMemberIds: ['user-1', 'user-2']
    })

    const changes = cardSaveChanges(baseline, current)
    expect(changes.memberIds).toEqual(['user-1', 'user-2'])
    expect(changes).not.toHaveProperty('memberId')
  })

  it('sends an emptied assignment', () => {
    const baseline = cardSaveBaseline(card)
    const current = cardSaveCurrent({
      title: card.title,
      desc: card.description,
      richDescription: card.richDescription,
      dueDate: '2026-10-30',
      priority: card.priority,
      labels: card.labels,
      estimatedMinutes: card.estimatedMinutes,
      recurring: card.recurring,
      subtasks: card.subtasks,
      checklists: card.checklists,
      assignedMemberIds: []
    })

    expect(cardSaveChanges(baseline, current).memberIds).toEqual([])
  })
})
