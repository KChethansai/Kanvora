// Sidebar component: renders a focused piece of the Kanvora UI.
import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BsLayoutWtf,
  BsGridFill,
  BsHouseDoorFill,
  BsChevronDown,
  BsChevronRight,
  BsPeopleFill,
  BsGear,
  BsPlusLg,
  BsX,
  BsPerson,
  BsActivity,
  BsCardText,
  BsQuestionCircle
} from 'react-icons/bs'
import toast from 'react-hot-toast'
import { useProjectStore } from '../store/projectStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  dashboardBgColor,
  dashboardBorderColor,
  dashboardPrimaryBg,
  dashboardPrimaryText,
  dashboardMutedColor,
  dashboardTextColor,
  dashboardPanelElevated
} from '../Styles/common'

function Sidebar({ open = true, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { projects } = useProjectStore()
  const {
    workspaces,
    activeWorkspace,
    fetchWorkspaces,
    createWorkspace,
    setActiveWorkspace
  } = useWorkspaceStore()

  const sidebarProjects = useMemo(() => {
    if (!activeWorkspace?._id) return []
    return projects.filter((project) => {
      const projectWorkspaceId = project.workspace?._id || project.workspace
      return projectWorkspaceId?.toString() === activeWorkspace._id.toString()
    })
  }, [projects, activeWorkspace])
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast.error('Workspace name is required')
      return
    }
    try {
      await createWorkspace({ name: workspaceName.trim() })
      setWorkspaceName('')
      setCreatingWorkspace(false)
      navigate('/main-page')
      toast.success('Workspace created!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create workspace')
    }
  }

  const topNav = [
    {
      id: 'home',
      label: 'Home',
      icon: <BsHouseDoorFill />,
      path: '/main-page'
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: <BsLayoutWtf />,
      path: '/templates'
    },
    {
      id: 'help',
      label: 'Help',
      icon: <BsQuestionCircle />,
      path: '/help'
    }
  ]

  const workspaceNav = [
    {
      id: 'ws-boards',
      label: 'Projects',
      icon: <BsGridFill />,
      path: '/workspaces/projects'
    },
    {
      id: 'members',
      label: 'Members',
      icon: <BsPeopleFill />,
      path: '/workspaces/members'
    },
    {
      id: 'ws-settings',
      label: 'Settings',
      icon: <BsGear />,
      path: '/workspaces/settings'
    }
  ]

  const accountNav = [
    {
      id: 'profile',
      label: 'Profile and Visibility',
      icon: <BsPerson />,
      path: '/workspaces/settings/profile'
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <BsActivity />,
      path: '/workspaces/settings/activity'
    },
    {
      id: 'cards',
      label: 'Cards',
      icon: <BsCardText />,
      path: '/workspaces/settings/cards'
    }
  ]

  const isActive = (path) => {
    if (path === '/main-page') return location.pathname === '/main-page'
    if (path === '/workspaces/settings') {
      return location.pathname === '/workspaces/settings'
    }
    if (path.includes('?')) return location.pathname + location.search === path
    if (path.startsWith('/workspaces/settings/')) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  const navItemClass = (path) =>
    `flex items-center gap-2.5 px-3 h-9 rounded text-sm font-medium w-full text-left transition-colors ${
      isActive(path)
        ? 'bg-[#e63d581a] text-[#ff4d67]'
        : 'text-[#d7dde4] hover:bg-[#18181b] hover:text-white'
    }`

  const subNavItemClass = (path) =>
    `flex items-center gap-2.5 px-3 h-8 rounded text-sm w-full text-left transition-colors ${
      isActive(path)
        ? 'bg-[#e63d581a] text-[#ff4d67]'
        : 'text-[#d7dde4] hover:bg-[#18181b] hover:text-white'
    }`

  const handleNavigate = (path) => {
    navigate(path)
    onClose?.()
  }

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[86vw] ${dashboardBgColor} border-r border-[#18181b] flex flex-col shrink-0 overflow-y-auto app-scrollbar h-full transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 lg:hidden border-b border-[#18181b]">
          <div>
            <p className="text-sm font-bold text-white">Workspace</p>
            <p className={`text-xs ${dashboardMutedColor}`}>
              {activeWorkspace?.name || 'Choose a workspace'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className={`${dashboardMutedColor} hover:text-white rounded p-1 hover:bg-[#18181b]`}
          >
            <BsX className="text-xl" />
          </button>
        </div>

        {/* top nav */}
        <nav className="p-2 flex flex-col gap-0.5 mt-1">
          {topNav.map(({ id, label, icon, path }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleNavigate(path)}
              className={navItemClass(path)}
            >
              <span className="text-base shrink-0">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {/* workspaces section */}
        <div className="p-2">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
              Workspaces
            </p>
            <button
              type="button"
              onClick={() => setCreatingWorkspace((v) => !v)}
              className="text-[#a1a1aa] hover:text-white"
              aria-label="Create workspace"
            >
              <BsPlusLg className="text-xs" />
            </button>
          </div>

          {creatingWorkspace && (
            <div
              className={`mx-1 mb-2 rounded-lg ${dashboardPanelElevated} p-2`}
            >
              <input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                placeholder="Workspace name"
                className={`w-full bg-[#09090b] border ${dashboardBorderColor} rounded px-2 py-1.5 text-xs text-white placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#ff4d67]`}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleCreateWorkspace}
                  className={`flex-1 rounded ${dashboardPrimaryBg} px-2 py-1.5 text-xs font-semibold ${dashboardPrimaryText}`}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingWorkspace(false)}
                  className={`rounded px-2 py-1.5 text-xs ${dashboardMutedColor} hover:text-white`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* workspace toggle */}
          <button
            type="button"
            onClick={() => setWorkspaceOpen((o) => !o)}
            className="flex items-center justify-between w-full px-2 h-9 rounded hover:bg-[#18181b] transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-linear-to-br from-[var(--kt-accent)] to-[var(--kt-accent-strong)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {(activeWorkspace?.name || 'W').slice(0, 1).toUpperCase()}
              </span>
              <span
                className={`text-sm font-medium ${dashboardTextColor} group-hover:text-white truncate`}
              >
                {activeWorkspace?.name || 'No workspace'}
              </span>
            </div>
            {workspaceOpen ? (
              <BsChevronDown className="text-[#a1a1aa] text-xs" />
            ) : (
              <BsChevronRight className="text-[#a1a1aa] text-xs" />
            )}
          </button>

          {workspaceOpen && (
            <div className="flex flex-col gap-0.5 mt-0.5 ml-1">
              {workspaces.map((workspace) => (
                <button
                  key={workspace._id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(workspace)
                    if (!location.pathname.startsWith('/workspaces')) {
                      handleNavigate('/main-page')
                    }
                  }}
                  className={`flex items-center gap-2.5 px-3 h-8 rounded text-sm w-full text-left transition-colors ${
                    activeWorkspace?._id === workspace._id
                      ? 'bg-[#e63d581a] text-[#ff4d67]'
                      : 'text-[#d7dde4] hover:bg-[#18181b] hover:text-white'
                  }`}
                >
                  <span className="w-4 h-4 rounded bg-linear-to-br from-[var(--kt-accent)] to-[var(--kt-accent-strong)] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                    {workspace.name?.slice(0, 1).toUpperCase() || 'W'}
                  </span>
                  <span className="truncate">{workspace.name}</span>
                </button>
              ))}
              {workspaceNav.map(({ id, label, icon, path }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(path)}
                  className={subNavItemClass(path)}
                >
                  <span className="text-sm shrink-0">{icon}</span>
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <hr className="border-[#18181b] mx-2 my-1" />

        <nav className="px-2 pb-1 flex flex-col gap-0.5">
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
            Account
          </p>
          {accountNav.map(({ id, label, icon, path }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleNavigate(path)}
              className={navItemClass(path)}
            >
              <span className="text-base shrink-0">{icon}</span>
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <hr className="border-[#18181b] mx-2 my-1" />

        {/* your projects */}
        <div className="p-2 flex-1">
          <button
            type="button"
            onClick={() => setProjectsOpen((o) => !o)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa] hover:text-white transition-colors"
          >
            <span>Your Projects</span>
            {projectsOpen ? (
              <BsChevronDown className="text-xs" />
            ) : (
              <BsChevronRight className="text-xs" />
            )}
          </button>

          {projectsOpen && (
            <div className="flex flex-col gap-0.5 mt-1">
              {sidebarProjects.slice(0, 8).map((project) => (
                <button
                  key={project._id}
                  type="button"
                  onClick={() => handleNavigate(`/projects/${project._id}`)}
                  className={`flex items-center gap-2.5 px-3 h-8 rounded text-sm w-full text-left transition-colors ${
                    location.pathname === `/projects/${project._id}`
                      ? 'bg-[#e63d581a] text-[#ff4d67]'
                      : 'text-[#d7dde4] hover:bg-[#18181b] hover:text-white'
                  }`}
                >
                  {project.img ? (
                    <img
                      src={project.img}
                      alt=""
                      className="w-4 h-4 rounded shrink-0 object-cover"
                    />
                  ) : (
                    <span
                      className={`w-4 h-4 rounded shrink-0 bg-linear-to-br ${
                        project.color || 'from-blue-500 to-blue-700'
                      }`}
                    />
                  )}
                  <span className="truncate">
                    {project.title || project.name}
                  </span>
                </button>
              ))}

              {sidebarProjects.length === 0 && (
                <p className={`text-xs ${dashboardMutedColor} px-3 py-2`}>
                  No projects yet.
                </p>
              )}

              <button
                type="button"
                onClick={() => handleNavigate('/main-page')}
                className={`flex items-center gap-2 px-3 h-8 rounded text-xs ${dashboardMutedColor} hover:bg-[#18181b] hover:text-white transition-colors mt-0.5`}
              >
                <BsPlusLg className="text-xs" /> Create a project
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
