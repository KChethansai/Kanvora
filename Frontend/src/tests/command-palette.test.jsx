// The command palette: one focus owner, permission-aware commands, an empty
// state, and a live region that announces the result count.
//
// The palette overlay is owned by useDialogFocus (focus trap, Escape, focus
// restoration). cmdk provides the listbox semantics, the arrow-key navigation
// and the empty state. There is deliberately no second Escape listener and no
// second focus trap.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import RootLayout from '../components/RootLayout'

const state = {
  auth: { currentUser: null, isAuthenticated: false, authChecked: true, loading: false, checkAuth: vi.fn() },
  workspace: { workspaces: [], activeWorkspace: null, setActiveWorkspace: vi.fn() },
  project: { viewMode: 'kanban', setViewMode: vi.fn(), activeFilter: { search: '' }, setActiveFilter: vi.fn() },
  notifications: { unreadCount: 0, fetchNotifications: vi.fn(), bindUserRoom: vi.fn() }
}

vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn().mockResolvedValue({ data: { payload: [] } }) } }))
vi.mock('../store/authStore', () => ({ useAuth: () => state.auth }))
vi.mock('../store/workspaceStore', () => ({ useWorkspaceStore: () => state.workspace }))
vi.mock('../store/projectStore', () => ({
  useProjectStore: (selector) => (selector ? selector(state.project) : state.project)
}))
vi.mock('../store/notificationStore', () => ({ useNotificationStore: () => state.notifications }))
vi.mock('../components/Header', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))

const openPalette = () => {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
}

const mount = (path = '/main-page') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RootLayout />
    </MemoryRouter>
  )

beforeEach(() => {
  state.auth = { currentUser: null, isAuthenticated: false, authChecked: true, loading: false, checkAuth: vi.fn() }
  state.workspace = { workspaces: [], activeWorkspace: null, setActiveWorkspace: vi.fn() }
  state.project = { viewMode: 'kanban', setViewMode: vi.fn(), activeFilter: { search: '' }, setActiveFilter: vi.fn() }
  state.notifications = { unreadCount: 0, fetchNotifications: vi.fn(), bindUserRoom: vi.fn() }
})

describe('command palette', () => {
  it('opens with Ctrl+K and closes again with the same shortcut', () => {
    mount()
    openPalette()
    expect(screen.getByRole('dialog', { name: 'Command menu' })).toBeInTheDocument()
    openPalette()
    expect(screen.queryByRole('dialog', { name: 'Command menu' })).not.toBeInTheDocument()
  })

  it('offers only public destinations to an anonymous visitor', () => {
    mount('/features')
    openPalette()
    expect(screen.getByRole('option', { name: /Features/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Notifications/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Settings/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Open dashboard/ })).not.toBeInTheDocument()
  })

  it('does not leak a protected command while the session is still being checked', () => {
    state.auth = { currentUser: null, isAuthenticated: false, authChecked: false, loading: true, checkAuth: vi.fn() }
    mount()
    openPalette()
    expect(screen.queryByRole('option', { name: /Notifications/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Open dashboard/ })).not.toBeInTheDocument()
  })

  it('offers the application destinations to a signed-in visitor', () => {
    state.auth = {
      currentUser: { _id: 'u1', name: 'Ada Lovelace' },
      isAuthenticated: true,
      authChecked: true,
      loading: false,
      checkAuth: vi.fn()
    }
    state.workspace = { workspaces: [{ _id: 'w1', name: 'Calm Workbench Team' }], activeWorkspace: null, setActiveWorkspace: vi.fn() }
    mount()
    openPalette()
    expect(screen.getByRole('option', { name: /Open dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Notifications/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Templates marketplace/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /^Projects/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /^Settings/ })).toBeInTheDocument()
  })

  it('does not offer a workspace destination to a member of no workspace', () => {
    state.auth = {
      currentUser: { _id: 'u1', name: 'Ada Lovelace' },
      isAuthenticated: true,
      authChecked: true,
      loading: false,
      checkAuth: vi.fn()
    }
    state.workspace = { workspaces: [], activeWorkspace: null, setActiveWorkspace: vi.fn() }
    mount()
    openPalette()
    expect(screen.getByRole('option', { name: /Open dashboard/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /^Projects/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /^Settings/ })).not.toBeInTheDocument()
  })

  it('shows an empty state and announces that nothing matches', async () => {
    mount('/features')
    openPalette()
    fireEvent.change(screen.getByLabelText('Search commands'), { target: { value: 'zzzzz' } })
    await waitFor(() => {
      expect(screen.getByText('No matching command.')).toBeInTheDocument()
    })
    const status = screen.getByRole('status')
    expect(status.textContent).toMatch(/no commands match/i)
  })

  it('announces the number of matching commands', async () => {
    mount('/features')
    openPalette()
    fireEvent.change(screen.getByLabelText('Search commands'), { target: { value: 'help' } })
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/1 command available/i)
    })
  })

  it('closes on Escape', () => {
    mount()
    openPalette()
    expect(screen.getByRole('dialog', { name: 'Command menu' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Command menu' })).not.toBeInTheDocument()
  })

  it('does not offer the theme switcher on the public shell', () => {
    mount('/features')
    openPalette()
    expect(screen.queryByRole('button', { name: 'Dark' })).not.toBeInTheDocument()
  })

  it('offers the theme switcher on an application route', () => {
    mount('/main-page')
    openPalette()
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
  })
})
