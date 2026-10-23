// Notifications component: full notification panel with invite accept/reject support.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  BsBell,
  BsCheck2All,
  BsTrash,
  BsCreditCard,
  BsPeopleFill,
  BsEnvelopeCheck,
  BsCheckCircle,
  BsXCircle,
  BsX,
  BsDot
} from 'react-icons/bs'
import { useNotificationStore } from '../store/notificationStore'
import { Skeleton } from './ui/skeleton'
import {
  dashboardMutedColor,
  dashboardPanelElevated,
  dashboardTextColor,
  overlayCloseBtn,
  overlayHeader,
  overlayPanel,
  overlayTitle
} from '../Styles/common'

// ─── helpers ─────────────────────────────────────────────────────────────────

const typeIcon = (type, status) => {
  if (type === 'invite') {
    if (status === 'accepted') return <BsCheckCircle className="text-emerald-400" />
    if (status === 'rejected') return <BsXCircle className="text-[var(--kt-muted)]" />
    return <BsEnvelopeCheck className="text-[#ff8aa0]" />
  }
  const map = {
    card: <BsCreditCard className="text-blue-400" />,
    member: <BsPeopleFill className="text-green-400" />,
    mention: <span className="text-purple-400 font-bold text-sm">@</span>,
    activity: <BsBell className="text-amber-400" />,
    default: <BsBell className="text-[var(--kt-muted)]" />
  }
  return map[type] ?? map.default
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const statusBadge = (status) => {
  if (status === 'accepted')
    return (
      <span className="ml-auto text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full whitespace-nowrap">
        Accepted
      </span>
    )
  if (status === 'rejected')
    return (
      <span className="ml-auto text-[10px] font-semibold text-[#8c9bab] bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full whitespace-nowrap">
        Rejected
      </span>
    )
  return null
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotificationListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-[#2c333a]">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-5 py-4">
          {/* The shared primitive ships a 12px default radius, so the shapes
              that need their own radius override it explicitly. */}
          <Skeleton className="w-8 h-8 rounded-full! shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 rounded! w-5/6" />
            <Skeleton className="h-2.5 rounded! w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function Notifications() {
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    total,
    hasMore,
    paginationApproximate,
    loading,
    loadingMore,
    fetchNotifications,
    loadMoreNotifications,
    markRead,
    markAllRead,
    deleteNotif,
    acceptInvite,
    rejectInvite,
    writeError
  } = useNotificationStore()
  const listRef = useRef(null)

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleAccept = async (id) => {
    try {
      await acceptInvite(id)
      toast.success('Joined project successfully!')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not accept invite')
    }
  }

  const handleDelete = async (id) => {
    await deleteNotif(id)
    // The row that held focus is gone. Focus the list itself, which is the
    // nearest stable container, instead of dropping focus to the document.
    listRef.current?.focus?.()
  }

  const handleReject = async (id) => {
    try {
      await rejectInvite(id)
      toast('Invite declined', { icon: '👋' })
    } catch {
      toast.error('Could not reject invite')
    }
  }

  const tabs = [
    // The page is not the account: the badge reports what the server says
    // exists, not what happens to be loaded.
    { id: 'all', label: 'All', count: total },
    { id: 'unread', label: 'Unread', count: unreadCount },
    // No badge. An invite count could only be a filter over the loaded page,
    // and three badges with two different meanings read as three facts.
    { id: 'invites', label: 'Invites', count: null }
  ]
  const [filter, setFilter] = useState('all')

  const filtered =
    filter === 'unread'
      ? notifications.filter((n) => !n.read)
      : filter === 'invites'
      ? notifications.filter((n) => n.type === 'invite')
      : notifications

  const loadedUnread = notifications.filter((n) => !n.read).length
  // Only say rows are missing while there is a page left to ask for. Once every
  // page is loaded the difference can only come from a change this client has
  // not fetched, and no control on this screen could clear it.
  const unreadBeyondLoaded = filter === 'unread' && hasMore && loadedUnread < unreadCount
  // A delete inside the loaded window shifts the server's offset pagination, so
  // the difference stops being an exact count.
  const remaining = paginationApproximate ? null : Math.max(0, total - notifications.length)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/55"
        onClick={() => navigate('/main-page')}
      />

      {/* panel */}
      <div className={`${overlayPanel} max-w-md`}>
        {/* header */}
        <div className={overlayHeader}>
          <div className="flex items-center gap-2">
            <h1 className={overlayTitle}>Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-[#e11d48] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button type="button"
                onClick={markAllRead}
                className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#ff8aa0] hover:bg-[#ff4d67]/10 transition-colors"
              >
                <BsCheck2All /> Mark all read
              </button>
            )}
            <button type="button"
              onClick={() => navigate('/main-page')}
              className={overlayCloseBtn}
              aria-label="Close notifications"
            >
              <BsX className="text-xl" />
            </button>
          </div>
        </div>

        {/* filter tabs */}
        <div className="flex gap-2 border-b border-[#2c333a] px-5 py-3 overflow-x-auto">
          {tabs.map((tab) => (
            <button type="button"
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-[#ff4d67] text-white'
                  : 'bg-[#22272b] text-[#b6c2cf] hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    filter === tab.id
                      ? 'bg-black/15 on-accent'
                      : 'bg-[var(--kt-bg)] text-[#8c9bab]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          {unreadCount > 0 && (
            <button type="button"
              onClick={markAllRead}
              className="ml-auto sm:hidden rounded-full px-3 py-1.5 text-xs font-semibold text-[#ff8aa0] hover:bg-[#ff4d67]/10 whitespace-nowrap"
            >
              Read all
            </button>
          )}
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto app-scrollbar" ref={listRef} tabIndex={-1} data-testid="notification-list">
          {writeError && (
            <p role="alert" className="border-b border-[#2c333a] bg-[#ff4d67]/10 px-5 py-3 text-[11px] leading-snug text-[#ff8aa0]">
              {writeError}
            </p>
          )}
          {unreadBeyondLoaded && !loading && (
            <p className="border-b border-[#2c333a] px-5 py-3 text-[11px] text-[#8c9bab]">
              Some older unread notifications are not loaded.
            </p>
          )}
          {loading ? (
            <NotificationListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${dashboardPanelElevated}`}>
                <BsBell className="text-2xl text-[#ff8aa0]" />
              </div>
              <p className="text-sm font-semibold text-white">
                {filter === 'unread' ? 'No unread notifications' : filter === 'invites' ? 'No invites' : 'No notifications yet'}
              </p>
              <p className={`text-xs ${dashboardMutedColor} mt-1`}>
                Updates will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[#2c333a]">
              {filtered.map((n) => (
                <article
                  key={n._id}
                  data-notification-id={n._id}
                  // Pointer convenience only: every action below is also a real
                  // button, so the keyboard path never depends on this handler.
                  onClick={() => !n.read && markRead(n._id)}
                  className={`relative flex flex-col gap-2 px-5 py-4 group transition-colors ${
                    n.read
                      ? 'hover:bg-[#22272b]'
                      : 'cursor-pointer bg-[#ff4d67]/10 hover:bg-[#ff4d67]/14'
                  }`}
                >
                  {/* top row */}
                  <div className="flex items-start gap-3">
                    {!n.read && (
                      <span className="absolute left-2 top-5 w-1.5 h-1.5 bg-[#ff8aa0] rounded-full" />
                    )}
                    <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full ${dashboardPanelElevated} flex items-center justify-center`}>
                      {typeIcon(n.type, n.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-relaxed ${n.read ? dashboardMutedColor : `${dashboardTextColor} font-medium`}`}>
                        {n.message}
                      </p>
                      {n.project?.name && (
                        <p className="text-[10px] text-[#ff8aa0] mt-0.5 font-medium">
                          {n.project.name}
                        </p>
                      )}
                      <p className="text-[10px] text-[#8c9bab] mt-1 flex items-center gap-1">
                        {!n.read && <BsDot className="text-[#ff8aa0]" />}
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {/* status badge for resolved invites */}
                    {n.type === 'invite' && n.status !== 'pending' && statusBadge(n.status)}
                    {!n.read && (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); markRead(n._id) }}
                        className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold text-[#ff8aa0] transition-colors hover:bg-[#ff4d67]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8aa0]"
                        aria-label="Mark as read"
                      >
                        Mark read
                      </button>
                    )}
                    {/* delete button */}
                    {!(n.type === 'invite' && n.status === 'pending') && (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(n._id) }}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 sm:group-focus-within:opacity-100 text-[#8c9bab] hover:text-[#fb7185] transition-all p-1 rounded shrink-0 hover:bg-[#101418]"
                        aria-label="Delete notification"
                      >
                        <BsTrash className="text-xs" />
                      </button>
                    )}
                  </div>

                  {/* invite action buttons */}
                  {n.type === 'invite' && n.status === 'pending' && (
                    <div className="flex gap-2 pl-11">
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); handleAccept(n._id) }}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                      >
                        Accept
                      </button>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); handleReject(n._id) }}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-[#22272b] hover:bg-[#2c333a] text-[#b6c2cf] border border-white/[0.06] transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          {hasMore && !loading && (
            <div className="px-5 py-4">
              <button
                type="button"
                onClick={loadMoreNotifications}
                disabled={loadingMore}
                className={`w-full rounded-lg border border-white/[0.06] py-2 text-xs font-semibold ${dashboardPanelElevated} ${dashboardTextColor} hover:bg-[#22272b] disabled:opacity-60`}
              >
                {loadingMore
                  ? 'Loading older notifications…'
                  : remaining !== null && remaining > 0
                  ? `Load older — ${remaining} more`
                  : 'Load older'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Notifications
