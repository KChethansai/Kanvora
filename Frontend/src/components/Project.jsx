import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { BsPlusLg, BsArrowLeft, BsChevronDown, BsFlag } from 'react-icons/bs'
import toast from 'react-hot-toast'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { useProjectStore } from '../store/projectStore'
import { useAuth } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { getAccountEpoch, isAccountEpochCurrent } from '../utils/accountEpoch'
import {
  addListButton,
  projectCanvas,
  projectFallbackBg,
  projectHeader,
  projectHeaderTitle,
  projectListRow,
  projectStatusPillBase,
  dashboardMutedColor
} from '../Styles/common'
import {
  STATUS_LABELS,
  normalizeStatusText,
  getStatusByText,
  getNonStatusLabels,
  getId,
  getInitials,
  getAvatarClass,
  normalizeMember
} from '../utils/projectUtils'

// Import Split Components
import PublishForm from './PublishForm'
import CardDetailModal from './CardDetailModal'
import { DragCard } from './Card'
import { ListColumn, AddListForm } from './ListColumn'

function Project() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const {
    activeProject,
    lists,
    cards,
    loading,
    fetchProject,
    fetchLists,
    fetchCards,
    resetBoard,
    createList,
    createCard,
    deleteCard,
    deleteList,
    updateList,
    updateCard,
    uploadCardAttachment,
    setActiveProject,
    projects,
    moveCard,
    moveCardBetweenLists,
    reorderLists,
    reorderCardsInList,
    persistCardOrder,
    joinProject,
    leaveProject,
    activeUsers,
    typingUsers,
    activityFeed,
    emitTyping,
    emitActivity
  } = useProjectStore()
  const { currentUser } = useAuth()
  const { activeWorkspace, fetchWorkspace } = useWorkspaceStore()

  const [showAddList, setShowAddList] = useState(false)
  const [activeCard, setActiveCard] = useState(null)
  const [modalCard, setModalCard] = useState(null)
  const [modalFocusMembers, setModalFocusMembers] = useState(false)

  const handleOpenCard = useCallback((card, options = {}) => {
    setModalCard(card)
    setModalFocusMembers(Boolean(options.showMembers))
  }, [])

  const handleCloseCard = useCallback(() => {
    setModalCard(null)
    setModalFocusMembers(false)
  }, [])
  const [localLists, setLocalLists] = useState([])
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, right: 0 })
  const [statusFilter, setStatusFilter] = useState(null)
  const statusBtnRef = useRef(null)
  const [bgFailed, setBgFailed] = useState(false)
  const [dragOverlayWidth, setDragOverlayWidth] = useState(null)
  const dragStartListId = useRef(null)
  const addListButtonRef = useRef(null)
  const boardTotals = useMemo(
    () => ({
      lists: localLists.length,
      cards: Object.values(cards).reduce(
        (total, items) => total + items.length,
        0
      )
    }),
    [cards, localLists.length]
  )

  useEffect(() => {
    setLocalLists(lists)
  }, [lists])

  useEffect(() => {
    const workspaceId = getId(activeProject?.workspace)

    if (workspaceId) {
      fetchWorkspace(workspaceId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?._id])

  useEffect(() => {
    setBgFailed(false)
  }, [activeProject?.img])

  useEffect(() => {
    if (!activeProject?.img) return
    const image = new Image()
    image.onload = () => setBgFailed(false)
    image.onerror = () => setBgFailed(true)
    image.src = activeProject.img
  }, [activeProject?.img])

  const projectMembers = useMemo(() => {
    const projectMemberMap = new Map(
      (activeProject?.members || [])
        .map(normalizeMember)
        .filter(Boolean)
        .map((member) => [getId(member), member])
    )
    const workspaceMembers = (activeWorkspace?.members || [])
      .map((member) => member.user || member)
      .filter(Boolean)
    workspaceMembers.forEach((member) => {
      if (!projectMemberMap.has(getId(member))) {
        projectMemberMap.set(getId(member), member)
      }
    })
    if (activeProject?.creatorId) {
      const creator = normalizeMember(activeProject.creatorId)
      projectMemberMap.set(getId(creator), creator)
    }
    return [...projectMemberMap.values()].filter((member) => getId(member))
  }, [activeProject, activeWorkspace?.members])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const handler = (event) => {
      const target = event.target
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if (isTyping) return
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        addListButtonRef.current?.focus()
      }
      if (event.key === 'Escape' && modalCard) {
        handleCloseCard()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modalCard, handleCloseCard])

  //fetch project data and join socket room
  useEffect(() => {
    if (!projectId) return

    let mounted = true

    resetBoard()
    const loadProject = async () => {
      const epoch = getAccountEpoch()
      try {
        await fetchLists(projectId)

        if (!mounted || !isAccountEpochCurrent(epoch)) return

        const project = projects.find((b) => b._id === projectId)

        if (project) {
          setActiveProject(project)
        }

        await fetchProject(projectId)
        if (!mounted || !isAccountEpochCurrent(epoch)) return

        joinProject(projectId, currentUser)
      } catch {
        // Keep the empty board mounted; a later navigation or socket event retries.
      }
    }

    loadProject()

    return () => {
      mounted = false
      leaveProject(projectId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  //hydrate every visible list with its current cards
  useEffect(() => {
    if (!localLists.length) return

    localLists.forEach((list) => {
      if (!cards[list._id] || cards[list._id].length === 0) {
        fetchCards(list._id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localLists])

  const findListByCardId = useCallback(
    (cardId) => {
      for (const [listId, listCards] of Object.entries(cards)) {
        if (listCards?.some((c) => c._id === cardId)) return listId
      }
      return null
    },
    [cards]
  )

  const getOverListId = (over) => {
    const overData = over?.data.current
    if (!overData) return null
    if (overData.type === 'list' || overData.type === 'list-drop') {
      return overData.listId
    }
    if (overData.type === 'card') return overData.listId
    return null
  }

  const findStatusList = useCallback(
    (status, sourceLists = localLists) =>
      sourceLists.find(
        (list) =>
          normalizeStatusText(list.title) ===
          normalizeStatusText(status.listTitle)
      ),
    [localLists]
  )

  const orderStatusLists = useCallback(
    async (nextLists) => {
      const epoch = getAccountEpoch()
      const statusLists = STATUS_LABELS.map((status) =>
        nextLists.find(
          (list) =>
            normalizeStatusText(list.title) ===
            normalizeStatusText(status.listTitle)
        )
      ).filter(Boolean)
      const statusIds = statusLists.map((list) => list._id)
      const rest = nextLists.filter((list) => !statusIds.includes(list._id))
      const ordered = [...statusLists, ...rest]
      setLocalLists(ordered)
      await reorderLists(projectId, ordered)
      if (!isAccountEpochCurrent(epoch)) return
      return ordered
    },
    [projectId, reorderLists]
  )

  const ensureStatusList = useCallback(
    async (status) => {
      const epoch = getAccountEpoch()
      const existing = findStatusList(status)
      if (existing) return existing
      const created = await createList(projectId, status.listTitle)
      if (!isAccountEpochCurrent(epoch)) return
      if (!created) return null
      const nextLists = [...localLists, created]
      await orderStatusLists(nextLists)
      if (!isAccountEpochCurrent(epoch)) return
      return created
    },
    [projectId, createList, findStatusList, localLists, orderStatusLists]
  )


  // DnD handlers

  const handleDragStart = ({ active }) => {
    const data = active.data.current
    if (data?.type === 'card') {
      const cardId = data.cardId
      const listId = data.listId || findListByCardId(cardId)
      const card = cards[listId]?.find((c) => c._id === cardId)
      const node = document.querySelector(`[data-card-id="${cardId}"]`)
      setDragOverlayWidth(node?.getBoundingClientRect().width || null)
      dragStartListId.current = listId
      setActiveCard(card)
    } else {
      dragStartListId.current = null
      setActiveCard(null)
      setDragOverlayWidth(null)
    }
  }

  const handleDragOver = ({ active, over }) => {
    if (!over) return
    const activeData = active.data.current
    if (activeData?.type !== 'card') return

    const cardId = activeData.cardId
    const activeListId = findListByCardId(cardId)
    const overListId = getOverListId(over)
    if (!activeListId || !overListId) return

    if (activeListId === overListId && over.data.current?.type === 'card') {
      const listCards = cards[activeListId] || []
      const activeIndex = listCards.findIndex((card) => card._id === cardId)
      const overIndex = listCards.findIndex(
        (card) => card._id === over.data.current.cardId
      )
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        reorderCardsInList(
          activeListId,
          arrayMove(listCards, activeIndex, overIndex)
        )
      }
      return
    }

    if (activeListId !== overListId) {
      const overCards = cards[overListId] || []
      const overIndex =
        over.data.current?.type === 'card'
          ? overCards.findIndex((card) => card._id === over.data.current.cardId)
          : overCards.length
      moveCardBetweenLists(cardId, activeListId, overListId, overIndex)
    }
  }

  const handleDragEnd = async ({ active, over }) => {
    const epoch = getAccountEpoch()
    setActiveCard(null)
    setDragOverlayWidth(null)

    const activeData = active.data.current
    if (!activeData) return
    if (!over) {
      if (activeData.type === 'card' && dragStartListId.current) {
        const currentListId = findListByCardId(activeData.cardId)
        if (currentListId && currentListId !== dragStartListId.current) {
          moveCardBetweenLists(activeData.cardId, currentListId, dragStartListId.current)
        }
      }
      return
    }

    if (activeData.type === 'list') {
      const overData = over.data.current
      if (overData?.type !== 'list') return
      const activeIndex = localLists.findIndex(
        (list) => list._id === activeData.listId
      )
      const overIndex = localLists.findIndex(
        (list) => list._id === overData.listId
      )
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
        return
      }
      const nextLists = arrayMove(localLists, activeIndex, overIndex)
      setLocalLists(nextLists)
      await reorderLists(projectId, nextLists)
      return
    }

    if (activeData.type === 'card') {
      const cardId = activeData.cardId
      const startListId = dragStartListId.current
      const finalListId = findListByCardId(cardId)
      if (!finalListId) return
      const finalList = localLists.find((list) => list._id === finalListId)
      const finalStatus = getStatusByText(finalList?.title)
      const finalCard = cards[finalListId]?.find((card) => card._id === cardId)

      // Build card patch based on whether the list has a status or not
      let cardPatch = {}
      if (finalCard) {
        if (finalStatus) {
          // If the list has a status, update with that status
          cardPatch = {
            labels: [
              ...getNonStatusLabels(finalCard.labels),
              { text: finalStatus.label, color: finalStatus.color }
            ],
            status: finalStatus.taskStatus
          }
        } else {
          // A custom list owns no status; keep every unrelated label.
          cardPatch = {
            labels: getNonStatusLabels(finalCard.labels),
            status: null
          }
        }
      }

      if (Object.keys(cardPatch).length > 0) {
        moveCardBetweenLists(cardId, finalListId, finalListId, null, cardPatch)
      }

      if (startListId && startListId !== finalListId) {
        const moved = await moveCard(cardId, finalListId, {
          ...cardPatch,
          order: (cards[finalListId] || []).findIndex((card) => card._id === cardId)
        })
        if (!isAccountEpochCurrent(epoch)) return
        if (!moved) {
          moveCardBetweenLists(cardId, finalListId, startListId)
          await fetchCards(startListId)
          if (!isAccountEpochCurrent(epoch)) return
          await fetchCards(finalListId)
          if (!isAccountEpochCurrent(epoch)) return
          toast.error('Could not move card')
          return
        }
        await persistCardOrder(startListId)
        if (!isAccountEpochCurrent(epoch)) return
      } else if (Object.keys(cardPatch).length > 0) {
        // Same-list card PUTs reject `order`. Commit the drop via the reorder
        // endpoint first, so the status response also contains the dropped order.
        const reordered = await persistCardOrder(finalListId)
        if (!isAccountEpochCurrent(epoch)) return
        if (!reordered) {
          await fetchCards(finalListId)
          if (!isAccountEpochCurrent(epoch)) return
          toast.error('Could not save card order')
          return
        }
        const updated = await updateCard(cardId, cardPatch)
        if (!isAccountEpochCurrent(epoch)) return
        if (!updated) {
          await fetchCards(finalListId)
          if (!isAccountEpochCurrent(epoch)) return
          toast.error('Could not update card')
          return
        }
        return
      }
      await persistCardOrder(finalListId)
    }
  }

  // Event handlers

  const handleAddList = async (title) => {
    const epoch = getAccountEpoch()
    const list = await createList(projectId, title)
    if (!isAccountEpochCurrent(epoch)) return
    if (!list) {
      toast.error('Could not add list')
      return
    }
    setShowAddList(false)
    toast.success('List added!')
  }

  const handleAddCard = async (listId, cardData) => {
    const epoch = getAccountEpoch()
    const list = localLists.find((l) => l._id === listId)
    const status = getStatusByText(list?.title)

    const finalData = { ...cardData }
    if (status) {
      finalData.labels = [{ text: status.label, color: status.color }]
      finalData.status = status.taskStatus
    }

    const card = await createCard(listId, finalData)
    if (!isAccountEpochCurrent(epoch)) return
    if (!card) {
      toast.error('Could not add card')
      return
    }
    await persistCardOrder(listId)
    if (!isAccountEpochCurrent(epoch)) return
    toast.success('Card added!')
  }

  const handleDeleteCard = async (cardId, listId) => {
    const epoch = getAccountEpoch()
    const deleted = await deleteCard(cardId, listId)
    if (!isAccountEpochCurrent(epoch)) return
    if (!deleted) {
      toast.error('Could not delete card')
      return false
    }
    toast.success('Card deleted')
    return true
  }

  const handleDeleteList = async (listId) => {
    const epoch = getAccountEpoch()
    const deleted = await deleteList(listId)
    if (!isAccountEpochCurrent(epoch)) return
    if (!deleted) {
      toast.error('Could not delete list')
      return false
    }
    toast.success('List deleted')
    return true
  }

  const handleUpdateList = async (listId, data) => {
    const epoch = getAccountEpoch()
    const updated = await updateList(listId, data)
    if (!isAccountEpochCurrent(epoch)) return
    if (!updated) toast.error('Could not update list')
    return updated
  }

  const handleSaveCard = async (cardId, data) => {
    const epoch = getAccountEpoch()
    const updated = await updateCard(cardId, data)
    if (!isAccountEpochCurrent(epoch)) return
    if (!updated) {
      toast.error('Could not update card')
      return
    }
    emitActivity(projectId, {
      type: 'card-updated',
      cardId,
      actorId: currentUser?._id,
      message: `${currentUser?.name || 'Someone'} updated a card`
    })
    toast.success('Card updated')
  }

  const patchLocalCard = useCallback(
    (cardId, patch) => {
      const listId = findListByCardId(cardId)
      if (!listId) return
      const card = cards[listId]?.find((item) => item._id === cardId)
      if (!card) return
      moveCardBetweenLists(cardId, listId, listId, null, patch)
      if (modalCard?._id === cardId) {
        setModalCard((current) =>
          current ? { ...current, ...patch } : current
        )
      }
    },
    [cards, findListByCardId, modalCard?._id, moveCardBetweenLists]
  )

  const handleQuickUpdateCard = useCallback(
    async (cardId, data) => {
      const epoch = getAccountEpoch()
      const updated = await updateCard(cardId, data)
      if (!isAccountEpochCurrent(epoch)) return
      if (!updated) {
        toast.error('Could not update card')
        return null
      }
      patchLocalCard(cardId, updated)
      return updated
    },
    [patchLocalCard, updateCard]
  )

  const handleCommentCountChange = useCallback(
    (cardId, count) => {
      patchLocalCard(cardId, { commentCount: count })
    },
    [patchLocalCard]
  )

  const handleTyping = useCallback(
    (cardId, typing) => {
      emitTyping({ projectId, cardId, user: currentUser, typing })
    },
    [currentUser, emitTyping, projectId]
  )

  const handleAttachCardImage = async (cardId, file) => {
    const epoch = getAccountEpoch()
    const updated = await uploadCardAttachment(cardId, file)
    if (!isAccountEpochCurrent(epoch)) return
    if (!updated) {
      toast.error('Could not upload image')
      return
    }
    setModalCard(updated)
    toast.success('Image attached')
  }

  const handleCardStatusChange = async (card, status) => {
    const epoch = getAccountEpoch()
    const targetList = await ensureStatusList(status)
    if (!isAccountEpochCurrent(epoch)) return
    const fromListId = findListByCardId(card._id) || card.listId?.toString()
    if (!targetList || !fromListId) {
      toast.error('Could not resolve status list')
      return
    }

    const labels = [
      ...getNonStatusLabels(card.labels),
      { text: status.label, color: status.color }
    ]
    const cardPatch = { labels, status: status.taskStatus }
    const nextCard = { ...card, ...cardPatch, listId: targetList._id }

    moveCardBetweenLists(card._id, fromListId, targetList._id, null, {
      ...cardPatch
    })
    setModalCard(nextCard)
    const moved = await moveCard(card._id, targetList._id, cardPatch)
    if (!isAccountEpochCurrent(epoch)) return
    if (!moved) {
      if (fromListId !== targetList._id) {
        moveCardBetweenLists(card._id, targetList._id, fromListId)
      }
      await fetchCards(fromListId)
      if (!isAccountEpochCurrent(epoch)) return
      if (targetList._id !== fromListId) await fetchCards(targetList._id)
      if (!isAccountEpochCurrent(epoch)) return
      setModalCard(card)
      toast.error('Could not move card')
      return
    }
    if (fromListId !== targetList._id) await persistCardOrder(fromListId)
    if (!isAccountEpochCurrent(epoch)) return
    await persistCardOrder(targetList._id)
    if (!isAccountEpochCurrent(epoch)) return
    toast.success(`Moved to ${status.title}`)
  }

  const handleListStatusChange = async (list, status) => {
    const epoch = getAccountEpoch()
    const updated = await updateList(list._id, { title: status.listTitle })
    if (!isAccountEpochCurrent(epoch)) return
    if (!updated) {
      toast.error('Could not update list status')
      return
    }
    const nextLists = localLists.map((item) =>
      item._id === list._id
        ? { ...item, ...updated, title: status.listTitle }
        : item
    )
    await orderStatusLists(nextLists)
    if (!isAccountEpochCurrent(epoch)) return
    toast.success(`List set as ${status.title}`)
  }

  const handlePublishSave = (updatedProject) => {
    setActiveProject(updatedProject)
    setShowPublishModal(false)
  }

  // The server owns authorization. Capabilities are recomputed from current
  // workspace policy and archive state for every project response.
  const canEdit = activeProject?.capabilities?.edit === true
  const canManage = activeProject?.capabilities?.manage === true
  const readOnlyMode = !canEdit

  const projectBg =
    activeProject?.img && !bgFailed
      ? ''
      : activeProject?.color
        ? `bg-linear-to-br ${activeProject.color}`
        : projectFallbackBg
  const projectStyle =
    activeProject?.img && !bgFailed
      ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.2)), url(${activeProject.img})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }
      : undefined

  return (
    <div
      className={`flex flex-col h-screen ${projectBg} overflow-hidden`}
      style={projectStyle}
    >
      {/* project header */}
      <div className={projectHeader}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/main-page')}
            className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.13] border border-white/[0.08] text-white/70 hover:text-white text-xs font-medium transition-colors"
          >
            <BsArrowLeft /> Back
          </button>
          {/* divider */}
          <span className="h-4 w-px bg-white/10" />
          <h1 className={projectHeaderTitle}>
            {activeProject?.title || 'Project'}
          </h1>
          <span className={`text-xs ${dashboardMutedColor} hidden sm:inline`}>
            {boardTotals.cards} cards · {boardTotals.lists} lists
          </span>
          {!canEdit && (
            <span className="rounded-full bg-white/[0.08] border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-[#a1a1aa]">
              View-only
            </span>
          )}
          {activeProject?.isPublished && (
            <span className="rounded-full bg-[#ff4d67]/10 border border-[#ff4d67]/30 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-[#ff8aa0]">
              Published
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* ── Project Status dropdown ── */}
          <div>
            <button
              ref={statusBtnRef}
              type="button"
              onClick={() => {
                if (!showStatusMenu && statusBtnRef.current) {
                  const rect = statusBtnRef.current.getBoundingClientRect()
                  setStatusMenuPos({
                    top: rect.bottom + 8,
                    right: window.innerWidth - rect.right
                  })
                }
                setShowStatusMenu((prev) => !prev)
              }}
              className={`flex items-center gap-1.5 px-3 h-7 rounded-lg border text-xs font-medium transition-colors ${
                statusFilter
                  ? statusFilter.pill
                  : 'bg-white/[0.08] border-white/[0.08] text-white hover:bg-white/[0.13]'
              }`}
              aria-label="Project status labels"
            >
              <BsFlag
                style={statusFilter ? { color: statusFilter.color } : undefined}
                className={!statusFilter ? 'text-[#a3a3ad]' : ''}
              />
              Project Status
              <BsChevronDown
                className={`transition-transform duration-200 text-[#a3a3ad] ${
                  showStatusMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showStatusMenu &&
              createPortal(
                <>
                  {/* full-screen backdrop — rendered in body, above everything */}
                  <div
                    className="fixed inset-0 z-[9998]"
                    onClick={() => setShowStatusMenu(false)}
                  />
                  {/* panel — fixed to viewport coords computed from button rect */}
                  <div
                    className="animate-enter fixed z-[9999] w-56 rounded-xl border border-white/[0.08] bg-[#0e1114] shadow-2xl backdrop-blur-2xl overflow-hidden"
                    style={{ top: statusMenuPos.top, right: statusMenuPos.right }}
                  >
                  {/* header row inside dropdown */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.07]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#a3a3ad]">
                      Project Status
                    </span>
                    <span className="text-[10px] text-[#a3a3ad]">
                      {boardTotals.lists}L · {boardTotals.cards}C
                    </span>
                  </div>

                  {/* show-all row — visible only when a filter is active */}
                  {statusFilter && (
                    <div className="border-b border-white/[0.07] p-2 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter(null)
                          setShowStatusMenu(false)
                        }}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#a3a3ad] hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <span className="h-2 w-2 rounded-full bg-white/30 shrink-0" />
                        Show all lists
                      </button>
                    </div>
                  )}

                  {/* status pills */}
                  <div className="flex flex-col gap-1 p-2">
                    {STATUS_LABELS.map((status) => (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => {
                          ensureStatusList(status)
                          setStatusFilter((prev) =>
                            prev?.id === status.id ? null : status
                          )
                          setShowStatusMenu(false)
                        }}
                        className={`${projectStatusPillBase} ${status.pill} w-full justify-start ${
                          statusFilter?.id === status.id
                            ? 'ring-2 ring-white/30'
                            : ''
                        }`}
                        title={`Show only ${status.title} list`}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: status.color }}
                        />
                        {status.title}
                        {statusFilter?.id === status.id && (
                          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider opacity-70">
                            active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* view-only notice */}
                  {!canEdit && (
                    <div className="border-t border-white/[0.07] px-3 py-2 text-[10px] text-[#a3a3ad]">
                      View-only — editing disabled
                    </div>
                  )}

                  {/* latest activity */}
                  {activityFeed.length > 0 && (
                    <div className="border-t border-white/[0.07] px-3 py-2 text-[10px] text-[#a3a3ad] truncate">
                      {activityFeed[0].message || 'Board activity updated'}
                    </div>
                  )}
                  </div>
                </>,
                document.body
              )}
          </div>

          {/* active users */}
          {activeUsers.length > 0 ? (
            <div className="hidden items-center gap-1 sm:flex">
              {activeUsers.slice(0, 4).map((user) => (
                <span
                  key={user.socketId || user._id}
                  title={user.name}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#ff4d67] text-xs font-bold text-white"
                >
                  {(user.name || 'U').slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
          ) : activeProject?.creatorId ? (
            <span
              title={activeProject.creatorId.name || 'Creator online'}
              className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-white ${getAvatarClass(activeProject.creatorId.name || activeProject.creatorId.email)}`}
            >
              {getInitials(
                activeProject.creatorId.name || activeProject.creatorId.email
              )}
              <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
            </span>
          ) : null}

          {/* publish button — project managers only */}
          {canManage && (
            <button
              type="button"
              onClick={() => setShowPublishModal(true)}
              className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium bg-[#ff4d67]/15 hover:bg-[#ff4d67]/25 border border-[#ff4d67]/30 text-[#ff8aa0] transition-colors"
            >
              {activeProject?.isPublished ? 'Edit Publish' : 'Publish'}
            </button>
          )}


        </div>
      </div>

      {/* lists area */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className={projectCanvas}>
          <div className={projectListRow}>
            {loading ? (
              <div className="flex gap-4 p-2">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-[70vh] w-72 shrink-0 animate-pulse rounded-xl bg-[#101418]/80 p-3"
                  >
                    <div className="mb-4 h-5 w-2/3 rounded bg-white/10" />
                    <div className="mb-3 h-24 rounded-lg bg-white/10" />
                    <div className="mb-3 h-20 rounded-lg bg-white/10" />
                    <div className="h-28 rounded-lg bg-white/10" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {localLists.length === 0 && !showAddList && (
                  <div className="flex h-40 w-80 shrink-0 flex-col justify-center rounded-xl border border-dashed border-white/20 bg-black/20 px-5 text-sm text-white/80">
                    <p className="font-semibold text-white">No lists yet</p>
                    <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
                      Add a list to start organizing cards.
                    </p>
                  </div>
                )}
                {/* SortableContext keeps ALL list IDs so DnD state is intact */}
                <SortableContext
                  items={localLists.map((list) => `list:${list._id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  {localLists
                    .filter((list) =>
                      statusFilter
                        ? normalizeStatusText(list.title) ===
                          normalizeStatusText(statusFilter.listTitle)
                        : true
                    )
                    .map((list) => (
                      <ListColumn
                        key={list._id}
                        list={list}
                        cards={cards[list._id]}
                        onAddCard={handleAddCard}
                        onDeleteCard={handleDeleteCard}
                        onDeleteList={handleDeleteList}
                        onOpenCard={handleOpenCard}
                        onQuickUpdate={handleQuickUpdateCard}
                        onUpdateList={handleUpdateList}
                        onStatusList={handleListStatusChange}
                        isEditable={canEdit}
                      />
                    ))}
                </SortableContext>

                {showAddList ? (
                  <AddListForm
                    onAdd={handleAddList}
                    onCancel={() => setShowAddList(false)}
                  />
                ) : canEdit ? (
                  <button
                    ref={addListButtonRef}
                    onClick={() => setShowAddList(true)}
                    className={addListButton}
                  >
                    <BsPlusLg className="text-xs" /> Add another list
                  </button>
                ) : (
                  <div
                    className={`flex items-center gap-2 mx-2 mb-2 px-3 py-2 rounded-lg border border-[#27272a] text-xs ${dashboardMutedColor}`}
                  >
                    This board is view-only. Lists cannot be added.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <DragCard card={activeCard} width={dragOverlayWidth} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* card detail modal */}
      {modalCard && (
        <CardDetailModal
          card={modalCard}
          listTitle={
            localLists.find(
              (l) =>
                l._id ===
                (modalCard.listId?.toString() ||
                  findListByCardId(modalCard._id))
            )?.title || 'List'
          }
          onClose={handleCloseCard}
          initialShowMembers={modalFocusMembers}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onStatusChange={handleCardStatusChange}
          onAttach={handleAttachCardImage}
          onTyping={handleTyping}
          typingUsers={typingUsers[modalCard._id]}
          currentUser={currentUser}
          members={projectMembers}
          onQuickUpdate={handleQuickUpdateCard}
          onCommentCountChange={handleCommentCountChange}
          readOnly={readOnlyMode}
        />
      )}

      {/* publish modal */}
      {showPublishModal && (
        <PublishForm
          project={activeProject}
          onClose={() => setShowPublishModal(false)}
          onSave={handlePublishSave}
        />
      )}
    </div>
  )
}

export default Project
