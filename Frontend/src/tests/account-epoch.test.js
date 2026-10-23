import { beforeEach, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useAuth } from '../store/authStore'
import { useProjectStore as board } from '../store/projectStore'
import { useWorkspaceStore as workspace } from '../store/workspaceStore'
import { useNotificationStore as notifications } from '../store/notificationStore'

const socket = vi.hoisted(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() }))
vi.mock('socket.io-client', () => ({ io: () => socket }))
vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const seedB = () => {
  useAuth.getState().setUser({ _id: 'B' })
  board.setState({ cards: { shared: [{ _id: 'b-card', order: 0 }] }, lists: [{ _id: 'b-list' }], projects: [{ _id: 'b-project' }], recentProjects: [], cache: {}, analyticsByProject: {}, cardSavingIds: {} })
  workspace.setState({ workspaces: [{ _id: 'b-workspace' }], activeWorkspace: { _id: 'b-workspace' }, members: [], cache: {}, analytics: null, permissions: null })
  notifications.setState({ notifications: [], unreadCount: 0 })
}
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.getState().setUser({ _id: 'A' })
  board.getState().resetProjects()
  board.getState().resetBoard()
  workspace.getState().resetWorkspaces()
  notifications.getState().reset()
})

it.each([
  ['workspaces', workspace, 'fetchWorkspaces', []],
  ['workspace', workspace, 'fetchWorkspace', ['shared']],
  ['members', workspace, 'fetchMembers', ['shared']],
  ['analytics', workspace, 'fetchWorkspaceAnalytics', ['shared']],
  ['permissions', workspace, 'fetchPermissions', ['shared']],
  ['recent projects', board, 'fetchRecentProjects', []],
  ['project analytics', board, 'fetchProjectAnalytics', ['shared']],
  ['active project', board, 'fetchProject', ['shared']],
  ['cards', board, 'fetchCards', ['shared']],
  ['lists', board, 'fetchLists', ['shared']],
  ['notifications', notifications, 'fetchNotifications', []]
])('ignores account A delayed %s response after logout/login B', async (_, store, method, args) => {
  const old = deferred()
  axios.get.mockReturnValueOnce(old.promise)
  const pending = store.getState()[method](...args)
  axios.post.mockResolvedValue({ data: {} })
  await useAuth.getState().logout()
  seedB()
  const snapshot = store.getState()
  old.resolve({ data: { payload: [{ _id: 'a-private' }] } })
  await pending
  expect(store.getState()).toEqual(snapshot)
})

it.each(['fetchCards', 'fetchLists'])('does not recycle %s generations on board reset', async (method) => {
  const old = deferred(), fresh = deferred()
  axios.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
  const a = board.getState()[method]('shared')
  board.getState().resetBoard()
  const b = board.getState()[method]('shared')
  old.resolve({ data: { payload: [{ _id: 'a-private' }] } })
  await a
  expect(method === 'fetchCards' ? board.getState().cards.shared : board.getState().lists).toEqual(method === 'fetchCards' ? undefined : [])
  fresh.resolve({ data: { payload: [{ _id: 'b-public' }] } })
  await b
})

it('discards an in-flight read once the revocation is confirmed', async () => {
  const old = deferred(), logout = deferred()
  axios.get.mockReturnValueOnce(old.promise)
  const request = workspace.getState().fetchWorkspaces()
  axios.post.mockReturnValueOnce(logout.promise)
  const pendingLogout = useAuth.getState().logout()
  logout.resolve({ data: {} })
  await pendingLogout
  // The account is gone, so the read that started before it cannot repopulate
  // the store afterwards.
  old.resolve({ data: { payload: [{ _id: 'a-private' }] } })
  await request
  expect(workspace.getState().workspaces).toEqual([])
})

it('a completed revocation cannot clear a newer identity', async () => {
  const logout = deferred()
  axios.post.mockReturnValueOnce(logout.promise)
  const pendingLogout = useAuth.getState().logout()
  seedB()
  logout.resolve({ data: {} })
  await pendingLogout
  expect(useAuth.getState().currentUser._id).toBe('B')
  expect(workspace.getState().workspaces).toEqual([{ _id: 'b-workspace' }])
  // The attempt that belonged to A must not lock B out of signing out.
  expect(useAuth.getState().signingOut).toBe(false)
})

it('an unconfirmed revocation keeps the account and its data', async () => {
  workspace.setState({ workspaces: [{ _id: 'a-workspace' }], activeWorkspace: { _id: 'a-workspace' } })
  const logout = deferred()
  axios.post.mockReturnValueOnce(logout.promise)
  const pendingLogout = useAuth.getState().logout()
  logout.reject(Object.assign(new Error('offline'), { code: 'ERR_NETWORK' }))
  const result = await pendingLogout
  expect(result.ok).toBe(false)
  // Nothing was revoked, so nothing is cleared.
  expect(useAuth.getState().currentUser._id).toBe('A')
  expect(workspace.getState().workspaces).toEqual([{ _id: 'a-workspace' }])
  expect(useAuth.getState().signingOut).toBe(false)
})

it.each(['resolve', 'reject'])('ignores A mutation %s including rollback and chained persistence', async (completion) => {
  board.setState({ cards: { shared: [{ _id: 'a-card', order: 0 }] } })
  const old = deferred()
  axios.put.mockReturnValueOnce(old.promise)
  const pending = board.getState().updateCard('a-card', { title: 'A' })
  seedB()
  const snapshot = board.getState()
  old[completion](completion === 'resolve' ? { data: { payload: { _id: 'a-card', listId: 'shared' } } } : new Error('old failure'))
  await pending
  expect(board.getState()).toEqual(snapshot)
  expect(axios.put).toHaveBeenCalledTimes(1)
})

it('ignores already queued socket callbacks from account A', () => {
  board.getState().joinProject('shared')
  notifications.getState().bindUserRoom('A')
  const handlers = socket.on.mock.calls.map(([event, callback]) => [event, callback])
  seedB()
  const snapshot = board.getState()
  handlers.find(([event]) => event === 'card-created')[1]({ _id: 'a-card', listId: 'shared' })
  handlers.find(([event]) => event === 'new-notification')[1]({ _id: 'a-notification' })
  expect(board.getState()).toEqual(snapshot)
  expect(notifications.getState().notifications).toEqual([])
})

it('ignores delayed checkAuth and profile completions after account switch', async () => {
  const check = deferred(), profile = deferred()
  useAuth.setState({ loading: false, authChecked: false })
  axios.get.mockReturnValueOnce(check.promise)
  axios.put.mockReturnValueOnce(profile.promise)
  const checking = useAuth.getState().checkAuth()
  const updating = useAuth.getState().updateProfile({ name: 'A' })
  seedB()
  check.resolve({ data: { payload: { _id: 'A' } } })
  profile.resolve({ data: { payload: { _id: 'A' } } })
  await Promise.all([checking, updating])
  expect(useAuth.getState().currentUser._id).toBe('B')
})

it.each([
  [workspace, 'createWorkspace', [{ name: 'A' }], 'post'],
  [workspace, 'updateWorkspace', ['shared', { name: 'A' }], 'put'],
  [workspace, 'deleteWorkspace', ['shared'], 'delete'],
  [workspace, 'updateMemberRole', ['shared', 'A', 'ADMIN'], 'patch'],
  [workspace, 'removeMember', ['shared', 'A'], 'delete'],
  [workspace, 'updatePermissions', ['shared', {}], 'put'],
  [board, 'createProject', [{ title: 'A' }], 'post'],
  [board, 'updateProject', ['shared', { title: 'A' }], 'put'],
  [board, 'deleteProject', ['shared'], 'delete'],
  [board, 'archiveProject', ['shared'], 'put'],
  [board, 'createList', ['shared', 'A'], 'post'],
  [board, 'updateList', ['shared', { title: 'A' }], 'put'],
  [board, 'deleteList', ['shared'], 'delete'],
  [board, 'createCard', ['shared', { title: 'A' }], 'post'],
  [board, 'deleteCard', ['a-card', 'shared'], 'delete'],
  [board, 'moveCard', ['a-card', 'shared'], 'put'],
  [board, 'uploadCardAttachment', ['a-card', new Blob(['a'])], 'post'],
  [notifications, 'acceptInvite', ['shared'], 'post'],
  [notifications, 'rejectInvite', ['shared'], 'post']
])('isolates delayed mutation %s.%s and never sends its follow-up as B', async (store, method, args, verb) => {
  board.setState({ cards: { shared: [{ _id: 'a-card', order: 0 }] } })
  const old = deferred()
  axios[verb].mockReturnValueOnce(old.promise)
  const pending = store.getState()[method](...args)
  seedB()
  const snapshot = store.getState()
  old.resolve({ data: { payload: { _id: 'a-private', listId: 'shared', members: [] } } })
  await pending
  expect(store.getState()).toEqual(snapshot)
  expect(axios.get).not.toHaveBeenCalled()
  expect(axios.put).toHaveBeenCalledTimes(verb === 'put' ? 1 : 0)
})

it('stops paginated requests and cache writes at the account boundary', async () => {
  const old = deferred()
  axios.get.mockReturnValueOnce(old.promise)
  const pending = board.getState().fetchProjects()
  seedB()
  const snapshot = board.getState()
  old.resolve({ data: { payload: [{ _id: 'a-private' }], hasMore: true, nextCursor: 'next' } })
  await pending
  expect(board.getState()).toEqual(snapshot)
  expect(axios.get).toHaveBeenCalledTimes(1)
})

it.each(['resolve', 'reject'])('ignores A login %s after B OAuth identity is established', async (completion) => {
  const old = deferred()
  axios.post.mockReturnValueOnce(old.promise)
  const pending = useAuth.getState().login({ email: 'a@example.test', password: 'test' })
  seedB()
  old[completion](completion === 'resolve' ? { data: { payload: { _id: 'A' } } } : new Error('old login failed'))
  await pending
  expect(useAuth.getState()).toMatchObject({ currentUser: { _id: 'B' }, isAuthenticated: true, loading: false, error: null })
})

it('keeps fresh B results when A finishes after real logout/login and a shared-key refetch', async () => {
  const old = deferred()
  axios.get.mockReturnValueOnce(old.promise)
  const pending = board.getState().fetchCards('shared')
  axios.post.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: { payload: { _id: 'B' } } })
  await useAuth.getState().logout()
  await useAuth.getState().login({ email: 'b@example.test', password: 'test' })
  axios.get.mockResolvedValueOnce({ data: { payload: [{ _id: 'b-card' }] } })
  await board.getState().fetchCards('shared')
  old.resolve({ data: { payload: [{ _id: 'a-private' }] } })
  await pending
  expect(board.getState().cards.shared).toEqual([{ _id: 'b-card' }])
  expect(useAuth.getState().currentUser._id).toBe('B')
})
