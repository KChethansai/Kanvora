// A board the server refuses must not be rendered as an empty read-only
// board: the two states mean different things to the person looking at them.
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import Project from '../components/Project'

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/projects/p1' })
}))

vi.mock('../store/authStore', () => ({
  useAuth: () => ({ currentUser: { _id: 'u1', name: 'Viewer', email: 'v@example.test' } })
}))
vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({ activeWorkspace: null, fetchWorkspace: vi.fn() })
}))
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn()
  })
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))

beforeEach(() => {
  vi.resetAllMocks()
  axios.get.mockImplementation(async (url) => {
    if (url.includes('/projects/p1/lists')) return { data: { payload: [] } }
    // The board is not readable for this account.
    if (url.includes('/projects/p1')) {
      const error = new Error('not found')
      error.response = { status: 404, data: { message: 'Project not found' } }
      throw error
    }
    return { data: { payload: [] } }
  })
})

afterEach(cleanup)

describe('board access state', () => {
  it('states that the board is not available instead of showing an empty board', async () => {
    render(<Project />)

    await waitFor(() =>
      expect(screen.getByText(/this board is not available/i)).toBeInTheDocument()
    )
    expect(screen.queryByText(/no lists yet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to your workspace/i })).toBeInTheDocument()
  })
})
