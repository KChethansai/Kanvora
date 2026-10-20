import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import { fetchAllProjects } from '../utils/paginatedProjects'
import toast from 'react-hot-toast'
import {
  BsActivity,
  BsGrid3X3Gap,
  BsShieldCheck,
  BsCreditCard,
  BsCalendar3
} from 'react-icons/bs'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  buttonSecondary,
  commonCheckbox,
  dashboardBgColor,
  dashboardBorderColor,
  dashboardMutedColor,
  dashboardPrimaryBg,
  dashboardPrimaryBgHover,
  dashboardPrimaryText,
  dashboardSurfaceColor,
  dashboardSurfaceHover,
  dashboardTextColor,
  fieldBase,
  headingPage,
  headingSection,
  dangerButton,
  statusLabelStyles
} from '../Styles/common'

// Nav configs removed to let the main sidebar handle layout navigation seamlessly.

const getInitials = (name = 'User') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'

const timeAgo = (dateStr) => {
  if (!dateStr) return 'Recently'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.max(0, Math.floor(diff / 60000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const statusMeta = {
  'TO-DO': { title: 'To Do', pill: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
  'IN PROGRESS': { title: 'In Progress', pill: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' },
  'DONE': { title: 'Done', pill: 'border-green-500/30 bg-green-500/10 text-green-400' }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function ProfileAndVisibilityPanel() {
  const { currentUser, updateProfile, checkAuth } = useAuth()
  const [visibleToWorkspace, setVisibleToWorkspace] = useState(true)
  const [saving, setSaving] = useState(false)

  const [freq, setFreq] = useState('periodically')
  const [notifAll, setNotifAll] = useState(true)
  const [notifComments, setNotifComments] = useState(true)

  const handleNotifAll = (checked) => {
    setNotifAll(checked)
    setNotifComments(checked)
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    defaultValues: {
      name: currentUser?.name || '',
      username: currentUser?.username || '',
      bio: currentUser?.bio || ''
    }
  })

  useEffect(() => {
    reset({
      name: currentUser?.name || '',
      username: currentUser?.username || '',
      bio: currentUser?.bio || ''
    })
  }, [currentUser, reset])

  const onSubmit = async (data) => {
    try {
      setSaving(true)
      await updateProfile({
        name: data.name?.trim(),
        username: data.username?.trim(),
        bio: data.bio?.trim()
      })
      await checkAuth()
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="max-w-3xl">
      <h2 className={headingPage}>Profile and Visibility</h2>

      <div
        className={`mt-6 rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-5`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${dashboardPrimaryBg} text-2xl font-bold ${dashboardPrimaryText}`}
          >
            {currentUser?.profilePic ? (
              <img
                src={currentUser.profilePic}
                alt="avatar"
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              getInitials(currentUser?.name)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-white">
              {currentUser?.name || 'Kanvora User'}
            </p>
            <p className={`truncate text-sm ${dashboardMutedColor}`}>
              {currentUser?.email}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div>
            <label
              className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}
            >
              Full Name
            </label>
            <input
              className={fieldBase}
              placeholder="Your name"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-300">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label
              className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}
            >
              Username
            </label>
            <input
              className={fieldBase}
              placeholder="@username"
              {...register('username')}
            />
          </div>

          <div>
            <label
              className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}
            >
              Bio
            </label>
            <textarea
              rows={4}
              className={`${fieldBase} resize-none`}
              placeholder="Tell your team what you are focused on."
              {...register('bio')}
            />
          </div>

          <div>
            <label
              className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}
            >
              Email
            </label>
            <input
              value={currentUser?.email || ''}
              readOnly
              className={`w-full cursor-default rounded-lg border ${dashboardBorderColor} ${dashboardBgColor} px-3 py-2 text-sm ${dashboardTextColor}`}
            />
          </div>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border ${dashboardBorderColor} ${dashboardBgColor} p-4 text-sm text-white`}
          >
            <input
              type="checkbox"
              checked={visibleToWorkspace}
              onChange={(event) => setVisibleToWorkspace(event.target.checked)}
              className={`${commonCheckbox} mt-1`}
            />
            <span>
              Make profile visible to workspace members
              <span className={`block text-xs ${dashboardMutedColor}`}>
                This setting is stored locally for now.
              </span>
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={saving}
          className={`mt-6 inline-flex items-center justify-center rounded-lg ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} px-5 py-2 text-sm font-semibold ${dashboardPrimaryText} transition-colors disabled:opacity-50`}
        >
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </div>

      <div className="mt-5 grid gap-5">
        <section
          className={`rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-5`}
        >
          <h3 className={headingSection}>Language and region</h3>
          <button className={`${buttonSecondary} mt-4`}>Change language</button>
        </section>

        <section
          className={`rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-5`}
        >
          <h3 className={headingSection}>Email notifications</h3>
          <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
            Email notifications can be sent instantly, periodically, or never.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {['never', 'periodically', 'instantly'].map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border ${dashboardBorderColor} p-3 text-sm capitalize transition ${
                  freq === opt
                    ? `${dashboardPrimaryBg} ${dashboardPrimaryText}`
                    : `${dashboardBgColor} text-white ${dashboardSurfaceHover}`
                }`}
              >
                <input
                  type="radio"
                  name="freq"
                  value={opt}
                  checked={freq === opt}
                  onChange={() => setFreq(opt)}
                  className="accent-[#ff4d67]"
                />
                {opt}
              </label>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-white">
              <input
                type="checkbox"
                checked={notifAll}
                onChange={(event) => handleNotifAll(event.target.checked)}
                className={commonCheckbox}
              />
              Select all notifications
            </label>
            <label className="ml-6 flex cursor-pointer items-start gap-3 text-sm text-white">
              <input
                type="checkbox"
                checked={notifComments}
                onChange={(event) => {
                  setNotifComments(event.target.checked)
                  if (!event.target.checked) setNotifAll(false)
                }}
                className={`${commonCheckbox} mt-1`}
              />
              <span>
                Comments
                <span className={`block text-xs ${dashboardMutedColor}`}>
                  New comments added on cards you are watching
                </span>
              </span>
            </label>
          </div>
        </section>
      </div>
    </section>
  )
}

function ActivityPanel() {
  const { activeWorkspace, fetchWorkspaces } = useWorkspaceStore()
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  useEffect(() => {
    let ignore = false

    const fetchActivity = async () => {
      if (!activeWorkspace?._id) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const res = await axios.get(
          `${API_BASE_URL}/api/workspaces/${activeWorkspace._id}/activity`,
          {
            withCredentials: true
          }
        )
        if (!ignore) setActivity(res.data.payload || [])
      } catch {
        if (!ignore) setActivity([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchActivity()
    return () => {
      ignore = true
    }
  }, [activeWorkspace?._id])

  return (
    <section className="max-w-4xl">
      <h2 className={headingPage}>Activity</h2>

      <div
        className={`mt-6 overflow-hidden rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor}`}
      >
        {loading ? (
          <div className="grid gap-3 p-4">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className={`animate-pulse rounded-xl ${dashboardSurfaceColor} p-4`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full ${dashboardBgColor}`} />
                  <div className="flex-1">
                    <div className={`h-3 w-2/3 rounded ${dashboardBgColor}`} />
                    <div
                      className={`mt-2 h-2 w-24 rounded ${dashboardBgColor}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <BsActivity className={`mb-3 text-3xl ${dashboardMutedColor}`} />
            <p className="font-semibold text-white">No recent activity</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto app-scrollbar">
            {activity.map((item) => (
              <div
                key={item._id}
                className={`flex items-start gap-3 border-b ${dashboardBorderColor} px-5 py-4 last:border-b-0 ${dashboardSurfaceHover} transition-colors`}
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${dashboardBgColor} ${dashboardTextColor}`}
                >
                  <BsActivity />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${dashboardTextColor}`}>
                    {item.message || 'Workspace activity updated'}
                  </p>
                  <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
                    {item.projectName ? `${item.projectName} · ` : ''}
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function WorkspaceProjectsPanel() {
  const navigate = useNavigate()
  const { activeWorkspace } = useWorkspaceStore()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    const fetchProjects = async () => {
      try {
        setLoading(true)
        const projects = await fetchAllProjects({ workspaceId: activeWorkspace?._id || null })
        if (!ignore) setProjects(projects)
      } catch {
        if (!ignore) setProjects([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchProjects()
    return () => {
      ignore = true
    }
  }, [activeWorkspace?._id])

  return (
    <section className="max-w-4xl">
      <h2 className={headingPage}>Workspace Projects</h2>
      <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
        Projects connected to{' '}
        {activeWorkspace?.name || 'your current workspace'}.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {loading ? (
          [0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className={`h-28 animate-pulse rounded-xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-4`}
            >
              <div className={`h-4 w-2/3 rounded ${dashboardBgColor}`} />
              <div className={`mt-3 h-3 w-1/3 rounded ${dashboardBgColor}`} />
            </div>
          ))
        ) : projects.length === 0 ? (
          <div
            className={`col-span-full rounded-2xl border border-dashed ${dashboardBorderColor} ${dashboardSurfaceColor} p-8 text-center`}
          >
            <BsGrid3X3Gap
              className={`mx-auto mb-3 text-3xl ${dashboardMutedColor}`}
            />
            <p className="font-semibold text-white">
              No workspace projects yet
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <button
              key={project._id}
              type="button"
              onClick={() => navigate(`/projects/${project._id}`)}
              className={`rounded-xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-4 text-left ${dashboardSurfaceHover} transition-colors`}
            >
              <p className="truncate text-sm font-semibold text-white">
                {project.title || project.name}
              </p>
              <p className={`mt-2 text-xs ${dashboardMutedColor}`}>
                {project.archivedAt ? 'Archived' : 'Active'} project
              </p>
            </button>
          ))
        )}
      </div>
    </section>
  )
}

function CardsPanel() {
  const { activeWorkspace, fetchWorkspaces } = useWorkspaceStore()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  useEffect(() => {
    let ignore = false

    const fetchCards = async () => {
      if (!activeWorkspace?._id) {
        setCards([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const res = await axios.get(
          `${API_BASE_URL}/api/workspaces/${activeWorkspace._id}/cards`,
          { withCredentials: true }
        )
        if (!ignore) setCards(res.data.payload || [])
      } catch {
        if (!ignore) setCards([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchCards()
    return () => {
      ignore = true
    }
  }, [activeWorkspace?._id])

  return (
    <section className="max-w-4xl">
      <h2 className={headingPage}>Cards</h2>

      <div className="mt-6 grid gap-3">
        {loading ? (
          [0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className={`animate-pulse rounded-xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-4`}
            >
              <div className={`h-4 w-2/3 rounded ${dashboardBgColor}`} />
              <div className={`mt-3 h-3 w-1/3 rounded ${dashboardBgColor}`} />
            </div>
          ))
        ) : cards.length === 0 ? (
          <div
            className={`rounded-2xl border border-dashed ${dashboardBorderColor} ${dashboardSurfaceColor} p-8 text-center`}
          >
            <BsCreditCard
              className={`mx-auto mb-3 text-3xl ${dashboardMutedColor}`}
            />
            <p className="font-semibold text-white">No cards in this workspace</p>
            <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
              Cards from all projects in {activeWorkspace?.name || 'this workspace'}{' '}
              will appear here.
            </p>
          </div>
        ) : (
          cards.map((card) => {
            const status = card.status || 'TO-DO'
            const meta = statusMeta[status] || statusLabelStyles.todo

            return (
              <article
                key={card._id}
                className={`rounded-xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-4 ${dashboardSurfaceHover} transition-colors`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {card.title || 'Untitled card'}
                    </h3>
                    <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
                      {card.projectName || 'Project'}
                      {card.listTitle ? ` · ${card.listTitle}` : ''}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.pill}`}
                  >
                    {meta.title}
                  </span>
                </div>
                {card.dueDate && (
                  <p
                    className={`mt-3 flex items-center gap-1.5 text-xs ${dashboardMutedColor}`}
                  >
                    <BsCalendar3 />
                    Due {formatDate(card.dueDate)}
                  </p>
                )}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

function PersonalSettingsPanel() {
  const [freq, setFreq] = useState('periodically')
  const [notifAll, setNotifAll] = useState(true)
  const [notifComments, setNotifComments] = useState(true)

  const handleNotifAll = (checked) => {
    setNotifAll(checked)
    setNotifComments(checked)
  }

  return (
    <section className="max-w-3xl">
      <h2 className={headingPage}>Settings</h2>

      <div className="mt-8 grid gap-5">
        <section
          className={`rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-5`}
        >
          <h3 className={headingSection}>Email notifications</h3>
          <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
            Email notifications can be sent instantly, periodically, or never.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {['never', 'periodically', 'instantly'].map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border ${dashboardBorderColor} p-3 text-sm capitalize transition ${
                  freq === opt
                    ? `${dashboardPrimaryBg} ${dashboardPrimaryText}`
                    : `${dashboardBgColor} text-white ${dashboardSurfaceHover}`
                }`}
              >
                <input
                  type="radio"
                  name="freq"
                  value={opt}
                  checked={freq === opt}
                  onChange={() => setFreq(opt)}
                />
                {opt}
              </label>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-white">
              <input
                type="checkbox"
                checked={notifAll}
                onChange={(event) => handleNotifAll(event.target.checked)}
              />
              Select all notifications
            </label>
            <label className="ml-6 flex cursor-pointer items-start gap-3 text-sm text-white">
              <input
                type="checkbox"
                checked={notifComments}
                onChange={(event) => {
                  setNotifComments(event.target.checked)
                  if (!event.target.checked) setNotifAll(false)
                }}
                className="mt-1"
              />
              <span>
                Comments
                <span className={`block text-xs ${dashboardMutedColor}`}>
                  New comments added on cards you are watching
                </span>
              </span>
            </label>
          </div>
        </section>
      </div>
    </section>
  )
}

function WorkspaceSettingsPanel() {
  const { activeWorkspace } = useWorkspaceStore()
  const [aiEnabled, setAiEnabled] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const workspaceName = activeWorkspace?.name || 'Workspace'

  return (
    <section className="max-w-3xl">
      <h2 className={headingPage}>Workspace settings</h2>

      <div
        className={`mt-6 rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-5`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${dashboardPrimaryBg} text-xl font-bold ${dashboardPrimaryText}`}
          >
            {(workspaceName || 'W').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-white">
              {workspaceName}
            </p>
            <p className={`text-xs ${dashboardMutedColor}`}>
              Private workspace
            </p>
          </div>
          <BsShieldCheck className={`text-xl ${dashboardTextColor}`} />
        </div>
      </div>

      <div
        className={`mt-5 rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-5`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className={headingSection}>AI features</h3>
            <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
              AI is {aiEnabled ? 'activated' : 'deactivated'} for all projects.
            </p>
          </div>
          <button
            onClick={() => setAiEnabled((enabled) => !enabled)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              aiEnabled ? dashboardPrimaryBg : dashboardBgColor
            }`}
            aria-pressed={aiEnabled}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                aiEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div
        className={`mt-5 rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-5`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Delete workspace
            </h3>
            <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
              Permanently deletes all projects and cards. This cannot be undone.
            </p>
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className={dangerButton}
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button className={dangerButton}>Yes, delete</button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={buttonSecondary}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function MembersSettingsPanel() {
  const { activeWorkspace } = useWorkspaceStore()
  const members = activeWorkspace?.members || []

  return (
    <section className="max-w-4xl">
      <h2 className={headingPage}>Workspace members</h2>
      {members.length === 0 ? (
        <div
          className={`mt-6 rounded-2xl border border-dashed ${dashboardBorderColor} ${dashboardSurfaceColor} p-8 text-sm ${dashboardMutedColor}`}
        >
          No members found in this workspace.
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {members.map((member, index) => {
            const user = typeof member.user === 'object' && member.user !== null ? member.user : {}
            const name = user.name || user.email || 'Workspace Member'
            const initials = getInitials(name)

            return (
              <div
                key={user._id || index}
                className={`flex items-center justify-between rounded-xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-4`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${dashboardPrimaryBg} font-bold ${dashboardPrimaryText}`}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="font-medium text-white">{name}</p>
                    <p className={`text-xs ${dashboardMutedColor}`}>
                      {user.email}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full border ${dashboardBorderColor} ${dashboardBgColor} px-3 py-1 text-xs capitalize ${dashboardTextColor}`}
                >
                  {member.role?.toLowerCase() || 'member'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const renderPanel = (active) => {
  switch (active) {
    case 'profile':
      return <ProfileAndVisibilityPanel />
    case 'activity':
      return <ActivityPanel />
    case 'projects':
      return <WorkspaceProjectsPanel />
    case 'cards':
      return <CardsPanel />
    case 'members':
      return <MembersSettingsPanel />
    case 'ws-settings':
      return <WorkspaceSettingsPanel />
    case 'settings':
    default:
      return <PersonalSettingsPanel />
  }
}

function Settings() {
  const { section } = useParams()
  const active = section || 'settings'

  return (
    <div className="w-full">
      {renderPanel(active)}
    </div>
  )
}

export default Settings
