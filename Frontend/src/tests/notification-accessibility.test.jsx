// Notification rows are readable content, not an interactive block.
//
// The row used to be a clickable div, so a keyboard user could not mark it read
// at all. Each action is now its own native button with an accessible name,
// while the pointer-friendly row click stays as a convenience.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import Notifications from '../components/Notifications'

const router = vi.hoisted(() => ({ navigate: vi.fn() }))
const store = vi.hoisted(() => ({ state: {} }))

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => router.navigate,
  Link: ({ to, children, ...rest }) => createElement('a', { href: to, ...rest }, children)
}))
vi.mock('../store/notificationStore', () => ({ useNotificationStore: () => store.state }))

const row = (id, extra = {}) => ({
  _id: id, message: `message ${id}`, read: false, type: 'card',
  createdAt: '2026-01-01T00:00:00.000Z', ...extra
})

const mount = (overrides = {}) => {
  store.state = {
    notifications: [row('n1')],
    unreadCount: 1,
    total: 1,
    hasMore: false,
    paginationApproximate: false,
    loading: false,
    loadingMore: false,
    writeError: null,
    fetchNotifications: vi.fn(),
    loadMoreNotifications: vi.fn(),
    markRead: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn(),
    deleteNotif: vi.fn().mockResolvedValue(undefined),
    acceptInvite: vi.fn(),
    rejectInvite: vi.fn(),
    ...overrides
  }
  return render(<Notifications />)
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)

describe('notification row semantics', () => {
  it('renders each row as a non-interactive article with a real mark-read button', () => {
    const { container } = mount()
    const article = container.querySelector('[data-notification-id="n1"]')
    expect(article.tagName).toBe('ARTICLE')
    expect(article).not.toHaveAttribute('role')
    expect(article).not.toHaveAttribute('tabindex')

    const control = within(article).getByRole('button', { name: 'Mark as read' })
    expect(control.tagName).toBe('BUTTON')
    fireEvent.click(control)
    expect(store.state.markRead).toHaveBeenCalledWith('n1')
  })

  it('keeps delete, accept and decline as separate controls', () => {
    mount({
      notifications: [
        row('n1'),
        row('invite-1', { type: 'invite', status: 'pending', message: 'Join the team' })
      ],
      unreadCount: 2,
      total: 2
    })
    fireEvent.click(screen.getByRole('button', { name: 'Delete notification' }))
    expect(store.state.deleteNotif).toHaveBeenCalledWith('n1')
    expect(store.state.markRead).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0])
    expect(store.state.acceptInvite).toHaveBeenCalledWith('invite-1')
    fireEvent.click(screen.getAllByRole('button', { name: 'Decline' })[0])
    expect(store.state.rejectInvite).toHaveBeenCalledWith('invite-1')
  })

  it('never nests an interactive control inside another one', () => {
    const { container } = mount({
      notifications: [row('n1'), row('invite-1', { type: 'invite', status: 'pending' })],
      unreadCount: 2,
      total: 2
    })
    expect(container.querySelectorAll('button button')).toHaveLength(0)
    expect(container.querySelectorAll('a button, button a')).toHaveLength(0)
    expect(container.querySelectorAll('article[role="button"]')).toHaveLength(0)
  })

  it('gives every button an accessible name', () => {
    mount({
      notifications: [row('n1'), row('invite-1', { type: 'invite', status: 'pending' })],
      unreadCount: 2,
      total: 2
    })
    for (const button of screen.getAllByRole('button')) {
      const name = button.getAttribute('aria-label') || button.textContent?.trim()
      expect(name).toBeTruthy()
    }
  })

  it('moves focus to the list when the focused row is deleted', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Delete notification' }))
    await vi.waitFor(() => expect(screen.getByTestId('notification-list')).toHaveFocus())
    expect(screen.getByTestId('notification-list')).toHaveAttribute('tabindex', '-1')
  })

  it('announces a failed write instead of showing a silent local state', () => {
    mount({ writeError: 'We could not mark that notification as read.' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/could not mark/i)
  })
})
