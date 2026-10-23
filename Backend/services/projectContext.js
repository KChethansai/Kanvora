// Read-only project context for the Kanvora Assistant.
//
// The model never decides whether a user may read a project: the caller passes
// the authenticated user id, and the existing project policy decides. Only a
// bounded, non-sensitive slice is serialised, and every value is treated as
// untrusted text.
import { findProject } from '../authorization/resources.js'
import { ListModel } from '../models/ListModel.js'
import { taskModel } from '../models/Taskmodel.js'

const MAX_LISTS = 10
const MAX_CARDS = 50
const MAX_TITLE_CHARS = 160
const MAX_CONTEXT_CHARS = 6000

// A card title is user-written text. Newlines and the angle brackets that
// delimit the data block are removed so a title cannot break out of the block,
// and control characters are dropped.
const cleanText = (value, limit = MAX_TITLE_CHARS) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/[<>]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, limit)

const formatDueDate = (value) => {
  if (!value) return 'no due date'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'no due date' : date.toISOString().slice(0, 10)
}

export const buildProjectContext = async ({ projectId, userId }) => {
  const project = await findProject(String(projectId), String(userId), 'read')
  // Fail closed: an unknown, deleted or unauthorized project yields no context
  // at all, and the caller reports that instead of guessing.
  if (!project) return null

  const [lists, cards, totalCards] = await Promise.all([
    ListModel.find({ projectId: project._id }).sort({ order: 1, _id: 1 }).limit(MAX_LISTS).select('title order').lean(),
    taskModel.find({ projectId: project._id, isActive: true })
      .sort({ order: 1, _id: 1 })
      .limit(MAX_CARDS)
      .select('title status dueDate priority listId memberIds')
      .populate('memberIds', 'name')
      .lean(),
    taskModel.countDocuments({ projectId: project._id, isActive: true })
  ])

  const listTitles = new Map(lists.map((list) => [String(list._id), cleanText(list.title, 80)]))
  const lines = []
  for (const card of cards) {
    const assignees = (card.memberIds || [])
      .map((member) => cleanText(member?.name, 80))
      .filter(Boolean)
      .slice(0, 3)
      .join(', ')
    lines.push(`- [${cleanText(card.status, 20) || 'TO-DO'}] ${cleanText(card.title)}` +
      ` | list: ${listTitles.get(String(card.listId)) || 'unknown'}` +
      ` | due: ${formatDueDate(card.dueDate)}` +
      ` | priority: ${cleanText(card.priority, 20) || 'none'}` +
      (assignees ? ` | assignees: ${assignees}` : ''))
  }

  let text = [
    `Project: ${cleanText(project.title || project.name, 200)}`,
    `Lists (${lists.length}${lists.length === MAX_LISTS ? ' shown, possibly truncated' : ''}):`,
    ...lists.map((list) => `- ${cleanText(list.title, 80)}`),
    `Cards (${cards.length} of ${totalCards} shown):`,
    ...lines
  ].join('\n')

  if (text.length > MAX_CONTEXT_CHARS) text = `${text.slice(0, MAX_CONTEXT_CHARS)}\n[context truncated]`
  const truncated = totalCards > cards.length || lists.length === MAX_LISTS || text.endsWith('[context truncated]')

  return {
    text,
    truncated,
    projectId: String(project._id),
    projectName: cleanText(project.title || project.name, 200),
    cardCount: cards.length,
    totalCards,
    listCount: lists.length
  }
}
