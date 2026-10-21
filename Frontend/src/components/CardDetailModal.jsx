import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import axios from 'axios'
import {
  BsX,
  BsCalendar,
  BsChatLeft,
  BsCheckSquare
} from 'react-icons/bs'
import toast from 'react-hot-toast'
import useDialogFocus from '../hooks/useDialogFocus'
import { API_BASE_URL } from '../config/api'
import {
  modalBackdrop,
  modalPanel,
  modalHeader,
  modalTitleInput,
  modalMutedText,
  modalSectionTitle,
  modalTextarea,
  modalPrimaryBtn,
  modalCancelBtn,
  projectMutedIconBtn,
  projectInput,
  projectStatusPillBase,
  projectStatusPillActive,
  dashboardMutedColor,
  dashboardBorderColor,
  dashboardTextColor
} from '../Styles/common'
import {
  STATUS_LABELS,
  PRIORITY_OPTIONS,
  RECURRING_OPTIONS,
  LABEL_COLOR_VALUES,
  getCardStatus,
  getNonStatusLabels,
  getStatusByText,
  getId,
  getMemberDisplayName,
  getCardMemberIds,
  getCardAssignedMembers,
  normalizeMember
} from '../utils/projectUtils'
import MemberAvatar from './MemberAvatar'
import { CardLabelsInput, CardLabelsList } from './CardLabels'
import CardAttachments from './CardAttachments'
import CardSubtasks from './CardSubtasks'
import CardChecklists from './CardChecklists'
import CardComments from './CardComments'
import CardActions from './CardActions'

export default function CardDetailModal({
  card,
  listTitle,
  onClose,
  onSave,
  onDelete,
  onStatusChange,
  onAttach,
  onTyping,
  typingUsers,
  currentUser,
  readOnly,
  members = [],
  onQuickUpdate,
  onCommentCountChange,
  initialShowMembers = false
}) {
  const [title, setTitle] = useState(card.title || '')
  const [desc, setDesc] = useState(card.description || '')
  const [richDescription, setRichDescription] = useState(
    card.richDescription || card.description || ''
  )
  const [dueDate, setDueDate] = useState(
    card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : ''
  )
  const [priority, setPriority] = useState(card.priority || 'MEDIUM')
  const [labelText, setLabelText] = useState('')
  const [labels, setLabels] = useState(card.labels || [])
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    card.estimatedMinutes || 0
  )
  const [recurring, setRecurring] = useState(
    card.recurring || { enabled: false, interval: 'NONE', nextRunAt: null }
  )
  const [subtasks, setSubtasks] = useState(card.subtasks || [])
  const [checklists, setChecklists] = useState(card.checklists || [])
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState(card.comments || [])
  const [saving, setSaving] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [postingComment, setPostingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editText, setEditText] = useState('')
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showLabels] = useState(true)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newChecklistItemTitles, setNewChecklistItemTitles] = useState({})
  const [selectedLabelColor, setSelectedLabelColor] = useState(
    LABEL_COLOR_VALUES[0]
  )
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const fileInputRef = useRef(null)
  const typingTimer = useRef(null)
  const dialogRef = useDialogFocus(true, onClose)
  const activeStatus = getCardStatus(card)
  const nonStatusLabels = getNonStatusLabels(labels)
  const memberList = members.map(normalizeMember).filter(Boolean)
  const [assignedMemberIds, setAssignedMemberIds] = useState(() =>
    getCardMemberIds(card)
  )

  const assignedMembers = useMemo(
    () =>
      assignedMemberIds
        .map(
          (id) =>
            memberList.find((member) => getId(member) === id) ||
            getCardAssignedMembers(card, memberList).find(
              (member) => getId(member) === id
            )
        )
        .filter(Boolean),
    [assignedMemberIds, memberList, card]
  )

  const toggleAssignedMember = useCallback((memberId) => {
    setAssignedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    )
  }, [])
  const visibleTypingUsers = Object.values(typingUsers || {}).filter(
    (user) => (user._id || user.id) !== currentUser?._id
  )

  useEffect(() => {
    const loadComments = async () => {
      setCommentsLoading(true)
      try {
        const res = await axios.get(`${API_BASE_URL}/api/comment/${card._id}`, {
          withCredentials: true
        })
        const nextComments = res.data.payload || []
        setComments(nextComments)
        // Defer parent update to avoid "update during render" warning
        if (onCommentCountChange) {
          queueMicrotask(() => {
            onCommentCountChange(card._id, nextComments.length)
          })
        }
      } catch {
        setComments([])
      } finally {
        setCommentsLoading(false)
      }
    }

    loadComments()
    // NOTE: onCommentCountChange intentionally omitted from deps — including it
    // causes an infinite loop: the callback updating parent state rebuilds its
    // reference each render, which re-fires this effect endlessly (429 errors).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card._id])

  useEffect(() => {
    if (initialShowMembers) setShowMembers(true)
  }, [initialShowMembers])

  useEffect(() => {
    setAssignedMemberIds(getCardMemberIds(card))
    // Refresh only when the edited card changes, not on every socket patch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card._id])

  const handleAttachImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Only JPG and PNG images are allowed')
      e.target.value = ''
      return
    }
    setAttaching(true)
    await onAttach(card._id, file)
    setAttaching(false)
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    const saved = await onSave?.(card._id, {
      title: title.trim(),
      description: desc,
      richDescription,
      dueDate: dueDate || null,
      priority,
      labels,
      estimatedMinutes: Number(estimatedMinutes) || 0,
      recurring,
      subtasks,
      checklists: checklists.filter((checklist) =>
        checklist.title?.trim() || checklist.items?.length
      ),
      memberIds: assignedMemberIds,
      memberId: assignedMemberIds[0] || null
    })
    setSaving(false)
    // A rejected save must not discard the edits the user just made.
    if (saved === false) return
    onClose()
  }

  const handleTyping = () => {
    if (readOnly || !onTyping) return
    onTyping(card._id, true)
    window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => {
      onTyping(card._id, false)
    }, 900)
  }

  const addLabel = () => {
    if (!labelText.trim()) return
    const nextLabels = [
      ...nonStatusLabels,
      { text: labelText.trim(), color: selectedLabelColor }
    ]
    setLabels([
      ...labels.filter((label) => getStatusByText(label.text)),
      ...nextLabels
    ])
    onQuickUpdate?.(card._id, {
      labels: [
        ...labels.filter((label) => getStatusByText(label.text)),
        ...nextLabels
      ]
    })
    setLabelText('')
  }

  const removeLabel = (index) => {
    const statusLabels = labels.filter((label) => getStatusByText(label.text))
    const nextNonStatus = nonStatusLabels.filter((_, idx) => idx !== index)
    const nextLabels = [...statusLabels, ...nextNonStatus]
    setLabels(nextLabels)
    onQuickUpdate?.(card._id, { labels: nextLabels })
  }

  const addComment = async () => {
    if (!commentText.trim()) return
    setPostingComment(true)
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/comment`,
        { taskId: card._id, body: commentText.trim() },
        { withCredentials: true }
      )
      const nextComments = [res.data.payload, ...comments]
      setComments(nextComments)
      onCommentCountChange?.(card._id, nextComments.length)
      setCommentText('')
      toast.success('Comment added')
    } catch {
      toast.error('Could not add comment')
    } finally {
      setPostingComment(false)
    }
  }

  const deleteComment = async (commentId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/comment/${commentId}`, {
        withCredentials: true
      })
      const nextComments = comments.filter(
        (comment) => comment._id !== commentId
      )
      setComments(nextComments)
      onCommentCountChange?.(card._id, nextComments.length)
      toast.success('Comment deleted')
    } catch {
      toast.error('Could not delete comment')
    }
  }

  const updateComment = async (commentId) => {
    if (!editText.trim()) return
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/comment/${commentId}`,
        { body: editText.trim() },
        { withCredentials: true }
      )
      const updatedComment = res.data.payload
      setComments(
        comments.map((c) => (c._id === commentId ? updatedComment : c))
      )
      setEditingCommentId(null)
      setEditText('')
      toast.success('Comment updated')
    } catch {
      toast.error('Could not update comment')
    }
  }

  const handleDateChange = async (value) => {
    setDueDate(value)
    const updated = await onQuickUpdate?.(card._id, { dueDate: value || null })
    if (updated) toast.success(value ? 'Due date updated' : 'Due date cleared')
  }

  const handleCommentChange = (e) => {
    const value = e.target.value
    setCommentText(value)
    handleTyping()

    const lastAtPos = value.lastIndexOf('@')
    if (lastAtPos !== -1) {
      const query = value.slice(lastAtPos + 1).split(/\s/)[0]
      setMentionQuery(query)
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (username) => {
    const lastAtPos = commentText.lastIndexOf('@')
    const start = commentText.slice(0, lastAtPos)
    const rest = commentText.slice(lastAtPos + 1).split(/\s/)
    rest.shift() // remove the partial query
    const end = rest.join(' ')
    setCommentText(`${start}@${username} ${end}`)
    setShowMentions(false)
  }

  return (
    <div
      className={modalBackdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className={modalPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-heading"
        tabIndex={-1}
      >
        <h2 id="card-detail-heading" className="sr-only">
          Card details: {title || 'Untitled card'}
        </h2>
        {/* header */}
        <div className={`${modalHeader} shrink-0`}>
          <div className="flex-1">
            {readOnly ? (
              <div className="text-lg font-semibold text-white mb-2">
                {title}
              </div>
            ) : (
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Card title"
                data-autofocus
                className={modalTitleInput}
                rows={2}
              />
            )}
            <p className={`${modalMutedText} mt-1`}>
              in list <span className="underline">{listTitle}</span>
            </p>
            {readOnly && (
              <p className={`text-sm ${dashboardMutedColor} mt-2`}>
                This card is in view-only mode. Editing is disabled.
              </p>
            )}
          </div>
          <div className="mt-1 flex shrink-0 items-start gap-2">
            {assignedMembers.length > 0 && (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && setShowMembers(true)}
                aria-label={
                  readOnly
                    ? `Assigned members: ${assignedMembers.map(getMemberDisplayName).join(', ')}`
                    : 'Change assigned members'
                }
                className={`flex flex-col items-center gap-1 rounded-lg p-1 transition-colors ${
                  readOnly ? 'cursor-default' : 'hover:bg-white/5'
                }`}
                title={
                  readOnly
                    ? assignedMembers.map(getMemberDisplayName).join(', ')
                    : 'Change assigned members'
                }
              >
                <div className="flex -space-x-2">
                  {assignedMembers.slice(0, 3).map((member) => (
                    <MemberAvatar
                      key={getId(member)}
                      member={member}
                      size="sm"
                      className="ring-2 ring-[#111111]"
                    />
                  ))}
                </div>
                {assignedMembers.length > 3 && (
                  <span className="text-[10px] text-[#a1a1aa]">
                    +{assignedMembers.length - 3}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close card details"
              className={projectMutedIconBtn}
            >
              <BsX className="text-xl" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto app-scrollbar">
          <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
            {/* main content */}
            <div className="flex-1">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <BsChatLeft className={`${dashboardMutedColor} text-sm`} />
                  <h3 className={modalSectionTitle}>Description</h3>
                </div>
                <textarea
                  value={desc}
                  onChange={(e) => {
                    setDesc(e.target.value)
                    handleTyping()
                  }}
                  placeholder="Add a more detailed description..."
                  aria-label="Description"
                  rows={4}
                  className={modalTextarea}
                  readOnly={readOnly}
                />
                <textarea
                  value={richDescription}
                  onChange={(e) => {
                    setRichDescription(e.target.value)
                    handleTyping()
                  }}
                  placeholder="Rich notes, acceptance criteria, links, or @mentions..."
                  aria-label="Rich description"
                  rows={5}
                  className={`${modalTextarea} mt-3`}
                  readOnly={readOnly}
                />
                {visibleTypingUsers.length > 0 && (
                  <p className={`mt-2 text-xs ${dashboardMutedColor}`}>
                    {visibleTypingUsers.map((user) => user.name).join(', ')}{' '}
                    typing...
                  </p>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <BsCheckSquare className={`${dashboardMutedColor} text-sm`} />
                  <h3 className={modalSectionTitle}>Status</h3>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_LABELS.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => !readOnly && onStatusChange(card, status)}
                      disabled={readOnly}
                      aria-pressed={activeStatus?.id === status.id}
                      className={`${projectStatusPillBase} ${status.pill} ${
                        activeStatus?.id === status.id
                          ? projectStatusPillActive
                          : ''
                      } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {status.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <label className={`text-xs ${dashboardMutedColor}`}>
                  Due date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    readOnly={readOnly}
                    className={`${projectInput} mt-1`}
                  />
                </label>
                <label className={`text-xs ${dashboardMutedColor}`}>
                  Priority
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    disabled={readOnly}
                    className={`${projectInput} mt-1`}
                  >
                    {PRIORITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`text-xs ${dashboardMutedColor}`}>
                  Estimate
                  <input
                    type="number"
                    min="0"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    readOnly={readOnly}
                    className={`${projectInput} mt-1`}
                    placeholder="Minutes"
                  />
                </label>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <label className={`text-xs ${dashboardMutedColor}`}>
                  Recurrence
                  <select
                    value={recurring.interval || 'NONE'}
                    onChange={(e) =>
                      setRecurring({
                        ...recurring,
                        enabled: e.target.value !== 'NONE',
                        interval: e.target.value
                      })
                    }
                    disabled={readOnly}
                    className={`${projectInput} mt-1`}
                  >
                    {RECURRING_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <CardLabelsInput
                  labelText={labelText}
                  setLabelText={setLabelText}
                  showLabels={showLabels}
                  selectedLabelColor={selectedLabelColor}
                  setSelectedLabelColor={setSelectedLabelColor}
                  addLabel={addLabel}
                  readOnly={readOnly}
                />
              </div>

              <CardLabelsList
                labels={labels}
                nonStatusLabels={nonStatusLabels}
                removeLabel={removeLabel}
                readOnly={readOnly}
              />

              {card.dueDate && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BsCalendar className={`${dashboardMutedColor} text-sm`} />
                    <h3 className={modalSectionTitle}>Due Date</h3>
                  </div>
                  <span className={`text-sm ${dashboardTextColor}`}>
                    {new Date(card.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}

              <CardAttachments attachments={card.attachment} />

              <CardSubtasks
                cardId={card._id}
                subtasks={subtasks}
                setSubtasks={setSubtasks}
                newSubtaskTitle={newSubtaskTitle}
                setNewSubtaskTitle={setNewSubtaskTitle}
                onQuickUpdate={onQuickUpdate}
                readOnly={readOnly}
              />

              <CardChecklists
                cardId={card._id}
                checklists={checklists}
                setChecklists={setChecklists}
                newChecklistItemTitles={newChecklistItemTitles}
                setNewChecklistItemTitles={setNewChecklistItemTitles}
                onQuickUpdate={onQuickUpdate}
                readOnly={readOnly}
              />

              <CardComments
                cardId={card._id}
                comments={comments}
                commentsLoading={commentsLoading}
                currentUser={currentUser}
                commentText={commentText}
                setCommentText={setCommentText}
                showMentions={showMentions}
                mentionQuery={mentionQuery}
                memberList={memberList}
                postingComment={postingComment}
                addComment={addComment}
                deleteComment={deleteComment}
                updateComment={updateComment}
                insertMention={insertMention}
                handleCommentChange={handleCommentChange}
                editingCommentId={editingCommentId}
                setEditingCommentId={setEditingCommentId}
                editText={editText}
                setEditText={setEditText}
                readOnly={readOnly}
              />
            </div>

            <CardActions
              card={card}
              readOnly={readOnly}
              showMembers={showMembers}
              setShowMembers={setShowMembers}
              assignedMemberIds={assignedMemberIds}
              memberList={memberList}
              assignedMembers={assignedMembers}
              toggleAssignedMember={toggleAssignedMember}
              fileInputRef={fileInputRef}
              handleAttachImage={handleAttachImage}
              showDatePicker={showDatePicker}
              setShowDatePicker={setShowDatePicker}
              dueDate={dueDate}
              handleDateChange={handleDateChange}
              attaching={attaching}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
              onDelete={onDelete}
              onClose={onClose}
              projectInput={projectInput}
            />
          </div>
        </div>

        <div
          className={`shrink-0 px-6 pt-5 pb-6 flex gap-3 border-t ${dashboardBorderColor}`}
        >
          {!readOnly ? (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className={modalPrimaryBtn}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={onClose} className={modalCancelBtn}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className={modalPrimaryBtn}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
