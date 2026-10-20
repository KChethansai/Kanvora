import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../store/authStore'

vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn() } }))

const initial = useAuth.getState()

beforeEach(() => {
  vi.resetAllMocks()
  useAuth.setState({ ...initial, currentUser: { _id: 'user-1' }, isAuthenticated: true }, true)
})

describe('account recovery and session transport', () => {
  it('logs out with a state-changing POST and clears local identity even on failure', async () => {
    axios.post.mockRejectedValue(new Error('offline'))
    await useAuth.getState().logout()
    expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
    expect(axios.get).not.toHaveBeenCalled()
    expect(useAuth.getState()).toMatchObject({ currentUser: null, isAuthenticated: false, authChecked: true })
  })

  it('does not mark a failed credential exchange as authenticated', async () => {
    useAuth.setState({ currentUser: null, isAuthenticated: false })
    axios.post.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } })
    await expect(useAuth.getState().login({ email: 'user@example.test', password: 'wrong' })).rejects.toBeTruthy()
    expect(useAuth.getState()).toMatchObject({
      currentUser: null, isAuthenticated: false, loading: false, error: 'Invalid email or password'
    })
  })

  it('sends recovery and verification tokens in request bodies', async () => {
    axios.post.mockResolvedValue({ data: { message: 'ok' } })
    await useAuth.getState().forgotPassword({ email: 'user@example.test' })
    await useAuth.getState().resetPassword('a'.repeat(64), { password: 'New password 123!' })
    await useAuth.getState().verifyEmail('b'.repeat(64), { password: 'Verified password 123!' })
    await useAuth.getState().resendVerification('user@example.test')
    expect(axios.post.mock.calls).toEqual([
      [`${API_BASE_URL}/auth/forgot-password`, { email: 'user@example.test' }, { withCredentials: true }],
      [`${API_BASE_URL}/auth/reset-password`, { token: 'a'.repeat(64), password: 'New password 123!' }, { withCredentials: true }],
      [`${API_BASE_URL}/auth/verify-email`, { token: 'b'.repeat(64), password: 'Verified password 123!' }, { withCredentials: true }],
      [`${API_BASE_URL}/auth/resend-verification`, { email: 'user@example.test' }, { withCredentials: true }]
    ])
  })
})
