// An invitation link must be accepted exactly once. A duplicate request
// fails with "not found" and used to show a false error after a successful
// acceptance.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import toast from 'react-hot-toast'
import Login from '../components/Login'

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  isAuthenticated: false,
  currentUser: null,
  setUser: vi.fn()
}))

// A distinct token per test: the component accepts a token only once per
// session, exactly like the server.
const router = vi.hoisted(() => ({ search: '' }))

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn() }
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('../store/authStore', () => ({ useAuth: () => auth }))
vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({ fetchWorkspaces: vi.fn() })
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/login', search: router.search, hash: '' })
}))

beforeEach(() => {
  vi.resetAllMocks()
  auth.login.mockResolvedValue(undefined)
  auth.isAuthenticated = false
  router.search = '?invite=' + 'a'.repeat(64)
  axios.post.mockResolvedValue({ data: { message: 'Invitation accepted' } })
})

afterEach(cleanup)

describe('invitation acceptance', () => {
  it('accepts the invitation once when the user signs in through the link', async () => {
    render(<Login />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invitee@example.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Acceptance!2026' } })
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => expect(auth.login).toHaveBeenCalled())
    await waitFor(() => {
      const accepts = axios.post.mock.calls.filter(([url]) => String(url).includes('/invitations/accept'))
      expect(accepts.length).toBe(1)
    })
    expect(toast.success).toHaveBeenCalledWith('Invitation accepted')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('accepts the invitation once for an already signed-in visitor', async () => {
    router.search = '?invite=' + 'b'.repeat(64)
    auth.isAuthenticated = true
    render(<Login />)

    await waitFor(() => {
      const accepts = axios.post.mock.calls.filter(([url]) => String(url).includes('/invitations/accept'))
      expect(accepts.length).toBe(1)
    })
    expect(toast.error).not.toHaveBeenCalled()
  })
})
