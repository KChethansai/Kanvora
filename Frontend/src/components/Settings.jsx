import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import { fetchAllProjects } from '../utils/paginatedProjects'
import toast from 'react-hot-toast'
import {
  BsActivity,
  BsGrid3X3Gap,
  BsCreditCard,
  BsCalendar3
} from 'react-icons/bs'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  buttonSecondary,
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
  // The persisted status is hyphenated; a space here silently dropped every
  // in-progress status to the To Do fallback.
  'IN-PROGRESS': { title: 'In Progress', pill: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' },
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
  const [saving, setSaving] = useState(false)

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
      <h2 className={headingPage}>Profile</h2>

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
              htmlFor="settings-full-name"
              className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}
            >
              Full Name
            </label>
            <input
              id="settings-full-name"
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
              htmlFor="settings-username"
              className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}
            >
              Username
            </label>
            <input
              id="settings-username"
              className={fieldBase}
              placeholder="@username"
              {...register('username')}
            />
          </div>

          <div>
            <label
              htmlFor="settings-bio"
              className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}
            >
              Bio
            </label>
            <textarea
              id="settings-bio"
              rows={4}
              className={`${fieldBase} resize-none`}
              placeholder="Tell your team what you are focused on."
              {...register('bio')}
            />
          </div>

          <div>
            <label
              htmlFor="settings-email"
              className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}
            >
              Email
            </label>
            <input
              id="settings-email"
              value={currentUser?.email || ''}
              readOnly
              className={`w-full cursor-default rounded-lg border ${dashboardBorderColor} ${dashboardBgColor} px-3 py-2 text-sm ${dashboardTextColor}`}
            />
          </div>
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
          <h3 className={headingSection}>Password</h3>
          <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
            Change your password from your profile page. Kanvora does not offer
            email notification preferences, language or region switching, or AI
            features.
          </p>
          <Link to="/main-page/profile" className={`${buttonSecondary} mt-4 inline-flex`}>
            Open profile and password settings
          </Link>
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

function AccountOverviewPanel() {
  const { currentUser } = useAuth()
  const { activeWorkspace } = useWorkspaceStore()

  const links = [
    {
      title: 'Profile',
      text: 'Update your name, username, and bio.',
      to: '/workspaces/settings/profile'
    },
    {
      title: 'Activity',
      text: 'Review recent workspace activity.',
      to: '/workspaces/settings/activity'
    },
    {
      title: 'Cards',
      text: 'See cards across the active workspace.',
      to: '/workspaces/settings/cards'
    },
    {
      title: 'Members',
      text: 'Review workspace members and their roles.',
      to: '/workspaces/members'
    },
    {
      title: 'Workspace settings',
      text: 'Rename or delete the active workspace.',
      to: '/workspaces/settings'
    },
    {
      title: 'Notifications',
      text: 'Open your notification list.',
      to: '/main-page/notifications'
    }
  ]

  return (
    <section className="max-w-3xl">
      <h2 className={headingPage}>Settings</h2>
      <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
        {currentUser?.name || 'Kanvora user'}
        {activeWorkspace?.name ? ` · ${activeWorkspace.name}` : ''}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.title}
            to={link.to}
            className={`rounded-xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-4 ${dashboardSurfaceHover} transition-colors`}
          >
            <span className="block text-sm font-semibold text-white">
              {link.title}
            </span>
            <span className={`mt-1 block text-xs ${dashboardMutedColor}`}>
              {link.text}
            </span>
          </Link>
        ))}
      </div>

      <p className={`mt-6 text-xs ${dashboardMutedColor}`}>
        Kanvora does not currently offer email notification preferences,
        language or region switching, or AI features.
      </p>
    </section>
  )
}

function WorkspaceSettingsPanel() {
  const { activeWorkspace } = useWorkspaceStore()
  const navigate = useNavigate()
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
              Members can open this workspace and the boards they are allowed to
              access.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`mt-5 rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-5`}
      >
        <h3 className={headingSection}>Rename or delete this workspace</h3>
        <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
          Workspace name changes and deletion are handled in the workspace
          settings screen, where Kanvora confirms the action before deleting.
        </p>
        <button
          type="button"
          onClick={() => navigate('/workspaces/settings')}
          className={`${buttonSecondary} mt-4`}
        >
          Open workspace settings
        </button>
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
      return <AccountOverviewPanel />
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
