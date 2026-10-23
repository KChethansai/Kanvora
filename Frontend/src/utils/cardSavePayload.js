// Card save payload.
//
// A card save must carry only the fields the user actually changed. The
// server applies the submitted fields with $set, so sending a field the user
// did not touch overwrites a concurrent change made by another member with a
// stale value. The server already accepts a partial body, so the fix belongs
// here rather than in a new server contract.
import { getCardMemberIds } from './projectUtils'

const sameValue = (left, right) => {
  if (left === right) return true
  if (left === null || right === null || left === undefined || right === undefined) {
    return (left ?? null) === (right ?? null)
  }
  if (typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => sameValue(left[key], right[key]))
}

const sameMembers = (left = [], right = []) => {
  if (left.length !== right.length) return false
  const a = [...left].map(String).sort()
  const b = [...right].map(String).sort()
  return a.every((value, index) => value === b[index])
}

// A date the server cannot parse is treated as absent. The editor must never
// fail to open because a card carries an unusable date.
const isoDate = (value) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

// The card as it was when the editor opened. It is the baseline a change is
// measured against: the live card may already have been changed by somebody
// else, and that change must not be mistaken for the user's own edit.
export const cardSaveBaseline = (card = {}) => ({
  title: card.title || '',
  description: card.description || '',
  richDescription: card.richDescription || card.description || '',
  // The server accepts null for an absent date and rejects an empty string,
  // so the baseline uses the same shape the editor sends. A date the server
  // cannot parse is treated as absent rather than throwing.
  dueDate: card.dueDate ? isoDate(card.dueDate) : null,
  priority: card.priority || 'MEDIUM',
  labels: card.labels || [],
  estimatedMinutes: card.estimatedMinutes || 0,
  recurring: card.recurring || { enabled: false, interval: 'NONE', nextRunAt: null },
  subtasks: card.subtasks || [],
  checklists: card.checklists || [],
  memberIds: getCardMemberIds(card)
})

// The values the editor would save, in the same shape as the baseline.
export const cardSaveCurrent = ({
  title = '',
  desc = '',
  richDescription = '',
  dueDate = null,
  priority = 'MEDIUM',
  labels = [],
  estimatedMinutes = 0,
  recurring = { enabled: false, interval: 'NONE', nextRunAt: null },
  subtasks = [],
  checklists = [],
  assignedMemberIds = []
} = {}) => ({
  title: title.trim(),
  description: desc,
  richDescription,
  dueDate,
  priority,
  labels,
  estimatedMinutes: Number(estimatedMinutes) || 0,
  recurring,
  subtasks,
  checklists: checklists.filter((checklist) =>
    checklist?.title?.trim() || checklist?.items?.length
  ),
  memberIds: assignedMemberIds
})

// A checklist title the server will refuse.
//
// The server requires at least one non-whitespace character in every checklist
// title and validates the whole array, so a single blank title rejects the
// entire card save. The client used to keep such a checklist whenever it had
// items, which is exactly the payload the server refuses.
//
// A blank title is invalid even when the checklist has no items. The editor
// filters an itemless blank checklist out of the payload, which would `$set`
// the array without it and delete it from the card with no warning. There is
// no delete-checklist control, so blocking the save is the only behaviour that
// does not lose data.
export const checklistTitleError = (checklists = []) =>
  (checklists || []).findIndex((checklist) => !String(checklist?.title || '').trim())

// The fields the user changed. An empty result means there is nothing to save.
export const cardSaveChanges = (baseline, current) => {
  const changes = {}
  if (current.title !== baseline.title) changes.title = current.title
  if (current.description !== baseline.description) changes.description = current.description
  if (current.richDescription !== baseline.richDescription) {
    changes.richDescription = current.richDescription
  }
  if (current.dueDate !== baseline.dueDate) changes.dueDate = current.dueDate
  if (current.priority !== baseline.priority) changes.priority = current.priority
  if (!sameValue(current.labels, baseline.labels)) changes.labels = current.labels
  if (current.estimatedMinutes !== baseline.estimatedMinutes) {
    changes.estimatedMinutes = current.estimatedMinutes
  }
  if (!sameValue(current.recurring, baseline.recurring)) changes.recurring = current.recurring
  if (!sameValue(current.subtasks, baseline.subtasks)) changes.subtasks = current.subtasks
  if (!sameValue(current.checklists, baseline.checklists)) changes.checklists = current.checklists
  // The server derives memberId from memberIds, so only the array is sent.
  if (!sameMembers(current.memberIds, baseline.memberIds)) changes.memberIds = current.memberIds
  return changes
}
