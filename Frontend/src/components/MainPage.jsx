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

  // The month of the calendar view: every day with the projects that were
  // updated on it. Both the narrow agenda and the wide grid read from this.
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    const days = []

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dateStr = date.toDateString()
      const dayProjects = filteredProjects.filter(
        (p) => new Date(p.updatedAt || p.createdAt).toDateString() === dateStr
      )

      days.push({
        day: d,
        dateStr,
        isToday: new Date().toDateString() === dateStr,
        dayProjects,
        label: date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      })
    }

    return { firstDay, days }
  }, [currentDate, filteredProjects])

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
            className="h-10 rounded-lg border border-white/[0.08] bg-[#0a0a0a] px-3 text-sm text-white outline-none transition focus:border-[#ff4d67] focus:ring-2 focus:ring-[#ff4d67]/20 app-native-select"
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
            {/* The workload panel is a dashboard surface, so it follows the
                theme like the rest of the page instead of staying a fixed
                black box. */}
            <div className="absolute inset-0 bg-[var(--kt-surface-soft)] z-0" />
            <div className="relative z-10">
              <h3 className="mb-6 text-sm font-bold text-[var(--kt-text)] flex items-center gap-2">
                <BsBarChart className="text-[var(--kt-accent-text)]" /> Team Workload
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(Array.isArray(analytics?.workload) ? analytics.workload : Object.entries(analytics?.workload || { unassigned: 0 }).map(([user, count]) => ({ userId: user === 'unassigned' ? null : user, name: user === 'unassigned' ? 'Unassigned' : user, count }))).map(
                  (entry) => (
                    <div
                      key={entry.userId || 'unassigned'}
                      className="rounded-xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-4 backdrop-blur-md hover:bg-[var(--kt-surface-soft)] transition-colors"
                    >
                      <p className="truncate text-sm font-semibold text-[var(--kt-text)] mb-3">
                        {entry.name}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--kt-surface-soft)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--kt-accent)] to-[var(--kt-accent-hover)] shadow-[0_0_10px_var(--kt-accent)]"
                            style={{
                              width: `${Math.min(100, Number(entry.count) * 12)}%`
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[var(--kt-muted)]">{entry.count} card{entry.count === 1 ? '' : 's'}</span>
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
            {filteredProjects.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-[var(--dash-text-dark)]">No projects found.</div>
            ) : (
              <>
                {/* Narrow viewports: one stacked card per project so the name,
                    the status pill and the date stay legible instead of being
                    squeezed into three clipped columns. The header row does
                    not exist on a phone, so every value carries its own
                    label. */}
                <div className="divide-y divide-[var(--kt-border)] sm:hidden">
                  {filteredProjects.map((project) => (
                    <div
                      key={project._id}
                      className="group bg-[var(--kt-surface)] px-4 py-4 text-sm transition-all hover:bg-[var(--kt-surface-soft)]"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-1 w-2.5 h-2.5 shrink-0 rounded-full ${project.color ? 'bg-gradient-to-br ' + project.color : 'bg-[var(--kt-border-strong)] shadow-inner'}`} aria-hidden="true" />
                        <span className="font-semibold text-[var(--kt-text)] break-words">
                          <span className="sr-only">Project: </span>
                          {project.title || project.name}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[18px]">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${project.archivedAt ? 'bg-[var(--kt-surface-soft)] text-[var(--kt-muted)]' : 'bg-[var(--kt-accent-soft)] text-[var(--kt-accent-text)] border border-[var(--kt-border-strong)]'}`}>
                          <span className="sr-only">Status: </span>
                          {project.archivedAt ? 'Archived' : 'Active'}
                        </span>
                        <span className="text-[var(--kt-muted)] font-medium">
                          <span className="sr-only">Last updated: </span>
                          Updated {new Date(project.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Wide viewports: a real table. The column widths mirror the
                    5/3/4 proportions the grid used, so the rows keep the same
                    shape they had before. */}
                <div className="hidden sm:block">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <caption className="sr-only">
                      Projects in {activeWorkspace?.name || 'this workspace'}
                    </caption>
                    <colgroup>
                      <col className="w-5/12" />
                      <col className="w-3/12" />
                      <col className="w-4/12" />
                    </colgroup>
                    <thead>
                      <tr className="bg-[var(--kt-surface-soft)]">
                        <th
                          scope="col"
                          className="border-b border-[var(--kt-border)] px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--kt-muted)]"
                        >
                          Project
                        </th>
                        <th
                          scope="col"
                          className="border-b border-[var(--kt-border)] px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--kt-muted)]"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="border-b border-[var(--kt-border)] px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--kt-muted)]"
                        >
                          Last updated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--kt-border)]">
                      {filteredProjects.map((project) => (
                        <tr
                          key={project._id}
                          className="group bg-[var(--kt-surface)] transition-all hover:bg-[var(--kt-surface-soft)]"
                        >
                          <td className="px-6 py-4 align-middle">
                            <div className="flex items-center gap-3">
                              <div className={`w-2.5 h-2.5 shrink-0 rounded-full ${project.color ? 'bg-gradient-to-br ' + project.color : 'bg-[var(--kt-border-strong)] shadow-inner'}`} aria-hidden="true" />
                              <span className="font-semibold text-[var(--kt-text)] group-hover:text-[var(--kt-accent-text)] transition-colors break-words">
                                {project.title || project.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${project.archivedAt ? 'bg-[var(--kt-surface-soft)] text-[var(--kt-muted)]' : 'bg-[var(--kt-accent-soft)] text-[var(--kt-accent-text)] border border-[var(--kt-border-strong)]'}`}>
                              {project.archivedAt ? 'Archived' : 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-middle text-[var(--kt-muted)] font-medium">
                            {new Date(project.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
                <button type="button"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white shadow-sm"
                  aria-label="Previous month"
                >
                  <BsChevronLeft />
                </button>
                <button type="button"
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#ff4d67]/10 text-[#ff4d67] hover:bg-[var(--kt-accent-hover)] transition-colors"
                >
                  Today
                </button>
                <button type="button"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white shadow-sm"
                  aria-label="Next month"
                >
                  <BsChevronRight />
                </button>
              </div>
            </div>

            {/* Narrow viewports: a seven-column grid cannot fit seven usable
                columns on a phone, so the month becomes an agenda list of the
                days that actually carry projects. */}
            <div className="sm:hidden space-y-2">
              {monthDays.days.filter((day) => day.dayProjects.length > 0).length === 0 ? (
                <p className="px-1 py-6 text-center text-sm on-scrim-muted">
                  No projects updated this month.
                </p>
              ) : (
                monthDays.days
                  .filter((day) => day.dayProjects.length > 0)
                  .map((day) => (
                    <div
                      key={day.day}
                      className="rounded-xl border border-[var(--kt-border)] bg-[var(--kt-surface)] px-4 py-3"
                    >
                      <p className="text-sm font-bold text-[var(--kt-text)]">{day.label}</p>
                      <ul className="mt-2 space-y-1">
                        {day.dayProjects.map((p) => (
                          <li
                            key={p._id}
                            className="truncate rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface-soft)] px-2 py-1 text-xs text-[var(--kt-text)]"
                          >
                            {p.title || p.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
              )}
            </div>

            {/* Wide viewports: the month grid. */}
            <div className="hidden sm:grid grid-cols-7 gap-px bg-[var(--kt-border)] rounded-xl overflow-hidden border border-[var(--kt-border)]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-[var(--kt-surface-soft)] p-3 text-center text-xs font-bold text-[var(--kt-muted)] uppercase tracking-wider">
                  {day}
                </div>
              ))}

              {Array.from({ length: monthDays.firstDay }, (_, i) => (
                <div key={`empty-${i}`} className="bg-[var(--kt-surface)] min-h-[110px] p-2" />
              ))}

              {monthDays.days.map(({ day, isToday, dayProjects }) => (
                <div key={day} className={`bg-[var(--kt-surface)] min-h-[110px] p-2 transition-colors hover:bg-[var(--kt-surface-soft)] ${isToday ? 'ring-1 ring-inset ring-[var(--kt-accent)] bg-[var(--kt-accent-soft)]' : ''}`}>
                  <div className={`text-xs font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[var(--kt-accent)] text-[var(--kt-on-accent)] shadow-[0_0_10px_var(--kt-accent)]' : 'text-[var(--kt-muted)]'}`}>
                    {day}
                  </div>
                  <div className="flex flex-col gap-1 mt-1 overflow-hidden h-[72px] app-scrollbar">
                    {dayProjects.map(p => (
                      <div
                        key={p._id}
                        className={`text-[10px] font-medium px-1.5 py-1 rounded truncate shadow-sm backdrop-blur-md border border-[var(--kt-border)] ${p.color ? 'bg-gradient-to-br ' + p.color + ' on-scrim' : 'bg-[var(--kt-surface-soft)] text-[var(--kt-text)]'}`}
                        title={p.title || p.name}
                      >
                        {p.title || p.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {Array.from({
                length: (7 - (monthDays.days.length + monthDays.firstDay) % 7) % 7
              }, (_, i) => (
                <div key={`empty-end-${i}`} className="bg-[var(--kt-surface)] min-h-[110px] p-2" />
              ))}
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
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg border border-white/10 ${project.color ? 'bg-gradient-to-br ' + project.color : 'bg-[var(--kt-surface-raised)]'}`}>
                    <BsGrid3X3Gap className={project.color ? "text-white" : "text-[var(--kt-text)]/40"} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--kt-text)]/90 group-hover:text-white transition-colors">
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
                          {activity.targetModel && <span className="font-medium text-[var(--kt-text)]/80">{activity.targetModel.toLowerCase()}</span>}
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
