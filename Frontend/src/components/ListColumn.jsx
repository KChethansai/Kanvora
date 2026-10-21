import { memo, useState, useEffect, useRef } from 'react'
import {
  BsPlusLg,
  BsX,
  BsThreeDots,
  BsChevronDown,
  BsChevronUp,
  BsGripVertical
} from 'react-icons/bs'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import toast from 'react-hot-toast'
import {
  addListPanel,
  errorClass,
  listColumnBase,
  listColumnDefault,
  listDropZone,
  listDropZoneOver,
  listHeader,
  listIconButton,
  listMenu,
  listMenuDanger,
  listMenuItem,
  listTitle,
  listTitleInput,
  projectInput,
  projectMutedIconBtn,
  projectPrimarySmallBtn,
  dashboardMutedColor,
  dashboardBorderColor,
  dashboardSurfaceColor
} from '../Styles/common'
import { STATUS_LABELS, getStatusByText } from '../utils/projectUtils'
import { SortableCard, AddCardForm } from './Card'

export const ListColumn = memo(function ListColumn({
  list,
  cards,
  onAddCard,
  onDeleteCard,
  onDeleteList,
  onOpenCard,
  onQuickUpdate,
  onUpdateList,
  onStatusList,
  onMoveList,
  canMoveLeft = false,
  canMoveRight = false,
  isEditable
}) {
  const [showAddCard, setShowAddCard] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(list.title)
  const [savingTitle, setSavingTitle] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const menuRef = useRef(null)
  const menuButtonRef = useRef(null)
  const listStatus = getStatusByText(list.title)

  useEffect(() => {
    setTitleVal(list.title)
  }, [list.title])

  useEffect(() => {
    if (!showMenu) return
    // The menu takes focus when it opens, like the other menus in the app.
    menuRef.current?.querySelector('[role="menuitem"]')?.focus()
  }, [showMenu])

  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target)
      ) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const {
    attributes,
    listeners,
    setNodeRef: setListNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `list:${list._id}`,
    data: { type: 'list', listId: list._id },
    disabled: !isEditable
  })

  const { setNodeRef, isOver } = useDroppable({
    id: `list-drop:${list._id}`,
    data: { type: 'list-drop', listId: list._id }
  })

  const cardIds = (cards || []).map((c) => `card:${c._id}`)
  const saveTitle = async () => {
    const nextTitle = titleVal.trim()
    if (!nextTitle || nextTitle === list.title) {
      setTitleVal(list.title)
      setEditingTitle(false)
      return
    }
    setSavingTitle(true)
    const updated = await onUpdateList(list._id, { title: nextTitle })
    setSavingTitle(false)
    if (!updated) {
      setTitleVal(list.title)
      toast.error('Could not update list title')
      return
    }
    setEditingTitle(false)
  }
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 180ms ease, opacity 160ms ease',
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setListNodeRef}
      style={style}
      className={`${listColumnBase} transition-all duration-300 ease-in-out ${
        listStatus?.list || listColumnDefault
      } ${collapsed ? 'max-h-14 overflow-hidden' : 'max-h-[2000px]'}`}
    >
      {/* list header */}
      <div className={listHeader}>
        {isEditable && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder list ${list.title}`}
            className={`${listIconButton} mr-1 cursor-grab touch-none active:cursor-grabbing`}
          >
            <BsGripVertical aria-hidden="true" />
          </button>
        )}
        {editingTitle && isEditable ? (
          <input
            aria-label="List title"
            autoFocus
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') {
                setTitleVal(list.title)
                setEditingTitle(false)
              }
            }}
            className={listTitleInput}
          />
        ) : (
          <h3 className={listTitle}>
            <button type="button" disabled={!isEditable} aria-label={`Rename list ${list.title}`}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={() => setEditingTitle(true)}>{list.title}</button>
          </h3>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span
            className={`flex h-6 min-w-6 items-center justify-center rounded-full ${dashboardSurfaceColor} px-2 text-xs font-medium ${dashboardMutedColor} ${
              savingTitle ? 'animate-pulse' : ''
            }`}
          >
            <span aria-hidden="true">{(cards || []).length}</span>
            <span className="sr-only">{(cards || []).length} cards</span>
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed((value) => !value)
            }}
            className={listIconButton}
            aria-label={collapsed ? 'Expand list' : 'Collapse list'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <BsChevronDown aria-hidden="true" /> : <BsChevronUp aria-hidden="true" />}
          </button>

          <div className="relative">
            <button
              type="button"
              ref={menuButtonRef}
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu((v) => !v)
              }}
              className={listIconButton}
              aria-label={`List actions for ${list.title}`}
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              <BsThreeDots aria-hidden="true" />
            </button>

            {showMenu && (
              <div
                ref={menuRef}
                role="menu"
                aria-label={`List actions for ${list.title}`}
                className={listMenu}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setShowMenu(false)
                    menuButtonRef.current?.focus()
                    return
                  }
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')]
                    const index = items.indexOf(document.activeElement)
                    if (items.length === 0) return
                    e.preventDefault()
                    const delta = e.key === 'ArrowDown' ? 1 : -1
                    items[(index + delta + items.length) % items.length]?.focus()
                  }
                }}
              >
                {!isEditable ? (
                  <div className="p-3 text-sm text-[#d1d9e0]">
                    This board is view-only. List actions are disabled.
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAddCard(true)
                        setShowMenu(false)
                      }}
                      className={listMenuItem}
                    >
                      Add card
                    </button>
                    <div className={`my-1 border-t border-[#27272a]`} />
                    {STATUS_LABELS.map((status) => (
                      <button
                        key={status.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onStatusList(list, status)
                          setShowMenu(false)
                        }}
                        className={`${listMenuItem} flex items-center gap-2`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${status.badge}`}
                        />
                        Set as {status.title}
                      </button>
                    ))}
                    <div className={`my-1 border-t border-[#27272a]`} />
                    <button
                      type="button"
                      role="menuitem"
                      aria-disabled={!canMoveLeft}
                      onClick={() => {
                        if (!canMoveLeft) return
                        onMoveList?.(list._id, -1)
                        setShowMenu(false)
                      }}
                      className={`${listMenuItem} aria-disabled:cursor-not-allowed aria-disabled:opacity-40`}
                    >
                      Move list left
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      aria-disabled={!canMoveRight}
                      onClick={() => {
                        if (!canMoveRight) return
                        onMoveList?.(list._id, 1)
                        setShowMenu(false)
                      }}
                      className={`${listMenuItem} aria-disabled:cursor-not-allowed aria-disabled:opacity-40`}
                    >
                      Move list right
                    </button>
                    <div className={`my-1 border-t border-[#27272a]`} />
                    {confirmDelete ? (
                      <div className="px-3 py-2">
                        <p className={`mb-2 text-xs ${dashboardMutedColor}`}>
                          Are you sure? This deletes all cards.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onDeleteList(list._id)
                              setShowMenu(false)
                              setConfirmDelete(false)
                            }}
                            className={listMenuDanger}
                          >
                            Yes, delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className={listMenuItem}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => setConfirmDelete(true)}
                        className={listMenuDanger}
                      >
                        Delete list
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* cards drop zone */}
      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`${listDropZone} ${isOver ? listDropZoneOver : ''}`}
        >
          <SortableContext
            items={cardIds}
            strategy={verticalListSortingStrategy}
          >
            {(cards || []).length === 0 && !showAddCard && (
              isEditable ? (
                <button
                  type="button"
                  onClick={() => setShowAddCard(true)}
                  className={`rounded-lg border border-dashed ${dashboardBorderColor} ${dashboardMutedColor} px-3 py-6 text-center text-xs`}
                >
                  No cards yet — add one
                </button>
              ) : (
                <p className={`rounded-lg border border-dashed ${dashboardBorderColor} ${dashboardMutedColor} px-3 py-6 text-center text-xs`}>
                  No cards yet
                </p>
              )
            )}
            {(cards || []).map((card) => (
              <SortableCard
                key={card._id}
                card={card}
                listId={list._id}
                onDelete={onDeleteCard}
                onOpen={onOpenCard}
                onQuickUpdate={onQuickUpdate}
                isEditable={isEditable}
              />
            ))}
          </SortableContext>

          {showAddCard && isEditable && (
            <AddCardForm
              listId={list._id}
              onAdd={onAddCard}
              onCancel={() => setShowAddCard(false)}
            />
          )}
        </div>
      )}

      {/* add card button, only shown when editable */}
      {isEditable && !showAddCard && !collapsed && (
        <button
          type="button"
          onClick={() => setShowAddCard(true)}
          className={`flex items-center gap-1.5 mx-2 mb-2 px-2 py-1.5 rounded-lg text-xs ${dashboardMutedColor} hover:bg-[#18181b] hover:text-white transition-colors`}
        >
          <BsPlusLg className="text-xs" aria-hidden="true" /> Add a card
        </button>
      )}
    </div>
  )
})

export function AddListForm({ onAdd, onCancel }) {
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Guards a second submit while a request is in flight.
  const inFlight = useRef(false)

  const handleAdd = async () => {
    if (inFlight.current) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    inFlight.current = true
    setSubmitting(true)
    setError('')
    try {
      const created = await onAdd(trimmedTitle)
      // A rejected creation keeps the typed title so it can be retried.
      if (!created) {
        setError('List was not created. Check your connection and try again.')
        return
      }
      setTitle('')
    } catch {
      setError('List was not created. Check your connection and try again.')
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className={addListPanel}>
      <label htmlFor="new-list-title" className="sr-only">List title</label>
      <input
        id="new-list-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Enter list title..."
        autoFocus
        className={`${projectInput} mb-2`}
      />
      {error && (
        <p role="alert" className={`${errorClass} mb-2`}>
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting || !title.trim()}
          className={projectPrimarySmallBtn}
        >
          {submitting ? 'Adding...' : 'Add list'}
        </button>
        <button type="button" onClick={onCancel} aria-label="Cancel adding list" className={projectMutedIconBtn}>
          <BsX className="text-lg" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
