import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../config/api'
import { useWorkspaceStore } from '../store/workspaceStore'
import WorkSpaces from '../components/WorkSpaces'

vi.mock('axios', () => ({ default: { defaults: {}, patch: vi.fn(), put: vi.fn() } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => null }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../store/authStore', () => ({ useAuth: () => ({ currentUser: { _id: 'owner' } }) }))
vi.mock('../store/projectStore', () => {
  const state = { projects: [], fetchProjects: vi.fn() }
  return { useProjectStore: () => state }
})

const initialState = useWorkspaceStore.getState()
const workspace = {
  _id: 'workspace-1', owner: 'owner', name: 'Team',
  members: [
    { user: { _id: 'owner', name: 'Owner' }, role: 'ADMIN' },
    { user: { _id: 'member', name: 'Member' }, role: 'MEMBER' }
  ]
}
const otherWorkspace = { _id: 'workspace-2', members: [] }
const updated = {
  ...workspace,
  members: [workspace.members[0], { ...workspace.members[1], role: 'MANAGER' }]
}
const cache = { workspaces: { data: [workspace], timestamp: Date.now() }, unrelated: 'keep' }

beforeEach(() => {
  vi.resetAllMocks()
  useWorkspaceStore.setState({
    ...initialState,
    workspaces: [workspace, otherWorkspace], activeWorkspace: workspace,
    members: workspace.members, cache, fetchWorkspaces: vi.fn()
  }, true)
})
afterEach(cleanup)

describe('targeted workspace member roles', () => {
  it('PATCHes only the target role and synchronizes confirmed workspace state', async () => {
    axios.patch.mockResolvedValue({ data: { payload: updated } })
    const result = await useWorkspaceStore.getState().updateMemberRole('workspace-1', 'member', 'MANAGER')
    expect(axios.patch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/workspaces/workspace-1/members/member`,
      { role: 'MANAGER' }, { withCredentials: true }
    )
    expect(axios.put).not.toHaveBeenCalled()
    expect(result).toEqual(updated)
    expect(useWorkspaceStore.getState()).toMatchObject({
      workspaces: [updated, otherWorkspace], activeWorkspace: updated,
      members: updated.members, error: null, cache: { unrelated: 'keep' }
    })
    expect(useWorkspaceStore.getState().cache.workspaces).toBeUndefined()
    expect(useWorkspaceStore.getState().members[0]).toEqual(workspace.members[0])
  })

  it('does not optimistically update or invalidate data while the request is pending', async () => {
    let resolve
    axios.patch.mockImplementation(() => new Promise((done) => { resolve = done }))
    const pending = useWorkspaceStore.getState().updateMemberRole('workspace-1', 'member', 'MANAGER')
    expect(useWorkspaceStore.getState()).toMatchObject({ activeWorkspace: workspace, members: workspace.members, cache })
    resolve({ data: { payload: updated } })
    await pending
  })

  it('preserves selection and displayed members if selection changes before confirmation', async () => {
    let resolve
    axios.patch.mockImplementation(() => new Promise((done) => { resolve = done }))
    const pending = useWorkspaceStore.getState().updateMemberRole('workspace-1', 'member', 'MANAGER')
    useWorkspaceStore.setState({ activeWorkspace: otherWorkspace, members: otherWorkspace.members })
    resolve({ data: { payload: updated } })
    await pending
    expect(useWorkspaceStore.getState()).toMatchObject({
      workspaces: [updated, otherWorkspace], activeWorkspace: otherWorkspace, members: []
    })
  })

  it('rejects server errors without changing members, selection, workspace list or cache', async () => {
    const error = { response: { data: { message: 'Only admins can change roles' } } }
    axios.patch.mockRejectedValue(error)
    await expect(useWorkspaceStore.getState().updateMemberRole('workspace-1', 'member', 'MANAGER')).rejects.toBe(error)
    expect(useWorkspaceStore.getState()).toMatchObject({
      workspaces: [workspace, otherWorkspace], activeWorkspace: workspace,
      members: workspace.members, cache, error: 'Only admins can change roles'
    })
  })

  it('clears stale errors after success and provides a fallback on network failure', async () => {
    axios.patch.mockRejectedValueOnce(new Error('Network unavailable'))
    await expect(useWorkspaceStore.getState().updateMemberRole('workspace-1', 'member', 'MANAGER')).rejects.toThrow()
    expect(useWorkspaceStore.getState().error).toBe('Could not update role')
    axios.patch.mockResolvedValue({ data: { payload: updated } })
    await useWorkspaceStore.getState().updateMemberRole('workspace-1', 'member', 'MANAGER')
    expect(useWorkspaceStore.getState().error).toBeNull()
  })

  it.each([true, false])('the role selector uses the targeted operation (success=%s)', async (success) => {
    if (success) axios.patch.mockResolvedValue({ data: { payload: updated } })
    else axios.patch.mockRejectedValue({ response: { data: { message: 'Role change forbidden' } } })
    // The retired whole-members PUT would succeed, exposing an incorrect success toast.
    axios.put.mockResolvedValue({ data: { payload: updated } })
    render(createElement(MemoryRouter, { initialEntries: ['/workspaces/members'] }, createElement(WorkSpaces)))
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'MANAGER' } })
    await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/workspaces/workspace-1/members/member`,
      { role: 'MANAGER' }, { withCredentials: true }
    ))
    expect(axios.put).not.toHaveBeenCalled()
    if (success) {
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Role updated'))
      expect(useWorkspaceStore.getState().activeWorkspace).toEqual(updated)
    } else {
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Role change forbidden'))
      expect(toast.success).not.toHaveBeenCalled()
      expect(useWorkspaceStore.getState().activeWorkspace).toEqual(workspace)
      expect(useWorkspaceStore.getState().members).toEqual(workspace.members)
    }
  })
})
