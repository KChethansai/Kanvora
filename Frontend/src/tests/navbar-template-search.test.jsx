// Template search is a server query.
//
// Discovery is paged, so filtering one prefetched page silently hides every
// template that did not fit in it. The navbar must ask the server for matches
// instead of loading the catalogue and filtering locally.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import Navbar from '../components/Navbar'

const state = vi.hoisted(() => ({ auth: {}, workspace: {}, project: {}, notifications: {} }))
const navigate = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn() } }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() }, toast: vi.fn() }))
vi.mock('../store/authStore', () => ({ useAuth: () => state.auth }))
vi.mock('../store/workspaceStore', () => ({ useWorkspaceStore: () => state.workspace }))
vi.mock('../store/projectStore', () => ({
  useProjectStore: (selector) => (selector ? selector(state.project) : state.project)
}))
vi.mock('../store/notificationStore', () => ({ useNotificationStore: () => state.notifications }))

const templateCalls = () => axios.get.mock.calls.filter(([url]) => String(url).includes('/api/templates'))

beforeEach(() => {
  vi.resetAllMocks()
  state.auth = { currentUser: { _id: 'account-1', name: 'Account' }, logout: vi.fn(), signingOut: false, logoutError: null }
  state.workspace = { activeWorkspace: { _id: 'workspace-1' }, workspaces: [], setActiveWorkspace: vi.fn() }
  state.project = { activeFilter: { search: '' }, setActiveFilter: vi.fn() }
  state.notifications = { unreadCount: 0, fetchNotifications: vi.fn(), bindUserRoom: vi.fn() }
  axios.get.mockResolvedValue({ data: { payload: [] } })
})
afterEach(cleanup)

describe('navbar template search', () => {
  it('does not prefetch the template catalogue on mount', async () => {
    render(<MemoryRouter><Navbar /></MemoryRouter>)
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(templateCalls()).toHaveLength(0)
  })

  it('asks the server for the query instead of filtering a prefetched page', async () => {
    state.project = { activeFilter: { search: 'incident' }, setActiveFilter: vi.fn() }
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/templates')) {
        return Promise.resolve({
          data: {
            payload: [{ _id: 'old-row', title: 'Incident retro checklist', description: 'postmortem', isPublished: true, capabilities: { edit: false } }],
            page: { limit: 8, hasMore: false, nextCursor: null }
          }
        })
      }
      return Promise.resolve({ data: { payload: [] } })
    })

    render(<MemoryRouter><Navbar /></MemoryRouter>)

    await waitFor(() => {
      const call = templateCalls()[0]
      expect(call).toBeTruthy()
      expect(call[1].params).toEqual({ search: 'incident', limit: 8 })
    })
    // A match that was never on the first discovery page still appears in the
    // results once the search field has focus.
    fireEvent.focus(screen.getByLabelText('Search workspace'))
    expect(await screen.findByText('Incident retro checklist')).toBeInTheDocument()
  })
})
