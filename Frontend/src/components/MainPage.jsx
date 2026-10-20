import { dashboardBgColor } from '../Styles/common'
// MainPage component: renders a focused piece of the Kanvora UI.
import { useEffect, useMemo, useState } from 'react'
import {
  BsBarChart,
  BsCalendar3,
  BsGrid3X3Gap,
  BsListUl,
  BsPlusLg,
  BsTable,
  BsActivity,
  BsChevronLeft,
  BsChevronRight
} from 'react-icons/bs'
import Sidebar from './Sidebar'
import Projects from './Projects'
import Navbar from './Navbar'
import { Outlet } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { useWorkspaceStore } from '../store/workspaceStore'

const viewOptions = [
  { id: 'kanban', label: 'Kanban', icon: <BsGrid3X3Gap /> },
  { id: 'table', label: 'Table', icon: <BsTable /> },
  { id: 'calendar', label: 'Calendar', icon: <BsCalendar3 /> },
  { id: 'analytics', label: 'Analytics', icon: <BsBarChart /> },
  { id: 'list', label: 'List', icon: <BsListUl /> },
  { id: 'activity', label: 'Activity', icon: <BsActivity /> }
]

function WorkspaceDashboard({ viewMode }) {
  const { projects, activeFilter, setActiveFilter, saveFilter, savedFilters } =
    useProjectStore()
  const { activeWorkspace, analytics, fetchWorkspaceAnalytics } =
    useWorkspaceStore()
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useEffect(() => {
    if (activeWorkspace?._id && (viewMode === 'analytics' || viewMode === 'activity')) {
      fetchWorkspaceAnalytics(activeWorkspace._id, {
        search: activeFilter.search,
        status: activeFilter.status
      })
    }
  }, [
    activeWorkspace?._id,
    fetchWorkspaceAnalytics,
    viewMode,
    activeFilter.search,
    activeFilter.status
  ])

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const title = (project.title || project.name || '').toLowerCase()
        const matchesSearch = title.includes(activeFilter.search.toLowerCase())
        const archivedMatch =
          activeFilter.status === 'ARCHIVED'
            ? project.archivedAt
            : activeFilter.status === 'ACTIVE'
              ? !project.archivedAt
              : true
        return matchesSearch && archivedMatch
      }),
    [activeFilter.search, activeFilter.status, projects]
  )

  if (viewMode === 'kanban') return <Projects />

  return (
    <div className="flex-1 overflow-y-auto premium-app-bg px-4 py-5 text-[var(--dash-text-main)] app-scrollbar sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <select
            value={activeFilter.status}
            onChange={(event) =>
              setActiveFilter({ status: event.target.value })
            }
            className="h-10 rounded-lg border border-white/[0.08] bg-[#0a0a0a] px-3 text-sm text-white outline-none transition focus:border-[#ff4d67] focus:ring-2 focus:ring-[#ff4d67]/20"
          >
            <option value="ALL">All states</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button
            type="button"
            onClick={() => saveFilter(`Filter ${savedFilters.length + 1}`)}
            className="premium-button-glow h-10 rounded-lg bg-[#ff4d67] px-3 text-sm font-semibold text-white transition hover:bg-[#ff6b82]"
          >
            Save filter
          </button>
        </div>
      </div>

      {viewMode === 'analytics' && (
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            {[
              ['Projects', analytics?.totals?.projects ?? 0, <BsGrid3X3Gap key="icon1" className="text-xl" />],
              ['Open cards', analytics?.totals?.cards ?? 0, <BsListUl key="icon2" className="text-xl" />],
              ['Open invites', analytics?.totals?.invitations ?? 0, <BsActivity key="icon3" className="text-xl" />]
            ].map(([label, value, icon]) => (
              <div key={label} className="relative overflow-hidden premium-card rounded-2xl p-6 group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#ff4d67]/10 rounded-full blur-2xl group-hover:bg-[#ff4d67]/20 transition-all duration-500" />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--dash-text-dark)] mb-1">
                      {label}
                    </p>
                    <p className="text-3xl font-black text-white">{value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#ff4d67] shadow-inner border border-white/5">
                    {icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="premium-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#111] via-[#111] to-[#1a1a1a] z-0" />
            <div className="relative z-10">
              <h3 className="mb-6 text-sm font-bold text-white flex items-center gap-2">
                <BsBarChart className="text-[#ff4d67]" /> Team Workload
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(Array.isArray(analytics?.workload) ? analytics.workload : Object.entries(analytics?.workload || { unassigned: 0 }).map(([user, count]) => ({ userId: user === 'unassigned' ? null : user, name: user === 'unassigned' ? 'Unassigned' : user, count }))).map(
                  (entry) => (
                    <div
                      key={entry.userId || 'unassigned'}
                      className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md hover:bg-black/60 transition-colors"
                    >
                      <p className="truncate text-sm font-semibold text-white/90 mb-3">
                        {entry.name}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--kt-accent)] to-[var(--kt-accent-hover)] shadow-[0_0_10px_var(--kt-accent)]"
                            style={{
                              width: `${Math.min(100, Number(entry.count) * 12)}%`
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[var(--dash-text-dark)]">{entry.count} card{entry.count === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'table' && (
        <div className="mx-auto max-w-5xl">
          <div className="premium-card overflow-hidden rounded-2xl border border-white/10">
            <div className="bg-black/40 px-6 py-4 border-b border-white/5 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-5 text-xs font-bold uppercase tracking-wider text-[var(--dash-text-dark)]">Project Name</div>
              <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-[var(--dash-text-dark)]">Status</div>
              <div className="col-span-4 text-xs font-bold uppercase tracking-wider text-[var(--dash-text-dark)]">Last Updated</div>
            </div>
            <div className="divide-y divide-white/5">
              {filteredProjects.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-[var(--dash-text-dark)]">No projects found.</div>
              ) : (
                filteredProjects.map((project) => (
                  <div
                    key={project._id}
                    className="group grid grid-cols-12 gap-4 items-center bg-[#111]/80 px-6 py-4 text-sm transition-all hover:bg-white/[0.02]"
                  >
                    <div className="col-span-5 flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${project.color ? 'bg-gradient-to-br ' + project.color : 'bg-white/20 shadow-inner'}`} />
                      <span className="font-semibold text-white group-hover:text-[#ff4d67] transition-colors">
                        {project.title || project.name}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${project.archivedAt ? 'bg-white/10 text-white/60' : 'bg-[#ff4d67]/10 text-[#ff4d67] border border-[#ff4d67]/20'}`}>
                        {project.archivedAt ? 'Archived' : 'Active'}
                      </span>
                    </div>
                    <div className="col-span-4 text-[var(--dash-text-dark)] font-medium">
                      {new Date(project.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="mx-auto max-w-5xl">
          <div className="premium-card rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-white">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white shadow-sm"
                  aria-label="Previous month"
                >
                  <BsChevronLeft />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#ff4d67]/10 text-[#ff4d67] hover:bg-[#ff4d67]/20 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white shadow-sm"
                  aria-label="Next month"
                >
                  <BsChevronRight />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-[#111] p-3 text-center text-xs font-bold text-[var(--dash-text-dark)] uppercase tracking-wider">
                  {day}
                </div>
              ))}
              
              {(() => {
                const year = currentDate.getFullYear()
                const month = currentDate.getMonth()
                const firstDay = new Date(year, month, 1).getDay()
                const daysInMonth = new Date(year, month + 1, 0).getDate()
                
                const cells = []
                
                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} className="bg-[#0a0a0a]/50 min-h-[110px] p-2" />)
                }
                
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = new Date(year, month, d).toDateString()
                  const isToday = new Date().toDateString() === dateStr
                  
                  const dayProjects = filteredProjects.filter(p => 
                    new Date(p.updatedAt || p.createdAt).toDateString() === dateStr
                  )
                  
                  cells.push(
                    <div key={d} className={`bg-[#111] min-h-[110px] p-2 transition-colors hover:bg-[#1a1a1a] ${isToday ? 'ring-1 ring-inset ring-[#ff4d67]/50 bg-[#ff4d67]/5' : ''}`}>
                      <div className={`text-xs font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#ff4d67] text-white shadow-[0_0_10px_#ff4d6780]' : 'text-white/60'}`}>
                        {d}
                      </div>
                      <div className="flex flex-col gap-1 mt-1 overflow-hidden h-[72px] app-scrollbar">
                        {dayProjects.map(p => (
                          <div 
                            key={p._id}
                            className={`text-[10px] font-medium px-1.5 py-1 rounded truncate shadow-sm backdrop-blur-md border border-white/10 ${p.color ? 'bg-gradient-to-br ' + p.color : 'bg-white/10'} text-white/90`}
                            title={p.title || p.name}
                          >
                            {p.title || p.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                
                const remainingCells = (7 - (cells.length % 7)) % 7
                for (let i = 0; i < remainingCells; i++) {
                  cells.push(<div key={`empty-end-${i}`} className="bg-[#0a0a0a]/50 min-h-[110px] p-2" />)
                }
                
                return cells
              })()}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="mx-auto max-w-4xl space-y-3">
          {filteredProjects.length === 0 ? (
            <div className="premium-card rounded-2xl px-6 py-8 text-center text-sm text-[var(--dash-text-dark)]">
              No projects found.
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div
                key={project._id}
                className="premium-card group relative flex items-center justify-between rounded-xl px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg border border-white/10 ${project.color ? 'bg-gradient-to-br ' + project.color : 'bg-[#1a1a1a]'}`}>
                    <BsGrid3X3Gap className={project.color ? "text-white" : "text-white/40"} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white/90 group-hover:text-white transition-colors">
                      {project.title || project.name}
                    </h3>
                    <p className="text-xs text-[var(--dash-text-dark)] mt-0.5">
                      Updated {new Date(project.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-all group-hover:bg-[#ff4d67]/20 text-[#ff4d67]">
                  <BsChevronRight />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === 'activity' && (
        <div className="mx-auto max-w-3xl">
          <div className="premium-card rounded-xl p-6">
            <h2 className="mb-6 text-lg font-semibold text-white">Activity Feed</h2>
            <div className="space-y-6 border-l-2 border-[#ff4d67]/30 pl-4">
              {analytics?.recentActivity?.length > 0 ? (
                analytics.recentActivity.map((activity) => (
                  <div key={activity._id} className="relative">
                    <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-[#ff4d67] ring-4 ring-[#0a0a0a]" />
                    <div className="flex items-start gap-4">
                      {activity.actor?.profilePic ? (
                        <img src={activity.actor.profilePic} alt="avatar" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff4d67]/20 font-bold text-[#ff4d67]">
                          {(activity.actor?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-white">
                          <span className="font-semibold">{activity.actor?.name || 'Unknown User'}</span>{' '}
                          <span className="text-[var(--dash-text-dark)]">{activity.action.replace(/_/g, ' ').toLowerCase()}</span>{' '}
                          {activity.targetModel && <span className="font-medium text-white/80">{activity.targetModel.toLowerCase()}</span>}
                        </p>
                        <p className="mt-1 text-xs text-[var(--dash-text-dark)]">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--dash-text-dark)]">No recent activity.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MainPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { viewMode } = useProjectStore()

  const activeOption = useMemo(
    () => viewOptions.find((o) => o.id === viewMode) || viewOptions[0],
    [viewMode]
  )

  return (
    // relative so absolute/fixed child overlays (Settings, Notifications, Profile) position correctly
    <div
      className={`relative flex flex-col h-screen ${dashboardBgColor} overflow-hidden`}
    >
      <Navbar onToggleSidebar={() => setSidebarOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative z-20 flex items-center gap-4 border-b border-white/[0.07] bg-[#050505]/86 px-4 py-2 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#a3a3ad]">
              <span>Active:</span>
              <span className="flex items-center gap-1.5 text-[#ff4d67]">
                {activeOption.icon}
                {activeOption.label}
              </span>
            </div>
          </div>
          <WorkspaceDashboard viewMode={viewMode} />
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="premium-button-glow fixed bottom-5 right-5 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#ff4d67] text-white shadow-2xl ring-1 ring-white/10 transition hover:bg-[#ff6b82] lg:hidden"
            aria-label="Quick actions"
          >
            <BsPlusLg />
          </button>
        </main>
      </div>
      {/* nested overlays render above the dashboard */}
      <Outlet />
    </div>
  )
}

export default MainPage
