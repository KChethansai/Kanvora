import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import Navbar from '../components/Navbar'

const state = vi.hoisted(() => ({ auth: {}, workspace: {}, project: {}, notifications: {} }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const navigate = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn() } }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})
vi.mock('react-hot-toast', () => ({ default: toast, toast }))
vi.mock('../store/authStore', () => ({ useAuth: () => state.auth }))
vi.mock('../store/workspaceStore', () => ({ useWorkspaceStore: () => state.workspace }))
vi.mock('../store/projectStore', () => ({
  useProjectStore: (selector) => (selector ? selector(state.project) : state.project)
}))
vi.mock('../store/notificationStore', () => ({ useNotificationStore: () => state.notifications }))

const mount = () => render(<MemoryRouter><Navbar /></MemoryRouter>)
const openMenuAndLogout = () => {
  fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
  fireEvent.click(screen.getByRole('button', { name: /log out|signing out/i }))
}

beforeEach(() => {
  vi.resetAllMocks()
  state.auth = {
    currentUser: { _id: 'account-1', name: 'Account' },
    logout: vi.fn(),
    signingOut: false,
    logoutError: null
  }
  state.workspace = { activeWorkspace: { _id: 'workspace-1' }, workspaces: [], setActiveWorkspace: vi.fn() }
  state.project = { activeFilter: { search: '' }, setActiveFilter: vi.fn() }
  state.notifications = { unreadCount: 0, fetchNotifications: vi.fn(), bindUserRoom: vi.fn() }
  axios.get.mockResolvedValue({ data: { payload: [] } })
})
afterEach(cleanup)

describe('navbar sign-out feedback', () => {
  it('never reports a successful sign-out when the server revocation is unconfirmed', async () => {
    state.auth.logout = vi.fn().mockResolvedValue({ ok: false, reason: 'unconfirmed', error: 'Could not confirm the sign-out.' })
    mount()
    openMenuAndLogout()
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(toast.error.mock.calls[0][0]).toMatch(/could not confirm/i)
  })

  it('reports success and leaves the shell only after confirmation', async () => {
    state.auth.logout = vi.fn().mockResolvedValue({ ok: true })
    mount()
    openMenuAndLogout()
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('Logged out'))
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('ignores a second click while a revocation is in flight', async () => {
    const pending = vi.fn().mockResolvedValue({ ok: false, reason: 'in-flight' })
    state.auth.logout = pending
    mount()
    openMenuAndLogout()
    await vi.waitFor(() => expect(pending).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('does not report success or navigate when logout belongs to an older identity', async () => {
    state.auth.logout = vi.fn().mockResolvedValue({ ok: false, reason: 'superseded' })
    mount()
    openMenuAndLogout()
    await vi.waitFor(() => expect(state.auth.logout).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
