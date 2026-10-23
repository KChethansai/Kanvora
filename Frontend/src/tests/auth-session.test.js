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

describe('logout is a confirmed server revocation', () => {
  it('clears local identity only after the server confirms revocation', async () => {
    axios.post.mockResolvedValue({ data: { message: 'Logout successful' } })
    const result = await useAuth.getState().logout()
    expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
    expect(axios.get).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
    expect(useAuth.getState()).toMatchObject({
      currentUser: null, isAuthenticated: false, authChecked: true, signingOut: false, logoutError: null
    })
  })

  it('keeps the signed-in state and reports an actionable error when the request fails', async () => {
    axios.post.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
    const result = await useAuth.getState().logout()
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unconfirmed')
    // A failed request must not look like a signed-out account: the HttpOnly
    // cookie is still valid, so the next refresh would restore the session.
    expect(useAuth.getState()).toMatchObject({
      currentUser: { _id: 'user-1' }, isAuthenticated: true, signingOut: false
    })
    expect(useAuth.getState().logoutError).toMatch(/could not confirm/i)
    expect(useAuth.getState().logoutError).not.toMatch(/logged out/i)
  })

  it('treats an already-expired session (401) as a confirmed sign-out', async () => {
    axios.post.mockRejectedValue({ response: { status: 401, data: { message: 'Please login' } } })
    const result = await useAuth.getState().logout()
    expect(result).toEqual({ ok: true })
    expect(useAuth.getState()).toMatchObject({ currentUser: null, isAuthenticated: false, logoutError: null })
  })

  it('does not treat an origin-guard rejection (403) as a confirmed sign-out', async () => {
    useAuth.getState().setUser({ _id: 'A', email: 'a@test.invalid' })
    axios.post.mockRejectedValue({ response: { status: 403, data: { message: 'Request origin denied' } } })
    const result = await useAuth.getState().logout()
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unconfirmed')
    // The revocation never ran, so the account must stay signed in and say so.
    expect(useAuth.getState().isAuthenticated).toBe(true)
    expect(useAuth.getState().currentUser._id).toBe('A')
    expect(useAuth.getState().logoutError).toMatch(/may still be active/i)
  })

  it('refuses to start two revocations at once', async () => {
    let release
    axios.post.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ data: {} }) }))
    const first = useAuth.getState().logout()
    const second = await useAuth.getState().logout()
    expect(second).toEqual({ ok: false, reason: 'in-flight' })
    expect(axios.post).toHaveBeenCalledTimes(1)
    release()
    await expect(first).resolves.toEqual({ ok: true })
  })

  it('a late session probe cannot restore identity after a confirmed logout', async () => {
    let releaseProbe
    axios.get.mockImplementation(() => new Promise((resolve) => {
      releaseProbe = () => resolve({ data: { payload: { _id: 'user-1', name: 'Late' } } })
    }))
    axios.post.mockResolvedValue({ data: { message: 'Logout successful' } })

    const probe = useAuth.getState().checkAuth()
    await Promise.resolve()
    await useAuth.getState().logout()
    releaseProbe()
    await probe

    expect(useAuth.getState()).toMatchObject({ currentUser: null, isAuthenticated: false })
  })

  it('leaves the session restorable after a failed logout', async () => {
    axios.post.mockRejectedValue(Object.assign(new Error('offline'), { code: 'ERR_NETWORK' }))
    await useAuth.getState().logout()
    axios.get.mockResolvedValue({ data: { payload: { _id: 'user-1', name: 'Owner' } } })
    await useAuth.getState().checkAuth()
    expect(useAuth.getState()).toMatchObject({ currentUser: { _id: 'user-1' }, isAuthenticated: true })
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
