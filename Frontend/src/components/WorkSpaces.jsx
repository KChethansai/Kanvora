import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, Outlet } from 'react-router'
import {
  BsBoxArrowRight,
  BsList,
  BsPersonPlusFill,
  BsPlusLg,
  BsSearch,
  BsX
} from 'react-icons/bs'
import toast from 'react-hot-toast'
import { useProjectStore } from '../store/projectStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useAuth } from '../store/authStore'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import useDialogFocus from '../hooks/useDialogFocus'
import {
  buttonPrimary,
  buttonSecondary,
  cardInteractive,
  dashboardMutedColor,
  dangerButton,
  emptyStatePanel,
  fieldBase,
  headingPage,
  headingSection,
  iconButton
} from '../Styles/common'

const memberTabs = [
  { id: 'members', label: 'Members' },
  { id: 'single', label: 'Single-project guests' },
  { id: 'multi', label: 'Multi-project guests' },
  { id: 'join', label: 'Join requests' }
]

const avatarColors = [
  'from-blue-400 to-blue-600',
  'from-teal-400 to-cyan-600',
  'from-pink-400 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-violet-400 to-indigo-600'
]

const getInitials = (name = 'Member') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M'

function ProjectsPanel({ navigate, projects, activeWorkspace }) {
  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={headingPage}>
            {activeWorkspace?.name || 'Workspace'} projects
          </h1>
          <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
            Recent project spaces connected to this workspace.
          </p>
        </div>
        <button type="button"
          onClick={() => navigate('/main-page')}
          className={buttonPrimary}
        >
          <BsPlusLg /> Go to dashboard
        </button>
      </div>
      {projects.length === 0 ? (
        <div className={emptyStatePanel}>
          <h3 className="font-semibold text-white">No projects yet</h3>
          <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
            Create the first project from your dashboard.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <button
              key={project._id}
              type="button"
              onClick={() => navigate(`/projects/${project._id}`)}
              className="group relative h-32 overflow-hidden rounded-xl p-4 text-left shadow-xl transition hover:-translate-y-0.5 border border-white/[0.07]"
            >
              {project.img ? (
                <img
                  src={project.img}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  className={`absolute inset-0 bg-linear-to-br ${project.color || 'from-blue-500 to-blue-700'}`}
                />
              )}
              <div className="absolute inset-0 bg-black/10 transition-opacity duration-150 group-hover:bg-black/20" />
              <div className="relative z-10 flex h-full flex-col justify-between">
                <span className="on-scrim text-sm font-bold drop-shadow">
                  {project.title || project.name}
                </span>
                <span className="on-scrim-muted text-xs">Open board</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function MembersPanel({
  activeWorkspace,
  projects,
  inviteMember,
  removeMember,
  updateMemberRole,
  currentUser
}) {
  // Derive current user's role in the active workspace
  const currentUserId = currentUser?._id
  const currentUserMember = (activeWorkspace?.members || []).find((m) => {
    const mId = m.user?._id || m.user
    return mId?.toString() === currentUserId?.toString()
  })
  const isOwner =
    activeWorkspace?.owner?._id?.toString() === currentUserId?.toString() ||
    activeWorkspace?.owner?.toString() === currentUserId?.toString()
  const currentUserRole = currentUserMember?.role || ''
  const canEditRoles =
    isOwner || currentUserRole === 'ADMIN' || currentUserRole === 'MANAGER'
  const [activeMemberTab, setActiveMemberTab] = useState('members')
  const [filterText, setFilterText] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const inviteDialogRef = useDialogFocus(showInviteModal, () => setShowInviteModal(false))

  const members = useMemo(
    () =>
      (activeWorkspace?.members || []).map((member, index) => {
        const user =
          typeof member.user === 'object' && member.user !== null
            ? member.user
            : {}
        const name = user.name || user.email || 'Workspace member'
        const userId = user._id || member.user
        return {
          id: userId || `${name}-${index}`,
          name,
          email: user.email || '',
          role: member.role || 'MEMBER',
          avatar: getInitials(name),
          color: avatarColors[index % avatarColors.length],
          projects: projects.filter((project) =>
            project.members?.some((projectMember) => {
              const projectMemberId = projectMember?._id || projectMember
              return projectMemberId?.toString() === userId?.toString()
            })
          ).length
        }
      }),
    [activeWorkspace?.members, projects]
  )

  const filtered = members.filter((member) =>
    `${member.name} ${member.email}`
      .toLowerCase()
      .includes(filterText.toLowerCase())
  )
  const counts = { members: members.length, single: 0, multi: 0, join: 0 }

  const handleInvite = async () => {
    if (!activeWorkspace?._id || !inviteEmail.trim()) return
    try {
      setSubmittingInvite(true)
      const result = await inviteMember(activeWorkspace._id, inviteEmail.trim())
      setShowInviteModal(false)
      setInviteEmail('')
      toast.success(result?.message || 'Invite sent successfully')
      if (result?.warning) toast.warning(result.warning)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not invite member')
    } finally {
      setSubmittingInvite(false)
    }
  }

  const handleRemoveMember = async (userId) => {
    if (!activeWorkspace?._id || !userId) return
    try {
      await removeMember(activeWorkspace._id, userId)
      toast.success('Member removed')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove member')
    }
  }

  const handleRoleChange = async (userId, role) => {
    if (!activeWorkspace?._id || !userId) return
    try {
      await updateMemberRole(activeWorkspace._id, userId, role)
      toast.success('Role updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update role')
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={headingPage}>Collaborators</h1>
          <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
            Manage who can view, join, and contribute to workspace projects.
          </p>
        </div>
        <button type="button"
          onClick={() => setShowInviteModal(true)}
          className={buttonPrimary}
        >
          <BsPersonPlusFill /> Invite members
        </button>
      </div>

      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && setShowInviteModal(false)}
        >
          <div
            ref={inviteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-heading"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-[#2c333a] bg-[#1d2125] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="invite-modal-heading" className={headingSection}>Invite to workspace</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className={iconButton}
                aria-label="Close invite dialog"
              >
                <BsX aria-hidden="true" />
              </button>
            </div>
            <label htmlFor="invite-email" className={`mb-1.5 block text-xs font-semibold ${dashboardMutedColor}`}>
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="Enter email address..."
              className={fieldBase}
              data-autofocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleInvite}
                disabled={submittingInvite || !inviteEmail.trim()}
                className={`${buttonPrimary} flex-1`}
              >
                {submittingInvite ? 'Sending...' : 'Send invite'}
              </button>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className={buttonSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto app-scrollbar">
          {memberTabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveMemberTab(id)}
              aria-pressed={activeMemberTab === id}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeMemberTab === id
                  ? 'bg-[#ff4d67] text-[var(--kt-on-accent)]'
                  : 'bg-[#22272b] text-[#b6c2cf] hover:text-white'
              }`}
            >
              {label} ({counts[id]})
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <BsSearch
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${dashboardMutedColor}`}
          />
          <input
            type="text"
            placeholder="Filter members"
            aria-label="Filter members"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            className={`${fieldBase} pl-9`}
          />
        </div>
      </div>

      {activeMemberTab === 'members' ? (
        <div className="grid gap-2">
          {filtered.length === 0 ? (
            <div className={emptyStatePanel}>
              No members match "{filterText}".
            </div>
          ) : (
            filtered.map((member) => (
              <div
                key={member.id}
                className={`${cardInteractive} flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br ${member.color} text-sm font-bold`}
                  >
                    {/* Fixed scrim: the gradient colours range from near-white
                        to deep violet, so the initials need one dark layer to
                        stay readable in both themes. */}
                    <span aria-hidden="true" className="absolute inset-0 rounded-full bg-black/35" />
                    <span className="relative on-scrim">{member.avatar}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {member.name}
                    </p>
                    <p className={`truncate text-xs ${dashboardMutedColor}`}>
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <select
                      value={member.role}
                      aria-label={`Role for ${member.name}`}
                      disabled={
                        !canEditRoles ||
                        member.id ===
                          (
                            activeWorkspace?.owner?._id ||
                            activeWorkspace?.owner
                          )?.toString()
                      }
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className={`app-native-select h-9 rounded-lg border border-[var(--kt-field-border)] bg-[#0a0a0a] px-3 pr-8 text-sm text-white outline-none transition focus:border-[#ff4d67] appearance-none ${
                        !canEditRoles ||
                        member.id ===
                          (
                            activeWorkspace?.owner?._id ||
                            activeWorkspace?.owner
                          )?.toString()
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer hover:border-white/20'
                      }`}
                    >
                      {member.role === 'ADMIN' && (
                        <option value="ADMIN">Admin</option>
                      )}
                      <option value="MANAGER">Manager</option>
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8899a6]">
                      <svg
                        width="10"
                        height="6"
                        viewBox="0 0 10 6"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 1L5 5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  {(canEditRoles || member.id === currentUserId) && (
                    <button type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className={dangerButton}
                    >
                      <BsBoxArrowRight />{' '}
                      {member.id === currentUserId ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className={emptyStatePanel}>
          No{' '}
          {memberTabs
            .find((tab) => tab.id === activeMemberTab)
            ?.label.toLowerCase()}{' '}
          yet.
        </div>
      )}
    </section>
  )
}

function WorkspaceSettingsPanel() {
  const { activeWorkspace, updateWorkspace, deleteWorkspace } =
    useWorkspaceStore()
  const [workspaceName, setWorkspaceName] = useState(
    activeWorkspace?.name || 'Workspace'
  )
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setWorkspaceName(activeWorkspace?.name || 'Workspace')
  }, [activeWorkspace?.name])

  const handleSave = async () => {
    if (!activeWorkspace?._id) return
    try {
      await updateWorkspace(activeWorkspace._id, { name: workspaceName })
      setEditing(false)
      toast.success('Workspace updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update workspace')
    }
  }

  const handleDelete = async () => {
    if (!activeWorkspace?._id) return
    try {
      await deleteWorkspace(activeWorkspace._id)
      toast.success('Workspace deleted')
      setShowDeleteConfirm(false)
      navigate('/workspaces')
    } catch {
      toast.error('Could not delete workspace')
    }
  }

  return (
    <section className="max-w-3xl">
      <h1 className={headingPage}>Workspace settings</h1>
      <div className="mt-6 rounded-2xl border border-[#2c333a] bg-[#1d2125] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-[var(--kt-accent)] to-[var(--kt-accent-strong)] text-xl font-bold text-[var(--kt-on-accent)]">
            {(workspaceName || 'W').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            {editing ? (
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                aria-label="Workspace name"
                className={fieldBase}
                autoFocus
              />
            ) : (
              <p className="font-semibold text-white">{workspaceName}</p>
            )}
            <p className={`text-xs ${dashboardMutedColor}`}>
              Private workspace
            </p>
          </div>
          <button type="button"
            onClick={() => (editing ? handleSave() : setEditing(true))}
            className={buttonSecondary}
          >
            {editing ? 'Save' : 'Edit'}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#2c333a] bg-[#1d2125] p-6">
        <h3 className={headingSection}>Workspace availability</h3>
        <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
          Kanvora does not include AI features or external integrations. Board
          changes require an internet connection.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-red-500/20 bg-[#1d2125] p-6">
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
            <button type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className={dangerButton}
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleDelete} className={dangerButton}>
                Yes, delete
              </button>
              <button type="button"
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

function WorkSpaces() {
  const navigate = useNavigate()
  const location = useLocation()
  const isPersonalSettings = location.pathname.startsWith(
    '/workspaces/settings/'
  )

  const activeTab = location.pathname.endsWith('/projects')
    ? 'projects'
    : location.pathname.endsWith('/settings')
      ? 'settings'
      : 'members'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currentUser } = useAuth()
  const { projects, fetchProjects } = useProjectStore()
  const {
    activeWorkspace,
    fetchWorkspaces,
    inviteMember,
    removeMember,
    updateMemberRole
  } = useWorkspaceStore()

  useEffect(() => {
    if (
      location.pathname === '/workspaces' ||
      location.pathname === '/workspaces/'
    ) {
      navigate('/workspaces/members', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  useEffect(() => {
    if (activeWorkspace?._id) fetchProjects(activeWorkspace._id)
  }, [activeWorkspace?._id, fetchProjects])

  const renderPanel = () => {
    if (isPersonalSettings) {
      return <Outlet />
    }
    if (activeTab === 'projects') {
      return (
        <ProjectsPanel
          navigate={navigate}
          projects={projects}
          activeWorkspace={activeWorkspace}
        />
      )
    }
    if (activeTab === 'settings') return <WorkspaceSettingsPanel />
    return (
      <MembersPanel
        activeWorkspace={activeWorkspace}
        projects={projects}
        inviteMember={inviteMember}
        removeMember={removeMember}
        updateMemberRole={updateMemberRole}
        currentUser={currentUser}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#09090b] text-[#f4f4f5]">
      <Navbar onToggleSidebar={() => setSidebarOpen(true)} sidebarExpanded={sidebarOpen} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-[#18181b] bg-[#050505]/86 px-4 py-3 lg:hidden">
            <button type="button"
              onClick={() => setSidebarOpen(true)}
              className={iconButton}
              aria-label="Open sidebar"
            >
              <BsList />
            </button>
            <span className="font-semibold text-white">
              {activeWorkspace?.name || 'Workspace'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 app-scrollbar sm:p-6 lg:p-8">
            {renderPanel()}
          </div>
        </main>
      </div>
    </div>
  )
}

export default WorkSpaces
