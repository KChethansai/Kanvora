import { memo, useState, useEffect, useRef } from 'react'
import {
  BsX,
  BsCalendar,
  BsPaperclip,
  BsCheckSquare,
  BsChat,
  BsClock,
  BsGripVertical
} from 'react-icons/bs'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  cardDeleteBtn,
  cardMetaText,
  cardOverlay,
  cardSurface,
  cardText,
  projectInput,
  projectMutedIconBtn,
  projectPrimarySmallBtn,
  projectTextarea,
  dashboardTextColor
} from '../Styles/common'
import {
  getCardStatus,
  getPriorityMeta,
  getDueDateMeta,
  getNonStatusLabels,
  getLabelColorClass,
  getMemberDisplayName,
  getCardAssignedMembers,
  formatShortDate,
  PRIORITY_OPTIONS
} from '../utils/projectUtils'
import MemberAvatar from './MemberAvatar'

export const SortableCard = memo(function SortableCard({
  card,
  listId,
  onDelete,
  onOpen,
  isEditable
}) {
  const sortableId = `card:${card._id}`
  const status = getCardStatus(card)
  const priority = getPriorityMeta(card.priority)
  const assignedMembers = getCardAssignedMembers(card)
  const commentCount = card.commentCount ?? card.comments?.length ?? 0
  const dueMeta = getDueDateMeta(card.dueDate)
  const nonStatusLabels = getNonStatusLabels(card.labels || [])
  const checklistTotal = (card.checklists || []).reduce(
    (total, checklist) => total + (checklist.items?.length || 0),
    0
  )
  const checklistDone = (card.checklists || []).reduce(
    (total, checklist) =>
      total + (checklist.items || []).filter((item) => item.completed).length,
    0
  )
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: sortableId,
    data: { type: 'card', cardId: card._id, listId },
    disabled: !isEditable
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 180ms ease, opacity 160ms ease',
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'pointer'
  }

  const showPriority =
    card.priority && card.priority !== 'MEDIUM' && card.priority !== 'NONE'
  const hasMeta =
    card.dueDate ||
    card.attachment?.length ||
    commentCount ||
    card.estimatedMinutes ||
    checklistTotal

  // chip style shared by all meta badges
  const chip = `${cardMetaText} mt-0 inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/[0.07] px-2 py-1`

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-card-id={card._id}
      className={cardSurface}
    >
      {/* cover image */}
      {(card.coverImage?.url || card.attachment?.[0]?.url) && (
        <img
          src={card.coverImage?.url || card.attachment[0].url}
          alt=""
          className="mb-3 h-24 w-full rounded-lg object-cover"
        />
      )}

      {/* hover action buttons */}
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {isEditable && <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
          aria-label={`Move card ${card.title}`} className={`${cardDeleteBtn} touch-none cursor-grab focus-visible:opacity-100`}><BsGripVertical aria-hidden="true" /></button>}
        {isEditable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(card._id, listId)
            }}
            className={`${cardDeleteBtn} focus-visible:opacity-100`}
            aria-label={`Delete card ${card.title}`}
          >
            <BsX aria-hidden="true" />
          </button>
        )}
      </div>

      {/* labels — above title for visual hierarchy */}
      {nonStatusLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {nonStatusLabels.map((label, i) => (
            <span
              key={i}
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold on-scrim ${getLabelColorClass(label.color)}`}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}

      {/* title */}
      <button type="button" onClick={() => onOpen(card)} aria-label={`Open card ${card.title}`}
        className={`${cardText} block w-full text-left pr-16 line-clamp-2 after:absolute after:inset-0 after:content-['']`}>
        {card.title}
      </button>

      {/* status badge (only when no label already covers status) */}
      {!card.labels?.length && status && (
        <div className="mt-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${status.badge}`}
          >
            {status.title}
          </span>
        </div>
      )}

      {/* bottom row: meta chips + priority + avatar */}
      {(showPriority ||
        card.recurring?.enabled ||
        hasMeta ||
        assignedMembers.length > 0) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {/* left: chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {showPriority && (
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold ${priority.className}`}
              >
                {priority.label}
              </span>
            )}
            {card.recurring?.enabled && (
              <span className={chip}>{card.recurring.interval}</span>
            )}
            {card.dueDate && (
              <span className={`${chip} ${dueMeta}`}>
                <BsCalendar className="text-[10px]" />
                {formatShortDate(card.dueDate)}
              </span>
            )}
            {card.attachment?.length > 0 && (
              <span className={chip}>
                <BsPaperclip className="text-[10px]" />
                {card.attachment.length}
              </span>
            )}
            {card.estimatedMinutes > 0 && (
              <span className={chip}>
                <BsClock className="text-[10px]" />
                {card.estimatedMinutes}m
              </span>
            )}
            {checklistTotal > 0 && (
              <span className={chip}>
                <BsCheckSquare className="text-[10px]" />
                {checklistDone}/{checklistTotal}
              </span>
            )}
            {commentCount > 0 && (
              <span className={chip}>
                <BsChat className="text-[10px]" />
                {commentCount}
              </span>
            )}
          </div>

          {/* right: assigned avatar */}
          {assignedMembers.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpen(card, { showMembers: true })
              }}
              aria-label={`Assigned members for ${card.title}`}
              className="relative z-10 flex shrink-0 items-center rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4d67]/50"
              title={`${assignedMembers.map(getMemberDisplayName).join(', ')} — open card to change`}
            >
              <div className="flex -space-x-1.5">
                {assignedMembers.slice(0, 3).map((member) => (
                  <MemberAvatar
                    key={member._id || member.id || member.email}
                    member={member}
                    size="sm"
                    className="ring-2 ring-[#18181b]"
                  />
                ))}
              </div>
              {assignedMembers.length > 3 && (
                <span className="ml-1 text-[10px] font-medium text-[#a1a1aa]">
                  +{assignedMembers.length - 3}
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
})

export function DragCard({ card, width }) {
  return (
    <div
      className={`${cardOverlay} scale-[1.03]`}
      style={width ? { width } : undefined}
      aria-hidden="true"
    >
      <p className={`text-sm ${dashboardTextColor}`}>{card.title}</p>
    </div>
  )
}

export function AddCardForm({ listId, onAdd, onCancel }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onCancel])

  const handleAdd = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    await onAdd(listId, {
      title: title.trim(),
      dueDate: dueDate || null,
      priority
    })
    setSubmitting(false)
    setTitle('')
  }

  return (
    <div ref={formRef} className="mt-2">
      <textarea
        aria-label="Card title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleAdd()
          }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Enter a title for this card..."
        rows={2}
        autoFocus
        className={projectTextarea}
      />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <input
          aria-label="Due date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={projectInput}
        />
        <select
          aria-label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={projectInput}
        >
          {PRIORITY_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting || !title.trim()}
          className={projectPrimarySmallBtn}
        >
          {submitting ? 'Adding...' : 'Add card'}
        </button>
        <button type="button" onClick={onCancel} aria-label="Cancel adding card" className={projectMutedIconBtn}>
          <BsX className="text-lg" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
