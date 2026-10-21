// Navbar component: renders a focused piece of the Kanvora UI.
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import kanvoraLogo from '../assets/kanvora-logo.png'
import {
  BsBell,
  BsSearch,
  BsBoxArrowRight,
  BsGear,
  BsPerson,
  BsList,
  BsChevronDown,
  BsCalendar3,
  BsGrid3X3Gap,
  BsBarChart,
  BsListUl,
  BsTable,
  BsActivity
} from 'react-icons/bs'
import toast from 'react-hot-toast'
import { useAuth } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  errorText,
  dashboardBorderColor,
  dashboardMutedColor,
  dashboardPrimaryBg,
  dashboardPrimaryText,
  dashboardTextColor,
  dashboardPanelElevated,
  dashboardFocusRing,
  dashboardSurfaceHover,
  navbarWrap,
  navbarBtn,
  navbarIconBtn
} from '../Styles/common'
import { useNotificationStore } from '../store/notificationStore'

const navLinks = ['Workspaces', 'Templates', 'Help']

// The project-creation form lives in Projects.jsx (`ProjectCreateForm` and
// `CreateProjectModal`). This navbar used to carry a second, divergent copy of
// the same fields that no control could open, so it was removed: one form,
// one implementation.

// User Menu

function UserMenu({ onClose }) {
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/')
    onClose()
  }

  return (
    <div className="premium-card animate-enter absolute right-0 top-10 z-50 w-64 rounded-2xl py-2">
      <div className={`px-4 py-3 border-b ${dashboardBorderColor}`}>
        <p className="text-sm font-semibold text-white">
          {currentUser?.name || 'Kanvora User'}
        </p>
        <p className={`text-xs ${dashboardMutedColor}`}>
          {currentUser?.email || ''}
        </p>
        <span
          className={`text-[10px] bg-[#ff4d67]/20 ${dashboardPrimaryBg.replace('bg-', 'text-')} px-2 py-0.5 rounded-full mt-1 inline-block font-medium`}
        >
          {currentUser?.role || 'VIEWER'}
        </span>
      </div>

      <button
        onClick={() => {
          navigate('/main-page/profile')
          onClose()
        }}
        className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm ${dashboardTextColor} hover:bg-[#27272a] hover:text-white transition-colors`}
      >
        <BsPerson /> Profile
      </button>
      <button
        onClick={() => {
          navigate('/workspaces/settings/profile')
          onClose()
        }}
        className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm ${dashboardTextColor} hover:bg-[#27272a] hover:text-white transition-colors`}
      >
        <BsGear /> Settings
      </button>

      <hr className={`${dashboardBorderColor} my-1`} />

      <button
        onClick={handleLogout}
        className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm ${errorText} hover:bg-[#27272a] transition-colors`}
      >
        <BsBoxArrowRight /> Log out
      </button>
    </div>
  )
}

// Navbar

function Navbar({ onToggleSidebar, sidebarExpanded = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAuth()
  const { viewMode, setViewMode, activeFilter, setActiveFilter } =
    useProjectStore()
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspaceStore()
  const [searchFocused, setSearchFocused] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showFeatures, setShowFeatures] = useState(false)
  const { unreadCount, fetchNotifications, bindUserRoom } =
    useNotificationStore()
  const showViewSwitcher = location.pathname === '/main-page'

  const [templates, setTemplates] = useState([])
  const [users, setUsers] = useState([])
  const [searchingUsers, setSearchingUsers] = useState(false)

  // Fetch templates on mount
  useEffect(() => {
    if (currentUser) {
      axios
        .get(`${API_BASE_URL}/api/templates`, { withCredentials: true })
        .then((res) => setTemplates(res.data.payload || []))
        .catch(() => {})
    }
  }, [currentUser])

  // Debounced search for users
  useEffect(() => {
    const query = (activeFilter?.search || '').trim()
    const workspaceId = activeWorkspace?._id
    setUsers([])
    setSearchingUsers(false)
    if (!currentUser?._id || !workspaceId || !query) {
      return
    }

    const controller = new AbortController()
    setSearchingUsers(true)
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/search-all`, {
          params: { q: query, workspaceId },
          withCredentials: true,
          signal: controller.signal
        })
        if (!controller.signal.aborted) setUsers(res.data.payload || [])
      } catch {
        if (!controller.signal.aborted) setUsers([])
      } finally {
        if (!controller.signal.aborted) setSearchingUsers(false)
      }
    }, 250) // 250ms debounce

    return () => {
      clearTimeout(delayDebounce)
      controller.abort()
    }
  }, [activeFilter?.search, activeWorkspace?._id, currentUser?._id])

  const filteredWorkspaces = useMemo(() => {
    const query = (activeFilter?.search || '').trim().toLowerCase()
    if (!query) return []
    return workspaces.filter((ws) => ws.name?.toLowerCase().includes(query))
  }, [workspaces, activeFilter?.search])

  const filteredTemplates = useMemo(() => {
    const query = (activeFilter?.search || '').trim().toLowerCase()
    if (!query) return []
    return templates.filter((t) => {
      const isPersonal =
        t.creatorId === currentUser?._id ||
        t.creatorId?._id === currentUser?._id
      const isPublished = t.isPublished === true
      if (!isPersonal && !isPublished) return false

      const matchTitle = t.title?.toLowerCase().includes(query)
      const matchDesc = t.description?.toLowerCase().includes(query)
      return matchTitle || matchDesc
    })
  }, [templates, activeFilter?.search, currentUser?._id])

  // join personal socket room + initial fetch
  useEffect(() => {
    if (currentUser?._id) {
      bindUserRoom(currentUser._id)
      fetchNotifications()
    }
  }, [currentUser?._id, bindUserRoom, fetchNotifications])

  //close dropdowns on outside click
  useEffect(() => {
    const handler = () => {
      setShowUserMenu(false)
      setShowFeatures(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // Keyboard users close transient menus with Escape.
  useEffect(() => {
    if (!showUserMenu && !showFeatures) return
    const handler = (event) => {
      if (event.key !== 'Escape') return
      setShowUserMenu(false)
      setShowFeatures(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showUserMenu, showFeatures])

  const getInitials = (name) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header
      className={`${navbarWrap} min-w-0`}
      onClick={(e) => e.stopPropagation()}
    >
      {onToggleSidebar && (
        <button
          type="button"
          aria-label="Open sidebar"
          aria-expanded={sidebarExpanded}
          aria-controls="workspace-sidebar"
          onClick={onToggleSidebar}
          className={`${navbarIconBtn} lg:hidden shrink-0`}
        >
          <BsList className="text-lg" aria-hidden="true" />
        </button>
      )}

      {/* logo */}
      <button
        type="button"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 transition-colors hover:bg-white/[0.08]"
        onClick={() => navigate('/main-page')}
      >
        <img src={kanvoraLogo} alt="" className="w-5 h-5 rounded" />
        <span className="text-white font-bold text-sm">Kanvora</span>
      </button>

      {/* nav links */}
      <div className="hidden md:flex items-center gap-0.5 ml-1">
        {navLinks.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(`/${label.toLowerCase()}`)}
            className={navbarBtn}
          >
            {label}
          </button>
        ))}

        {/* Features dropdown */}
        {showViewSwitcher && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowFeatures((v) => !v)
                setShowUserMenu(false)
              }}
              aria-expanded={showFeatures}
              className={`flex items-center gap-1 px-2.5 h-8 rounded text-sm font-medium transition-colors ${
                showFeatures
                  ? 'bg-[#e63d581a] text-[#ff8aa0]'
                  : `${dashboardTextColor} ${dashboardSurfaceHover} hover:text-white`
              }`}
            >
              Features
              <BsChevronDown
                aria-hidden="true"
                className={`text-[10px] transition-transform duration-200 ${showFeatures ? 'rotate-180' : ''}`}
              />
            </button>

            {showFeatures && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFeatures(false)}
                />
                <div className="animate-enter absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-1.5 shadow-2xl backdrop-blur-2xl">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#a3a3ad]">
                    Switch View
                  </div>
                  {[
                    {
                      id: 'kanban',
                      label: 'Kanban',
                      icon: <BsGrid3X3Gap />,
                      description: 'Organize tasks visually on dynamic boards.'
                    },
                    {
                      id: 'table',
                      label: 'Table',
                      icon: <BsTable />,
                      description: 'View tasks in a spreadsheet-style grid.'
                    },
                    {
                      id: 'calendar',
                      label: 'Calendar',
                      icon: <BsCalendar3 />,
                      description: 'Schedule tasks and track timelines.'
                    },
                    {
                      id: 'analytics',
                      label: 'Analytics',
                      icon: <BsBarChart />,
                      description: 'Gain insights into workload and metrics.'
                    },
                    {
                      id: 'list',
                      label: 'List',
                      icon: <BsListUl />,
                      description: 'Focus on clean check-lists and to-dos.'
                    },
                    {
                      id: 'activity',
                      label: 'Activity',
                      icon: <BsActivity />,
                      description:
                        'Track changes and see recent workspace activity.'
                    }
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setViewMode(option.id)
                        setShowFeatures(false)
                      }}
                      className={`group flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition ${
                        viewMode === option.id
                          ? 'bg-[#ff4d67]/10 text-white'
                          : 'text-[var(--dash-text-dark)] hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <span
                        className={`text-lg p-2 rounded-lg bg-white/[0.03] transition-colors mt-0.5 ${
                          viewMode === option.id
                            ? 'text-[#ff4d67] bg-[#ff4d67]/10'
                            : 'text-[#a3a3ad] group-hover:text-white group-hover:bg-white/[0.08]'
                        }`}
                      >
                        {option.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">
                            {option.label}
                          </span>
                          {viewMode === option.id && (
                            <div className="ml-1 h-1.5 w-1.5 rounded-full bg-[#ff4d67] shadow-[0_0_8px_#ff4d67]" />
                          )}
                        </div>
                        <span className="block text-[10px] mt-0.5 leading-relaxed text-[#8c9bab] group-hover:text-white/70">
                          {option.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* search - centred */}
      <div className="flex-1 flex justify-end md:justify-center px-1 sm:px-4 min-w-0">
        <div className="relative flex items-center transition-all duration-200 w-full max-w-[12rem] sm:max-w-[16rem] lg:max-w-[20rem]">
          <BsSearch
            className={`absolute left-2.5 ${dashboardMutedColor} text-sm pointer-events-none`}
          />
          <input
            type="text"
            placeholder="Search..."
            aria-label="Search workspace"
            value={activeFilter?.search || ''}
            onChange={(e) => setActiveFilter({ search: e.target.value })}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className={`w-full ${dashboardPanelElevated} border ${dashboardBorderColor} rounded-lg h-8 pl-8 pr-3 text-sm ${dashboardTextColor} placeholder:text-[#8c9bab] focus:outline-none focus:border-[#ff4d67] focus:bg-[#050505] ${dashboardFocusRing} transition-all duration-200 ${
              searchFocused ? 'md:max-w-[20rem]' : ''
            }`}
          />

          {/* Search Results Dropdown */}
          {searchFocused && (activeFilter?.search || '').trim().length > 0 && (
            <div
              role="region"
              aria-label="Search results"
              className="absolute top-full right-0 z-50 mt-2 rounded-xl border border-white/[0.08] bg-[#0c0c0e]/95 p-2.5 shadow-2xl backdrop-blur-2xl max-h-[24rem] overflow-y-auto app-scrollbar w-[16rem] sm:w-[20rem] lg:w-[24rem]"
              onMouseDown={(e) => e.preventDefault()}
            >
              {/* Workspaces Section */}
              <div className="mb-3">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                  Workspaces
                </div>
                {filteredWorkspaces.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-[#71717a] italic">
                    No matching workspaces
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 mt-1">
                    {filteredWorkspaces.map((ws) => (
                      <button
                        key={ws._id}
                        type="button"
                        onClick={() => {
                          setActiveWorkspace(ws)
                          setActiveFilter({ search: '' })
                          if (!location.pathname.startsWith('/workspaces')) {
                            navigate('/main-page')
                          }
                          toast.success(`Switched to workspace: ${ws.name}`)
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-white hover:bg-white/[0.06] transition-colors w-full"
                      >
                        <span className="w-5 h-5 rounded bg-linear-to-br from-[var(--kt-accent)] to-[var(--kt-accent-strong)] flex items-center justify-center text-[var(--kt-on-accent)] text-[10px] font-bold shrink-0">
                          {ws.name?.slice(0, 1).toUpperCase() || 'W'}
                        </span>
                        <span className="truncate flex-1">{ws.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Templates Section */}
              <div className="mb-3">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                  Templates
                </div>
                {filteredTemplates.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-[#71717a] italic">
                    No matching templates
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 mt-1">
                    {filteredTemplates.map((t) => {
                      const isPersonal =
                        t.creatorId === currentUser?._id ||
                        t.creatorId?._id === currentUser?._id
                      const isPublished = t.isPublished === true
                      return (
                        <button
                          key={t._id}
                          type="button"
                          onClick={() => {
                            setActiveFilter({ search: '' })
                            navigate(`/templates?selected=${t._id}`)
                          }}
                          className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg text-left hover:bg-white/[0.06] transition-colors w-full"
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="text-xs font-semibold text-white truncate flex-1">
                              {t.title}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              {isPersonal && (
                                <span className="text-[8px] bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded font-medium">
                                  Personal
                                </span>
                              )}
                              {isPublished && (
                                <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-medium">
                                  Published
                                </span>
                              )}
                            </div>
                          </div>
                          {t.description && (
                            <span className="text-[10px] text-[#71717a] truncate">
                              {t.description}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Users Section */}
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center justify-between">
                  <span>Users</span>
                  {searchingUsers && (
                    <span className="text-[9px] text-[#ff4d67] animate-pulse">
                      Searching...
                    </span>
                  )}
                </div>
                {users.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-[#71717a] italic">
                    {searchingUsers
                      ? 'Searching users...'
                      : 'No matching users'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 mt-1">
                    {users.map((user) => (
                      <button
                        key={user._id}
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(user.email)
                          toast.success(
                            `Copied email to clipboard: ${user.email}`
                          )
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-white hover:bg-white/[0.06] transition-colors w-full"
                        title="Click to copy email"
                      >
                        <div className="w-5 h-5 rounded-full bg-[#ff4d67]/20 text-[#ff8aa0] flex items-center justify-center text-[9px] font-bold shrink-0">
                          {user.profilePic ? (
                            <img
                              src={user.profilePic}
                              alt="avatar"
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            getInitials(user.name)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white truncate">{user.name}</div>
                          <div className="text-[10px] text-[#71717a] truncate">
                            {user.email}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* right icons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* notifications with badge */}
        <div className="relative">
          <button
            type="button"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            onClick={() => navigate('/main-page/notifications')}
            className={navbarIconBtn}
          >
            <BsBell className="text-base" aria-hidden="true" />
          </button>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[#e11d48] rounded-full text-[9px] text-white font-bold flex items-center justify-center ring-2 ring-[#09090b]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {/* user avatar */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowUserMenu((v) => !v)
              setShowFeatures(false)
            }}
            aria-label={`Account menu for ${currentUser?.name || 'Kanvora user'}`}
            aria-expanded={showUserMenu}
            className={`w-8 h-8 rounded-full ${dashboardPrimaryBg} flex items-center justify-center ${dashboardPrimaryText} text-xs font-bold ml-1 hover:opacity-90 transition-opacity`}
          >
            {currentUser?.profilePic ? (
              <img
                src={currentUser.profilePic}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(currentUser?.name)
            )}
          </button>
          {showUserMenu && <UserMenu onClose={() => setShowUserMenu(false)} />}
        </div>
      </div>
    </header>
  )
}

export default Navbar
