import { statusLabelStyles, scrimText, successInk } from '../Styles/common'

export const TEMPLATE_CATEGORIES = [
  'Business',
  'Personal',
  'Education',
  'Engineering',
  'Marketing',
  'HR & Operations'
]

export const STATUS_LABELS = [
  { id: 'todo', ...statusLabelStyles.todo },
  { id: 'inProgress', ...statusLabelStyles.inProgress },
  { id: 'done', ...statusLabelStyles.done }
]

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low', className: 'bg-slate-500/20 text-slate-200' },
  {
    value: 'MEDIUM',
    label: 'Medium',
    className: 'bg-blue-500/20 text-blue-200'
  },
  { value: 'HIGH', label: 'High', className: 'bg-amber-500/20 text-amber-200' },
  { value: 'URGENT', label: 'Urgent', className: 'bg-red-500/20 text-red-200' }
]

export const RECURRING_OPTIONS = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']

export const blankChecklist = { title: 'Checklist', items: [] }

export const LABEL_COLOR_VALUES = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
  'pink',
  'gray'
]

// A label chip paints its own saturated fill, so the fill does not follow the
// theme - and the ink therefore must not either: a themed ink would repaint
// the chip with the theme foreground and fail in one theme. Each entry pairs a
// Tailwind fill with a fixed ink (scrim white or the fixed status ink) that
// clears WCAG AA (4.5:1) for the 12px chip text in both themes.
//
// A 500 shade is kept wherever one of the two inks clears 4.5:1 on it. Where
// neither does, the neighbouring 600 shade is used instead of the 500, so the
// palette stays recognisable without collapsing two colours into one.
export const LABEL_COLOR_STYLES = {
  red: { fill: 'bg-red-600', ink: scrimText },
  orange: { fill: 'bg-orange-500', ink: successInk },
  yellow: { fill: 'bg-yellow-500', ink: successInk },
  green: { fill: 'bg-green-500', ink: successInk },
  blue: { fill: 'bg-blue-600', ink: scrimText },
  violet: { fill: 'bg-violet-600', ink: scrimText },
  pink: { fill: 'bg-pink-700', ink: scrimText },
  gray: { fill: 'bg-gray-500', ink: scrimText }
}

export const avatarClasses = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-slate-500'
]

export const avatarGradients = [
  'from-rose-500 to-orange-400',
  'from-violet-500 to-fuchsia-500',
  'from-sky-500 to-cyan-400',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-yellow-400',
  'from-indigo-500 to-blue-500',
  'from-pink-500 to-rose-400',
  'from-slate-500 to-zinc-400'
]

const avatarHash = (name = '') =>
  name.split('').reduce((total, char) => total + char.charCodeAt(0), 0)

export const getPriorityMeta = (priority = 'MEDIUM') =>
  PRIORITY_OPTIONS.find((item) => item.value === priority) ||
  PRIORITY_OPTIONS[1]

export const normalizeStatusText = (value = '') =>
  value.toLowerCase().replace(/[\s_-]+/g, '')

export const getStatusByText = (value = '') =>
  STATUS_LABELS.find(
    (status) =>
      normalizeStatusText(status.title) === normalizeStatusText(value) ||
      normalizeStatusText(status.label) === normalizeStatusText(value) ||
      normalizeStatusText(status.listTitle) === normalizeStatusText(value)
  )

export const getCardStatus = (card) =>
  card?.labels?.map((label) => getStatusByText(label.text)).find(Boolean) ||
  null

export const getNonStatusLabels = (labels = []) =>
  labels.filter((label) => !getStatusByText(label.text))

// The chip classes carry the ink as well as the fill: the pair has to travel
// together, otherwise a themed foreground leaks onto a fixed saturated fill.
// There is deliberately no fill-only helper - it is the trap this map removes.
export const getLabelChipClass = (color) => {
  const style = LABEL_COLOR_STYLES[color] || LABEL_COLOR_STYLES.gray
  return `${style.fill} ${style.ink}`
}

export const getId = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return (
    value._id?.toString() || value.id?.toString() || value.toString?.() || ''
  )
}

export const getInitials = (name = 'User') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'

export const getAvatarClass = (name = '') =>
  avatarClasses[avatarHash(name) % avatarClasses.length]

export const getAvatarGradient = (name = '') =>
  avatarGradients[avatarHash(name) % avatarGradients.length]

export const getMemberDisplayName = (member) =>
  member?.name || member?.email || 'User'

export const getCardMemberIds = (card) => {
  if (Array.isArray(card?.memberIds) && card.memberIds.length > 0) {
    return card.memberIds
      .map((entry) => getId(entry))
      .filter(Boolean)
  }
  const single = getId(card?.memberId)
  return single ? [single] : []
}

export const getCardAssignedMembers = (card, memberList = []) => {
  const populated = Array.isArray(card?.memberIds)
    ? card.memberIds.filter((entry) => entry && typeof entry === 'object')
    : []
  if (populated.length > 0) return populated
  if (card?.memberId && typeof card.memberId === 'object') return [card.memberId]

  const ids = getCardMemberIds(card)
  return ids
    .map((id) => memberList.find((member) => getId(member) === id))
    .filter(Boolean)
}

export const formatShortDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const getDueDateMeta = (date) => {
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(date)
  due.setHours(0, 0, 0, 0)
  if (due < today) return 'bg-red-500/20 text-red-300'
  if (due.getTime() === today.getTime()) return 'bg-amber-500/20 text-amber-300'
  return 'text-[#a1a1aa] bg-black/20' // dashboardMutedColor is text-[#a1a1aa]
}

export const timeAgo = (dateStr) => {
  if (!dateStr) return 'Recently'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.max(0, Math.floor(diff / 60000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export const normalizeMember = (member) => member?.user || member
