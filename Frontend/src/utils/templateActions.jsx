// Shared template behaviour: accepted-field payloads, workspace board permissions
// and the "use template" dialog that creates an independent board.
/* eslint-disable react-refresh/only-export-components -- shared template helpers live beside the dialog they serve; this module is imported by components, never a hot-update boundary. */
import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

import { API_BASE_URL } from '../config/api'
import useDialogFocus from '../hooks/useDialogFocus'
import { useAuth } from '../store/authStore'
import {
  dashboardMutedColor,
  dashboardSurfaceColor,
  fieldBase,
  labelBase,
  modalPrimaryBtn
} from '../Styles/common'

const PUBLISH_DETAIL_KEYS = [
  'companyName',
  'website',
  'contactEmail',
  'templateType',
  'category',
  'notes'
]
const PERSONAL_BOARD_ROLES = ['MEMBER', 'ADMIN', 'MANAGER']
const BOARD_TITLE_MAX = 200

export const isWebUrl = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
  } catch {
    return false
  }
}

export const isProjectBacked = (template) => template?.type === 'project'

// POST /api/templates and PUT /api/templates/:id reject any field outside this
// set, so build the body from known keys instead of spreading form state.
export function buildTemplatePayload(source = {}, { projectBacked = false } = {}) {
  const payload = {}

  if (typeof source.title === 'string') payload.title = source.title.trim()
  if (typeof source.description === 'string') {
    payload.description = source.description.trim()
  }
  if (typeof source.isPublished === 'boolean') {
    payload.isPublished = source.isPublished
  }
  if (typeof source.isEditable === 'boolean') {
    payload.isEditable = source.isEditable
  }
  if (!projectBacked && typeof source.category === 'string') {
    payload.category = source.category.trim()
  }
  if (!projectBacked && Array.isArray(source.images)) {
    payload.images = source.images
      .map((image) => (typeof image === 'string' ? image.trim() : ''))
      .filter((image) => image && isWebUrl(image))
  }
  if (
    source.publishDetails &&
    typeof source.publishDetails === 'object' &&
    !Array.isArray(source.publishDetails)
  ) {
    const details = {}
    for (const key of PUBLISH_DETAIL_KEYS) {
      const value = source.publishDetails[key]
      if (typeof value === 'string' && value.trim()) details[key] = value.trim()
    }
    // Omit empty details so an edit never wipes existing publisher data.
    if (Object.keys(details).length) payload.publishDetails = details
  }

  return payload
}

const idOf = (value) => value?._id?.toString() || value?.toString() || ''

// Mirrors the backend workspaceCan('manageBoards') rule so the dialog only
// offers destinations the server will accept.
export function workspaceManagesBoards(workspace, userId) {
  const actor = idOf(userId)
  if (!workspace || !actor) return false
  if (idOf(workspace.owner) === actor) return true
  const matches = (workspace.members || []).filter(
    (member) => idOf(member.user) === actor
  )
  if (matches.length !== 1) return false
  const role = matches[0].role
  if (!['ADMIN', 'MANAGER', 'MEMBER'].includes(role)) return false
  return workspace.permissions?.[role]?.manageBoards !== false
}

export const manageableWorkspaces = (workspaces, userId) =>
  (Array.isArray(workspaces) ? workspaces : []).filter((workspace) =>
    workspaceManagesBoards(workspace, userId)
  )

// Only workspaceId and title are accepted by POST /api/templates/:id/use.
export async function createBoardFromTemplate(templateId, { title, workspaceId } = {}) {
  const body = {}
  if (typeof title === 'string' && title.trim()) body.title = title.trim()
  if (workspaceId) body.workspaceId = workspaceId

  const res = await axios.post(
    `${API_BASE_URL}/api/templates/${templateId}/use`,
    body,
    { withCredentials: true }
  )
  const project = res.data?.payload
  if (!project?._id) {
    throw new Error(
      'The board was created but the response was incomplete. Open your projects to find it.'
    )
  }
  return project
}

export const requestErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback

export function UseTemplateDialog({ template, onClose, onCreated }) {
  const { currentUser } = useAuth()
  const dialogRef = useDialogFocus(true, onClose)

  const [title, setTitle] = useState(template?.title || '')
  const [workspaceId, setWorkspaceId] = useState('')
  const [workspaces, setWorkspaces] = useState([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canCreatePersonalBoard = PERSONAL_BOARD_ROLES.includes(
    currentUser?.role
  )

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/workspaces`, {
          withCredentials: true
        })
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.payload || []
        if (!active) return
        const allowed = manageableWorkspaces(list, currentUser?._id)
        setWorkspaces(allowed)
        if (!canCreatePersonalBoard && allowed[0]) {
          setWorkspaceId(allowed[0]._id)
        }
      } catch {
        if (active) setWorkspaces([])
      } finally {
        if (active) setLoadingWorkspaces(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [canCreatePersonalBoard, currentUser?._id])

  const canSubmit = canCreatePersonalBoard || Boolean(workspaceId)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Board title is required')
      return
    }
    if (trimmed.length > BOARD_TITLE_MAX) {
      setError(`Board title must be ${BOARD_TITLE_MAX} characters or fewer`)
      return
    }
    if (!canSubmit) {
      setError(
        'Choose a workspace where you are allowed to create boards. Your account role cannot create personal boards.'
      )
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const project = await createBoardFromTemplate(template._id, {
        title: trimmed,
        workspaceId: workspaceId || undefined
      })
      toast.success(
        `Created “${project.title || trimmed}” with To Do, In Progress and Done lists. Source tasks, comments and members are not copied.`
      )
      onCreated(project)
    } catch (caught) {
      const message = requestErrorMessage(
        caught,
        'Could not create a board from this template'
      )
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="use-template-dialog-title"
        aria-busy={submitting}
        tabIndex={-1}
        className="premium-card animate-enter w-full max-w-md rounded-2xl p-6 focus:outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="use-template-dialog-title"
              className="text-lg font-semibold text-white"
            >
              Create a board from {template?.title || 'this template'}
            </h2>
            <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
              You get a new independent board with To Do, In Progress and Done
              lists. Tasks, comments, members and publisher details from the
              source are not copied.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close use template dialog"
            className={`shrink-0 rounded-md px-2 py-1 text-sm ${dashboardMutedColor} ${dashboardSurfaceColor} hover:text-white`}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="use-template-title" className={labelBase}>
              Board title
            </label>
            <input
              id="use-template-title"
              name="title"
              type="text"
              value={title}
              maxLength={BOARD_TITLE_MAX}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldBase}
              aria-describedby="use-template-title-hint"
            />
            <p
              id="use-template-title-hint"
              className={`mt-1 text-xs ${dashboardMutedColor}`}
            >
              This title is only used for your copy.
            </p>
          </div>

          <div>
            <label htmlFor="use-template-workspace" className={labelBase}>
              Destination
            </label>
            <select
              id="use-template-workspace"
              name="workspaceId"
              value={workspaceId}
              disabled={loadingWorkspaces}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className={fieldBase}
            >
              {canCreatePersonalBoard && (
                <option value="">Personal board (no workspace)</option>
              )}
              {workspaces.map((workspace) => (
                <option key={workspace._id} value={workspace._id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            {loadingWorkspaces && (
              <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
                Loading workspaces…
              </p>
            )}
            {!loadingWorkspaces && !canSubmit && (
              <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
                No workspace allows you to create boards, and your account role
                cannot create personal boards. Ask a workspace manager for
                access.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-[#ff8aa0]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`rounded px-4 py-2 text-sm ${dashboardMutedColor} hover:text-white`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingWorkspaces || !canSubmit}
              className={modalPrimaryBtn}
            >
              {submitting ? 'Creating board…' : 'Create board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
