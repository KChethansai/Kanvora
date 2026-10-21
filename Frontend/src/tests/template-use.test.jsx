// Tests for the real "use template" action: correct endpoint/body, navigation to
// the created board, and honest failure handling.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import axios from 'axios'
import toast from 'react-hot-toast'
import Templates from '../components/Templates'
import TemplateDetail from '../components/TemplateDetail'
import { API_BASE_URL } from '../config/api'

const router = vi.hoisted(() => ({ navigate: vi.fn() }))
const auth = vi.hoisted(() => ({
  currentUser: { _id: 'user-1', role: 'MEMBER' }
}))

vi.mock('axios', () => ({
  default: {
    defaults: {},
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => router.navigate,
  useLocation: () => ({ search: '' }),
  useParams: () => ({ id: 'tpl-1' })
}))
vi.mock('../store/authStore', () => ({ useAuth: () => auth }))
vi.mock('../store/projectStore', () => ({
  useProjectStore: () => ({ activeFilter: { search: '' } })
}))
vi.mock('../components/Navbar', () => ({ default: () => null }))

const template = {
  _id: 'tpl-1',
  title: 'Starter',
  description: 'A starter board',
  category: 'Business',
  creatorId: 'creator-1',
  creatorName: 'Ada',
  images: [],
  isPublished: true,
  isEditable: false,
  isViewOnly: true,
  allowPublicEdit: false,
  capabilities: { edit: true, delete: true },
  favourite: false,
  type: 'template'
}

const teamWorkspace = {
  _id: 'ws-1',
  name: 'Team',
  owner: { _id: 'user-1' },
  members: [],
  permissions: {}
}

const board = { _id: 'board-9', title: 'My sprint', workspace: 'ws-1' }

const serve = (
  templates = [template],
  workspaces = [teamWorkspace],
  detail = templates[0] || template
) => {
  axios.get.mockImplementation(async (url) => {
    if (url === `${API_BASE_URL}/api/templates`) {
      return { data: { payload: templates } }
    }
    if (url === `${API_BASE_URL}/api/workspaces`) {
      return { data: { payload: workspaces } }
    }
    if (url === `${API_BASE_URL}/api/templates/tpl-1`) {
      return { data: { payload: detail } }
    }
    throw new Error(`unexpected GET ${url}`)
  })
}

const openUseDialog = async () => {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Use template Starter' })
  )
  return screen.findByRole('dialog', {
    name: /create a board from starter/i
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.currentUser = { _id: 'user-1', role: 'MEMBER' }
  axios.post.mockResolvedValue({ data: { payload: board } })
  serve()
})
afterEach(cleanup)

describe('use template action', () => {
  it('posts only title and workspaceId, then navigates to the created board id', async () => {
    render(<Templates />)
    await openUseDialog()

    fireEvent.change(screen.getByLabelText('Board title'), {
      target: { value: 'My sprint' }
    })
    await screen.findByRole('option', { name: 'Team' })
    await waitFor(() =>
      expect(screen.getByLabelText('Destination')).not.toBeDisabled()
    )
    fireEvent.change(screen.getByLabelText('Destination'), {
      target: { value: 'ws-1' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create board' }))

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/templates/tpl-1/use`,
        { title: 'My sprint', workspaceId: 'ws-1' },
        { withCredentials: true }
      )
    )
    const body = axios.post.mock.calls[0][1]
    expect(Object.keys(body).sort()).toEqual(['title', 'workspaceId'])
    expect(body).not.toHaveProperty('isViewOnly')
    expect(body).not.toHaveProperty('allowPublicEdit')
    expect(router.navigate).toHaveBeenCalledWith('/projects/board-9')
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('not copied')
    )
  })

  it('creates a personal board with no workspaceId when no workspace is available', async () => {
    serve([template], [])
    render(<Templates />)
    await openUseDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Create board' }))

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/templates/tpl-1/use`,
        { title: 'Starter' },
        { withCredentials: true }
      )
    )
    expect(router.navigate).toHaveBeenCalledWith('/projects/board-9')
  })

  it('shows the backend error, keeps the dialog open and never navigates on failure', async () => {
    axios.post.mockRejectedValue({
      response: { data: { message: 'Workspace access denied' } }
    })
    render(<Templates />)
    await openUseDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Create board' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workspace access denied'
    )
    expect(toast.error).toHaveBeenCalledWith('Workspace access denied')
    expect(toast.success).not.toHaveBeenCalled()
    expect(router.navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('creates the board from the detail page and navigates to the board route', async () => {
    render(<TemplateDetail />)
    fireEvent.click(
      await screen.findByRole('button', { name: /use template/i })
    )
    await screen.findByRole('dialog', {
      name: /create a board from starter/i
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create board' }))

    await waitFor(() =>
      expect(router.navigate).toHaveBeenCalledWith('/projects/board-9')
    )
    expect(axios.post).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/templates/tpl-1/use`,
      { title: 'Starter' },
      { withCredentials: true }
    )
    expect(router.navigate.mock.calls).toEqual([['/projects/board-9']])
  })

  it('opens editing in place instead of navigating to an undeclared edit route', async () => {
    const owned = { ...template, creatorId: 'user-1' }
    serve([owned], [teamWorkspace], owned)
    render(<TemplateDetail />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(
      await screen.findByRole('dialog', { name: 'Edit template' })
    ).toBeTruthy()
    expect(router.navigate).not.toHaveBeenCalled()
  })

  it('exposes the detail panel as a labelled modal that closes with Escape', async () => {
    render(<Templates />)
    fireEvent.click(await screen.findByRole('button', { name: 'Starter' }))

    const panel = await screen.findByRole('dialog', { name: 'Starter' })
    expect(panel).toHaveAttribute('aria-modal', 'true')
    fireEvent.keyDown(panel, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.navigate).not.toHaveBeenCalled()
  })
})
