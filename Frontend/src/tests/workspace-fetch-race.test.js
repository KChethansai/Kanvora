import { beforeEach, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useWorkspaceStore } from '../store/workspaceStore'

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

const deferred = () => {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
  useWorkspaceStore.getState().resetWorkspaces()
})

it('does not restore a workspace deleted while its detail request is pending', async () => {
  const detail = deferred()
  axios.get.mockReturnValueOnce(detail.promise)
  axios.delete.mockResolvedValueOnce({ data: {} })
  useWorkspaceStore.setState({ workspaces: [{ _id: 'workspace-a' }], activeWorkspace: { _id: 'workspace-a' } })

  const pendingDetail = useWorkspaceStore.getState().fetchWorkspace('workspace-a')
  await useWorkspaceStore.getState().deleteWorkspace('workspace-a')
  detail.resolve({ data: { payload: { _id: 'workspace-a', name: 'Deleted' } } })
  await pendingDetail

  expect(useWorkspaceStore.getState().workspaces).toEqual([])
  expect(useWorkspaceStore.getState().activeWorkspace).toBeNull()
})

it('does not switch selection when a different workspace becomes active during detail fetch', async () => {
  const detail = deferred()
  axios.get.mockReturnValueOnce(detail.promise)
  useWorkspaceStore.setState({ workspaces: [{ _id: 'workspace-a' }, { _id: 'workspace-b' }], activeWorkspace: { _id: 'workspace-a' } })

  const pendingDetail = useWorkspaceStore.getState().fetchWorkspace('workspace-a')
  useWorkspaceStore.getState().setActiveWorkspace({ _id: 'workspace-b' })
  detail.resolve({ data: { payload: { _id: 'workspace-a', name: 'A' } } })
  await pendingDetail

  expect(useWorkspaceStore.getState().activeWorkspace).toEqual({ _id: 'workspace-b' })
})

it.each([null, 'workspace-b'])('selects the requested workspace when current selection is %s', async (activeId) => {
  axios.get.mockResolvedValueOnce({ data: { payload: { _id: 'workspace-a', name: 'A' } } })
  useWorkspaceStore.setState({
    workspaces: [{ _id: 'workspace-a' }, { _id: 'workspace-b' }],
    activeWorkspace: activeId ? { _id: activeId } : null
  })

  await useWorkspaceStore.getState().fetchWorkspace('workspace-a')

  expect(useWorkspaceStore.getState().activeWorkspace).toEqual({ _id: 'workspace-a', name: 'A' })
})

it('does not restore a deleted workspace from a pending workspace-list request', async () => {
  const listing = deferred()
  axios.get.mockReturnValueOnce(listing.promise)
  axios.delete.mockResolvedValueOnce({ data: {} })
  useWorkspaceStore.setState({ workspaces: [{ _id: 'workspace-a' }], activeWorkspace: { _id: 'workspace-a' } })

  const pendingList = useWorkspaceStore.getState().fetchWorkspaces()
  await useWorkspaceStore.getState().deleteWorkspace('workspace-a')
  listing.resolve({ data: { payload: [{ _id: 'workspace-a' }] } })
  await pendingList

  expect(useWorkspaceStore.getState().workspaces).toEqual([])
  expect(useWorkspaceStore.getState().activeWorkspace).toBeNull()
})
