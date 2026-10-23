// Notification panel: the page is not the account.
//
// The panel may show fewer rows than exist, and it must say so rather than
// presenting a number it cannot back with rows.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import Notifications from '../components/Notifications'

const router = vi.hoisted(() => ({ navigate: vi.fn() }))
const notificationState = vi.hoisted(() => ({
  state: {}
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => router.navigate,
  Link: ({ to, children, ...rest }) => createElement('a', { href: to, ...rest }, children)
}))
vi.mock('../store/notificationStore', () => ({
  useNotificationStore: () => notificationState.state
}))

const row = (id, extra = {}) => ({
  _id: id, message: `message ${id}`, read: true, type: 'card', createdAt: '2026-01-01T00:00:00.000Z', ...extra
})

const mount = (overrides = {}) => {
  notificationState.state = {
    notifications: [],
    unreadCount: 0,
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    fetchNotifications: vi.fn(),
    loadMoreNotifications: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    deleteNotif: vi.fn(),
    acceptInvite: vi.fn(),
    rejectInvite: vi.fn(),
    ...overrides
  }
  return render(<Notifications />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('notification panel pagination affordances', () => {
  it('offers the next page only when the server says more rows exist', () => {
    mount({ notifications: [row('a')], total: 60, hasMore: true })
    expect(screen.getByRole('button', { name: /Load older/i })).toBeInTheDocument()
  })

  it('hides the control when everything is loaded', () => {
    mount({ notifications: [row('a')], total: 1, hasMore: false })
    expect(screen.queryByRole('button', { name: /Load older/i })).not.toBeInTheDocument()
  })

  it('loads the next page when activated', () => {
    const loadMoreNotifications = vi.fn()
    mount({ notifications: [row('a')], total: 60, hasMore: true, loadMoreNotifications })

    fireEvent.click(screen.getByRole('button', { name: /Load older/i }))
    expect(loadMoreNotifications).toHaveBeenCalledTimes(1)
  })

  it('reports the remaining rows in the label', () => {
    mount({ notifications: [row('a'), row('b')], total: 60, hasMore: true })
    expect(screen.getByRole('button', { name: /58 more/i })).toBeInTheDocument()
  })

  it('is disabled while a page is already loading', () => {
    mount({ notifications: [row('a')], total: 60, hasMore: true, loadingMore: true })
    expect(screen.getByRole('button', { name: /Loading older notifications/i })).toBeDisabled()
  })

  it('reports the account totals rather than the loaded rows', () => {
    mount({ notifications: [row('a')], total: 60, unreadCount: 40, hasMore: true })
    // The badge next to "All" must be the account total, not the one loaded row.
    expect(screen.getByRole('button', { name: /^All/ })).toHaveTextContent('60')
    expect(screen.getByRole('button', { name: /^Unread/ })).toHaveTextContent('40')
  })

  it('says so when unread rows exist beyond the loaded page', () => {
    mount({ notifications: [row('a', { read: false })], total: 60, unreadCount: 40, hasMore: true })

    fireEvent.click(screen.getByRole('button', { name: /^Unread/ }))

    expect(screen.getByText(/Some older unread notifications are not loaded/i)).toBeInTheDocument()
  })

  it('keeps that note visible in the empty state as well', () => {
    mount({ notifications: [], total: 60, unreadCount: 40, hasMore: true })

    fireEvent.click(screen.getByRole('button', { name: /^Unread/ }))

    expect(screen.getByText(/No unread notifications/i)).toBeInTheDocument()
    expect(screen.getByText(/Some older unread notifications are not loaded/i)).toBeInTheDocument()
  })

  it('does not claim missing rows when the page covers them', () => {
    mount({ notifications: [row('a', { read: false })], total: 1, unreadCount: 1, hasMore: false })

    fireEvent.click(screen.getByRole('button', { name: /^Unread/ }))

    expect(screen.queryByText(/Some older unread notifications are not loaded/i)).not.toBeInTheDocument()
  })
})
