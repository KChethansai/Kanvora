// A6 — store-subscription render guards.
//
// The board measurement showed that a socket event costs one React commit in
// the board tree. The application shell is different: Navbar and Sidebar used
// to subscribe to the WHOLE project store, so every board event re-rendered
// them even when the data they display had not changed.
//
// These tests guard the measured improvement:
//   - changing the project LIST must not re-render the Navbar;
//   - changing the view mode must not re-render the Sidebar;
//   - a component MUST still re-render when the data it shows changes.
//
// Run: cd Frontend && npx vitest run src/tests/store-subscription-renders.test.jsx
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Profiler } from 'react'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { useProjectStore as board } from '../store/projectStore'
import { useWorkspaceStore as workspaceStore } from '../store/workspaceStore'

const socket = vi.hoisted(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() }))
vi.mock('@dnd-kit/core', () => ({
  DndContext: (props) => props.children,
  DragOverlay: () => null,
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(),
  closestCorners: vi.fn()
}))
vi.mock('socket.io-client', () => ({ io: () => socket }))
vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

const owner = { _id: 'u1', name: 'Ada Lovelace', email: 'ada@kanvora.test', role: 'MEMBER' }
const workspace = {
  _id: 'w1',
  name: 'Calm Workbench Team',
  owner: owner._id,
  members: [{ user: owner, role: 'ADMIN' }],
  capabilities: { read: true, edit: true, manage: true, manageBoards: true, manageMembers: true }
}
const project = { _id: 'p1', title: 'Release planning', workspace: 'w1', updatedAt: '2026-10-18T00:00:00.000Z' }

beforeEach(() => {
  vi.clearAllMocks()
  board.getState().resetProjects()
  board.getState().resetBoard()
  workspaceStore.getState().resetWorkspaces()
  axios.get.mockImplementation(async (url) => {
    if (url.includes('/api/workspaces/')) return { data: { payload: workspace } }
    if (url.includes('/api/workspaces')) return { data: { payload: [workspace] } }
    if (url.includes('/api/templates')) return { data: { payload: [] } }
    if (url.includes('/api/users/search')) return { data: { payload: [] } }
    if (url.includes('/notifications')) return { data: { payload: [] } }
    if (url.endsWith('/projects')) return { data: { payload: [project] } }
    return { data: { payload: [] } }
  })
})
afterEach(cleanup)

const renderShell = () => {
  const counts = { navbar: 0, sidebar: 0 }
  const onRender = (id) => { counts[id] = (counts[id] || 0) + 1 }
  render(
    <MemoryRouter>
      <Profiler id="navbar" onRender={onRender}>
        <Navbar />
      </Profiler>
      <Profiler id="sidebar" onRender={onRender}>
        <Sidebar />
      </Profiler>
    </MemoryRouter>
  )
  return { counts, onRender }
}

const commitsDuring = async (counts, action) => {
  const before = { ...counts }
  await act(async () => { action() })
  return {
    navbar: counts.navbar - before.navbar,
    sidebar: counts.sidebar - before.sidebar
  }
}

it('does not re-render the shell for data it does not display', async () => {
  const { counts } = renderShell()
  await waitFor(() => {
    expect(board.getState().projects.length).toBeGreaterThanOrEqual(0)
  })
  await act(async () => { await Promise.resolve() })

  // The project list changes; the Navbar does not display it.
  const onProjects = await commitsDuring(counts, () => {
    board.setState({ projects: [{ ...project, title: 'Renamed board' }] })
  })
  expect(onProjects.navbar).toBe(0)
  expect(onProjects.sidebar).toBeGreaterThanOrEqual(0)

  // The view mode changes; the Sidebar does not display it.
  const onViewMode = await commitsDuring(counts, () => {
    board.setState({ viewMode: 'table' })
  })
  expect(onViewMode.sidebar).toBe(0)
  expect(onViewMode.navbar).toBeGreaterThanOrEqual(0)
})

it('still re-renders a component when the data it displays changes', async () => {
  const { counts } = renderShell()
  await waitFor(() => {
    expect(board.getState().projects.length).toBeGreaterThanOrEqual(0)
  })
  await act(async () => { await Promise.resolve() })

  const onProjects = await commitsDuring(counts, () => {
    board.setState({ projects: [{ ...project, title: 'Renamed board' }] })
  })
  // The Sidebar lists the projects, so it must re-render.
  expect(onProjects.sidebar).toBeGreaterThanOrEqual(1)
})
