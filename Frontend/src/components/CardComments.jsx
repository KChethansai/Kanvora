import { BsChatLeft, BsTrash, BsReply } from 'react-icons/bs'
import {
  dashboardMutedColor,
  modalSectionTitle,
  dashboardBorderColor,
  dashboardSurfaceColor,
  dashboardTextColor,
  modalTextarea,
  projectPrimarySmallBtn,
  modalCancelBtn
} from '../Styles/common'
import { timeAgo, getId } from '../utils/projectUtils'

export default function CardComments({
  comments,
  commentsLoading,
  currentUser,
  commentText,
  setCommentText,
  showMentions,
  mentionQuery,
  memberList,
  postingComment,
  addComment,
  deleteComment,
  updateComment,
  insertMention,
  handleCommentChange,
  editingCommentId,
  setEditingCommentId,
  editText,
  setEditText,
  readOnly
}) {
  const renderCommentBody = (body) => {
    if (!body) return null
    const parts = body.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={i}
            className="font-bold text-[#ff4d67]"
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BsChatLeft className={`${dashboardMutedColor} text-sm`} />
        <h3 className={modalSectionTitle}>Comments</h3>
      </div>
      <div className="space-y-2">
        {commentsLoading ? (
          <div
            className={`rounded-lg border ${dashboardBorderColor} ${dashboardSurfaceColor} p-3 text-xs ${dashboardMutedColor}`}
          >
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div
            className={`rounded-lg border ${dashboardBorderColor} ${dashboardSurfaceColor} p-3 text-xs ${dashboardMutedColor}`}
          >
            No comments yet.
          </div>
        ) : (
          comments.map((comment) => {
            const commentAuthorId = getId(comment.author)
            const isOwn = commentAuthorId === currentUser?._id
            const isAdminOrManager = ['ADMIN', 'MANAGER'].includes(
              currentUser?.role
            )
            const canEditOrDelete = isOwn || isAdminOrManager

            const authorName =
              comment.author?.name || comment.authorName || 'Teammate'
            const isEditing = editingCommentId === comment._id

            return (
              <div
                key={comment._id || comment.createdAt}
                className={`rounded-lg border ${dashboardBorderColor} ${dashboardSurfaceColor} p-3`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold ${dashboardTextColor}`}
                    >
                      {authorName}
                    </p>
                    {isEditing ? (
                      <div className="mt-2">
                        <textarea
                          value={editText}
                          onChange={(e) =>
                            setEditText(e.target.value)
                          }
                          aria-label="Edit comment"
                          className={modalTextarea}
                          rows={2}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateComment(comment._id)}
                            className={projectPrimarySmallBtn}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(null)
                              setEditText('')
                            }}
                            className={modalCancelBtn}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={`mt-1 text-sm ${dashboardTextColor}`}
                      >
                        {renderCommentBody(comment.body)}
                      </p>
                    )}
                  </div>
                  {!readOnly && canEditOrDelete && !isEditing && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(comment._id)
                          setEditText(comment.body)
                        }}
                        className={`${dashboardMutedColor} hover:text-white`}
                        aria-label="Edit comment"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteComment(comment._id)}
                        className={`${dashboardMutedColor} hover:text-[#ff4d67]`}
                        aria-label="Delete comment"
                      >
                        <BsTrash />
                      </button>
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <div
                    className={`mt-2 flex items-center gap-3 text-xs ${dashboardMutedColor}`}
                  >
                    <span>{timeAgo(comment.createdAt)}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white"
                      onClick={() =>
                        setCommentText(
                          `${commentText}@${comment.author?.username || authorName} `
                        )
                      }
                    >
                      <BsReply /> Reply
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      {!readOnly && (
        <div className="mt-3 relative">
          {showMentions && (
            <div
              className={`absolute bottom-full mb-2 w-full max-h-32 overflow-y-auto rounded-lg border ${dashboardBorderColor} ${dashboardSurfaceColor} shadow-xl z-50`}
            >
              {memberList
                .filter((m) =>
                  (m.username || m.name || m.email)
                    .toLowerCase()
                    .includes(mentionQuery.toLowerCase())
                )
                .map((member) => (
                  <button
                    key={getId(member)}
                    type="button"
                    onClick={() =>
                      insertMention(
                        member.username ||
                          member.name.replace(/\s+/g, '')
                      )
                    }
                    className={`w-full text-left px-3 py-2 text-xs ${dashboardTextColor} hover:bg-white/10 transition-colors border-b last:border-0 ${dashboardBorderColor}`}
                  >
                    {member.name} (@{member.username || 'user'})
                  </button>
                ))}
              {memberList.filter((m) =>
                (m.username || m.name || m.email)
                  .toLowerCase()
                  .includes(mentionQuery.toLowerCase())
              ).length === 0 && (
                <div
                  className={`px-3 py-2 text-xs ${dashboardMutedColor}`}
                >
                  No members found
                </div>
              )}
            </div>
          )}
          <textarea
            value={commentText}
            onChange={handleCommentChange}
            rows={2}
            aria-label="Write a comment"
            placeholder="Write a comment with @mentions..."
            className={modalTextarea}
          />
          <button
            type="button"
            className={`${projectPrimarySmallBtn} mt-3`}
            onClick={() => addComment()}
            disabled={postingComment || !commentText.trim()}
          >
            {postingComment ? 'Posting...' : 'Comment'}
          </button>
        </div>
      )}
    </div>
  )
}
