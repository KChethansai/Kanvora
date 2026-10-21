import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import Navbar from '../components/Navbar'
import { API_BASE_URL } from '../config/api'

const state = vi.hoisted(() => ({ auth: {}, workspace: {}, project: {}, notifications: {} }))
vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn() } }))
vi.mock('../store/authStore', () => ({ useAuth: () => state.auth }))
vi.mock('../store/workspaceStore', () => ({ useWorkspaceStore: () => state.workspace }))
vi.mock('../store/projectStore', () => ({
  // The real store honours a selector; the double must as well, so a component
  // that subscribes to a single field reads that field.
  useProjectStore: (selector) => (selector ? selector(state.project) : state.project)
}))
vi.mock('../store/notificationStore', () => ({ useNotificationStore: () => state.notifications }))

const searchUrl = `${API_BASE_URL}/api/users/search-all`
const directoryCalls = () => axios.get.mock.calls.filter(([url]) => url === searchUrl)
const result = (name) => ({ data: { payload: [{ _id: name, name, email: `${name}@example.test` }] } })
const advanceSearch = () => act(async () => { await vi.advanceTimersByTimeAsync(250) })
const mount = () => {
  const view = render(<MemoryRouter><Navbar /></MemoryRouter>)
  fireEvent.focus(screen.getByPlaceholderText('Search...'))
  return () => view.rerender(<MemoryRouter><Navbar /></MemoryRouter>)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  state.auth = { currentUser: { _id: 'account-1', name: 'Account' } }
  state.workspace = { activeWorkspace: { _id: 'workspace-1' }, workspaces: [], setActiveWorkspace: vi.fn() }
  state.project = { activeFilter: { search: '  alice  ' }, setActiveFilter: vi.fn() }
  state.notifications = { unreadCount: 0, fetchNotifications: vi.fn(), bindUserRoom: vi.fn() }
  axios.get.mockResolvedValue({ data: { payload: [] } })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('workspace-scoped navbar directory search', () => {
  it('debounces and sends a trimmed query with the active workspace scope', async () => {
    mount()
    expect(directoryCalls()).toHaveLength(0)
    await advanceSearch()
    expect(axios.get).toHaveBeenCalledWith(searchUrl, expect.objectContaining({
      params: { q: 'alice', workspaceId: 'workspace-1' }, withCredentials: true
    }))
  })

  it.each(['no account', 'no workspace', 'empty query'])('does not search with %s', async (missing) => {
    if (missing === 'no account') state.auth.currentUser = null
    if (missing === 'no workspace') state.workspace.activeWorkspace = null
    if (missing === 'empty query') state.project.activeFilter.search = '   '
    mount()
    await advanceSearch()
    expect(directoryCalls()).toHaveLength(0)
  })

  it.each(['workspace', 'account', 'logout', 'query'])('aborts and ignores late responses after a %s change', async (scope) => {
    let resolveOld
    let resolveNew
    let requests = 0
    axios.get.mockImplementation((url) => {
      if (url !== searchUrl) return Promise.resolve({ data: { payload: [] } })
      requests += 1
      return new Promise((resolve) => {
        if (requests === 1) resolveOld = resolve
        else resolveNew = resolve
      })
    })
    const rerender = mount()
    await advanceSearch()
    const oldSignal = directoryCalls()[0][1].signal
    if (scope === 'workspace') state.workspace.activeWorkspace = { _id: 'workspace-2' }
    if (scope === 'account') state.auth.currentUser = { _id: 'account-2' }
    if (scope === 'logout') state.auth.currentUser = null
    if (scope === 'query') state.project.activeFilter = { search: 'bob' }
    rerender()
    expect(oldSignal?.aborted).toBe(true)
    await advanceSearch()
    await act(async () => { resolveOld(result('Old private result')) })
    expect(screen.queryByText('Old private result')).toBeNull()
    if (scope === 'logout') {
      expect(directoryCalls()).toHaveLength(1)
      expect(screen.queryByText('Searching users...')).toBeNull()
    } else {
      // An old finally handler must not clear the current request's loading state.
      expect(screen.queryByText('Searching users...')).not.toBeNull()
      await act(async () => { resolveNew(result('Current result')) })
      expect(screen.queryByText('Current result')).not.toBeNull()
      const expectedWorkspace = scope === 'workspace' ? 'workspace-2' : 'workspace-1'
      expect(directoryCalls()[1][1].params.workspaceId).toBe(expectedWorkspace)
    }
  })

  it('clears previous results and loading when workspace scope is removed', async () => {
    axios.get.mockImplementation((url) => Promise.resolve(url === searchUrl ? result('Private result') : { data: { payload: [] } }))
    const rerender = mount()
    await advanceSearch()
    expect(screen.queryByText('Private result')).not.toBeNull()
    state.workspace.activeWorkspace = null
    rerender()
    expect(screen.queryByText('Private result')).toBeNull()
    expect(screen.queryByText('Searching users...')).toBeNull()
    await advanceSearch()
    expect(directoryCalls()).toHaveLength(1)
  })

  it('clears old results when switching to another authorized workspace', async () => {
    axios.get.mockImplementation((url) => Promise.resolve(url === searchUrl ? result('Previous workspace user') : { data: { payload: [] } }))
    const rerender = mount()
    await advanceSearch()
    expect(screen.queryByText('Previous workspace user')).not.toBeNull()
    state.workspace.activeWorkspace = { _id: 'workspace-2' }
    rerender()
    expect(screen.queryByText('Previous workspace user')).toBeNull()
  })

  it('cancels the pending debounce when auth disappears before the request starts', async () => {
    const rerender = mount()
    state.auth.currentUser = null
    rerender()
    await advanceSearch()
    expect(directoryCalls()).toHaveLength(0)
    expect(screen.queryByText('Searching users...')).toBeNull()
  })

  it('handles failed searches without logging private Axios error configuration', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    axios.get.mockImplementation((url) => url === searchUrl
      ? Promise.reject({ config: { private: 'credentials' } })
      : Promise.resolve({ data: { payload: [] } }))
    mount()
    await advanceSearch()
    expect(screen.queryByText('Searching users...')).toBeNull()
    expect(screen.queryByText('No matching users')).not.toBeNull()
    expect(errorLog).not.toHaveBeenCalled()
  })
})
