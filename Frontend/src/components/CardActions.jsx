import { useState } from 'react'
import { BsPersonPlus, BsPaperclip, BsCalendarCheck, BsTrash } from 'react-icons/bs'
import {
  dashboardMutedColor,
  modalActionBtn,
  dashboardBorderColor,
  dashboardSurfaceColor,
  modalDangerBtn
} from '../Styles/common'
import MemberAssignPanel from './MemberAssignPanel'

export default function CardActions({
  card,
  readOnly,
  showMembers,
  setShowMembers,
  assignedMemberIds,
  memberList,
  assignedMembers,
  toggleAssignedMember,
  fileInputRef,
  handleAttachImage,
  showDatePicker,
  setShowDatePicker,
  dueDate,
  handleDateChange,
  attaching,
  deleteConfirm,
  setDeleteConfirm,
  onDelete,
  onClose,
  projectInput
}) {
  const [deleting, setDeleting] = useState(false)

  return (
    // The sidebar holds a native date input, whose placeholder needs more
    // room than a single narrow column can give it.
    <div className="flex shrink-0 flex-col gap-2 lg:w-44">
      <p
        className={`text-xs font-semibold ${dashboardMutedColor} uppercase tracking-wide mb-1`}
      >
        Actions
      </p>
      <button
        type="button"
        className={`${modalActionBtn} ${showMembers ? 'border border-[#ff4d67]/40 bg-[#ff4d67]/10' : ''}`}
        onClick={() => !readOnly && setShowMembers((open) => !open)}
        disabled={readOnly}
        aria-expanded={showMembers}
      >
        <BsPersonPlus /> Members
        {assignedMemberIds.length > 0 && !showMembers && (
          <span className="ml-auto rounded-full bg-[#ff4d67]/20 px-1.5 text-[10px] font-semibold text-[#ff4d67]">
            {assignedMemberIds.length}
          </span>
        )}
      </button>
      {showMembers && (
        <div
          className={`rounded-lg border ${dashboardBorderColor} ${dashboardSurfaceColor} p-3`}
        >
          <p
            className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${dashboardMutedColor}`}
          >
            Assign members
          </p>
          <MemberAssignPanel
            memberList={memberList}
            assignedMemberIds={assignedMemberIds}
            assignedMembers={assignedMembers}
            readOnly={readOnly}
            onToggleMember={toggleAssignedMember}
          />
        </div>
      )}
      {!readOnly && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={modalActionBtn}
          >
            <BsPaperclip /> Attachment
          </button>
          <button
            type="button"
            onClick={() => setShowDatePicker((open) => !open)}
            className={modalActionBtn}
          >
            <BsCalendarCheck /> Dates
          </button>
          {showDatePicker && (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className={projectInput}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleAttachImage}
          />
          {attaching && (
            <p className={`text-[11px] ${dashboardMutedColor} px-1`}>
              Uploading image...
            </p>
          )}
          <hr className={`${dashboardBorderColor} my-1`} />
          {deleteConfirm ? (
            <div
              className={`rounded-lg border ${dashboardBorderColor} ${dashboardSurfaceColor} p-2`}
            >
              <p className={`mb-2 text-xs ${dashboardMutedColor}`}>
                Delete this card?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (deleting) return
                    setDeleting(true)
                    try {
                      // The modal stays open until the delete is confirmed.
                      const deleted = await onDelete?.(
                        card._id,
                        card.listId?.toString() || ''
                      )
                      if (deleted) onClose()
                    } finally {
                      setDeleting(false)
                    }
                  }}
                  disabled={deleting}
                  className={modalDangerBtn}
                >
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className={modalActionBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className={modalDangerBtn}
            >
              <BsTrash /> Delete
            </button>
          )}
        </>
      )}
    </div>
  )
}
