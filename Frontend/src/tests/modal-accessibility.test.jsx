import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Projects from '../components/Projects'
import CardDetailModal from '../components/CardDetailModal'
import Sidebar from '../components/Sidebar'

const state = vi.hoisted(() => ({ project: {}, workspace: {} }))

vi.mock('../store/projectStore', () => ({ useProjectStore: () => state.project }))
vi.mock('../store/workspaceStore', () => ({ useWorkspaceStore: () => state.workspace }))
vi.mock('axios', () => ({
  default: {
    defaults: {},
    // CardDetailModal loads comments on mount; resolve so the effect settles
    // inside act() instead of warning after the test ends.
    get: vi.fn(() => Promise.resolve({ data: { payload: [] } }))
  }
}))
vi.mock('../components/CardLabels', () => ({ CardLabelsInput: () => null, CardLabelsList: () => null }))
vi.mock('../components/CardAttachments', () => ({ default: () => null }))
vi.mock('../components/CardSubtasks', () => ({ default: () => null }))
vi.mock('../components/CardChecklists', () => ({ default: () => null }))
vi.mock('../components/CardComments', () => ({ default: () => null }))
vi.mock('../components/CardActions', () => ({ default: () => null }))

const projectStore = () => ({
  projects: [],
  recentProjects: [],
  loading: false,
  fetchProjects: vi.fn(),
  fetchRecentProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  activeFilter: { search: '' }
})

beforeEach(() => {
  state.project = projectStore()
  state.workspace = {
    workspaces: [{ _id: 'w1', name: 'Team' }],
    activeWorkspace: { _id: 'w1', name: 'Team' },
    loading: false,
    fetchWorkspaces: vi.fn(),
    createWorkspace: vi.fn(),
    setActiveWorkspace: vi.fn()
  }
})

afterEach(cleanup)

describe('Project dialogs', () => {
  it('exposes a named dialog, labelled fields, and a named close control', () => {
    render(<MemoryRouter><Projects /></MemoryRouter>)
    const opener = screen.getByRole('button', { name: 'Create new project' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Create project' })
    expect(within(dialog).getByRole('button', { name: 'Close create project dialog' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Project title/)).toHaveAttribute('id', 'create-project-title')
    expect(within(dialog).getByLabelText(/Workspace/)).toHaveValue('w1')

    const swatch = within(dialog).getByRole('button', { name: 'Background Ocean' })
    expect(swatch).toHaveAttribute('aria-pressed', 'true')

    const upload = within(dialog).getByLabelText(/Upload JPG\/PNG background/)
    expect(upload).not.toHaveAttribute('hidden')
    expect(upload.className).toContain('sr-only')
  })

  it('closes on Escape and restores focus to the trigger', () => {
    render(<MemoryRouter><Projects /></MemoryRouter>)
    const opener = screen.getByRole('button', { name: 'Create new project' })
    opener.focus()
    fireEvent.click(opener)

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Create project' }), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('gives the create-workspace dialog the same semantics', () => {
    state.workspace = { ...state.workspace, workspaces: [], activeWorkspace: null }
    render(<MemoryRouter><Projects /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))

    const dialog = screen.getByRole('dialog', { name: 'Create workspace' })
    expect(within(dialog).getByRole('button', { name: 'Close create workspace dialog' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Workspace name')).toHaveAttribute('id', 'create-workspace-name')
  })
})

describe('CardDetailModal', () => {
  it('is a labelled modal dialog with named controls and initial focus', async () => {
    const onClose = vi.fn()
    await act(async () => {
      render(
        <CardDetailModal
          card={{ _id: 'c1', title: 'Ship audit', labels: [] }}
          listTitle="Todo"
          onClose={onClose}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onStatusChange={vi.fn()}
          onAttach={vi.fn()}
          currentUser={{ _id: 'u1', name: 'Ada' }}
        />
      )
    })

    expect(screen.getByRole('dialog', { name: 'Card details: Ship audit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close card details' })).toBeInTheDocument()
    expect(screen.getByLabelText('Card title')).toHaveFocus()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Rich description')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Sidebar drawer', () => {
  const sidebarStores = () => {
    state.project = { projects: [] }
    state.workspace = {
      workspaces: [],
      activeWorkspace: { _id: 'w1', name: 'Team' },
      fetchWorkspaces: vi.fn(),
      createWorkspace: vi.fn(),
      setActiveWorkspace: vi.fn()
    }
  }

  it('removes the off-canvas drawer from the tab order while closed', () => {
    sidebarStores()
    const { container, rerender } = render(
      <MemoryRouter><Sidebar open={false} onClose={vi.fn()} /></MemoryRouter>
    )
    const drawer = container.querySelector('#workspace-sidebar')
    expect(drawer).toHaveAttribute('inert')
    expect(drawer).toHaveAttribute('aria-hidden', 'true')

    rerender(<MemoryRouter><Sidebar open onClose={vi.fn()} /></MemoryRouter>)
    const openDrawer = screen.getByRole('complementary', { name: 'Workspace navigation' })
    expect(openDrawer).not.toHaveAttribute('inert')
    expect(openDrawer).not.toHaveAttribute('aria-hidden')
  })
})
