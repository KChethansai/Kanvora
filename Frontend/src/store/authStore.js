// authStore store: centralizes client state and API calls for this domain.
import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useNotificationStore } from './notificationStore'
import { useProjectStore } from './projectStore'
import { useWorkspaceStore } from './workspaceStore'
import { getAccountEpoch, invalidateAccountEpoch, isAccountEpochCurrent } from '../utils/accountEpoch'

const resetAccountData = () => {
  invalidateAccountEpoch()
  useNotificationStore.getState().reset()
  useProjectStore.getState().resetProjects()
  useProjectStore.getState().resetBoard()
  useWorkspaceStore.getState().resetWorkspaces()
}

// Auth store owns session state and keeps credential endpoint calls in one place.
export const useAuth = create((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  authChecked: false,
  loading: false,
  error: null,
  lastCheckedAt: 0,
  // True while a server revocation is in flight. The UI disables the action so
  // two rapid clicks cannot send two revocations.
  signingOut: false,
  // Set only when a revocation could not be confirmed. The account stays signed
  // in, so this is the retry message, not a success message.
  logoutError: null,

  //manually set user (used by OAuth flows)
  setUser: (user) => {
    if (get().currentUser?._id !== user?._id) resetAccountData()
    set({
      currentUser: user,
      isAuthenticated: !!user,
      loading: false,
      lastCheckedAt: 0,
      authChecked: true,
      error: null,
      // A new identity is never blocked by an attempt that belonged to the old
      // one.
      signingOut: false,
      logoutError: null
    })
  },

  //email + password login
  login: async (data) => {
    resetAccountData()
    const epoch = getAccountEpoch()
    set({ currentUser: null, isAuthenticated: false, lastCheckedAt: 0, signingOut: false })
    set({ loading: true, error: null })
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, data, {
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch)) return
      const user = res.data.payload
      set({
        currentUser: user,
        isAuthenticated: true,
        authChecked: true,
        loading: false,
        logoutError: null
      })
    } catch (err) {
      if (!isAccountEpochCurrent(epoch)) return
      set({
        error: err.response?.data?.message || 'Login failed',
        authChecked: true,
        loading: false
      })
      throw err
    }
  },

  //check auth status on app mount and route change
  checkAuth: async () => {
    const epoch = getAccountEpoch()
    if (get().loading) return
    if (get().authChecked && Date.now() - get().lastCheckedAt < 30 * 1000)
      return
    set({ loading: true })
    try {
      const res = await axios.get(`${API_BASE_URL}/auth/check-auth`, {
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch)) return
      if (get().currentUser?._id !== res.data.payload?._id) resetAccountData()
      set({
        currentUser: res.data.payload,
        isAuthenticated: !!res.data.payload,
        authChecked: true,
        lastCheckedAt: Date.now(),
        loading: false
      })
    } catch {
      if (!isAccountEpochCurrent(epoch)) return
      if (get().currentUser) resetAccountData()
      set({
        currentUser: null,
        isAuthenticated: false,
        authChecked: true,
        lastCheckedAt: Date.now(),
        loading: false
      })
    }
  },

  //update profile
  updateProfile: async (data) => {
    const epoch = getAccountEpoch()
    try {
      const res = await axios.put(`${API_BASE_URL}/auth/profile`, data, {
        withCredentials: true
      })
      if (!isAccountEpochCurrent(epoch)) return
      set({ currentUser: res.data.payload })
      return res.data.payload
    } catch (err) {
      if (!isAccountEpochCurrent(epoch)) return
      throw err
    }
  },

  //change password
  changePassword: async (data) => {
    const epoch = getAccountEpoch()
    const res = await axios.put(`${API_BASE_URL}/auth/change-password`, data, {
      withCredentials: true
    })
    if (!isAccountEpochCurrent(epoch)) return
    return res.data
  },

  forgotPassword: async ({ email }) => {
    const epoch = getAccountEpoch()
    const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email }, { withCredentials: true })
    if (!isAccountEpochCurrent(epoch)) return
    return res.data
  },

  resetPassword: async (token, { password }) => {
    const epoch = getAccountEpoch()
    const res = await axios.post(`${API_BASE_URL}/auth/reset-password`, { token, password }, { withCredentials: true })
    if (!isAccountEpochCurrent(epoch)) return
    return res.data
  },

  verifyEmail: async (token, { password }) => {
    const epoch = getAccountEpoch()
    const res = await axios.post(`${API_BASE_URL}/auth/verify-email`, { token, password }, { withCredentials: true })
    if (!isAccountEpochCurrent(epoch)) return
    return res.data
  },

  resendVerification: async (email) => {
    const epoch = getAccountEpoch()
    const res = await axios.post(`${API_BASE_URL}/auth/resend-verification`, { email }, { withCredentials: true })
    if (!isAccountEpochCurrent(epoch)) return
    return res.data
  },

  //logout
  logout: async () => {
    // A second click must not send a second revocation while the first is
    // still in flight: the server bumps the session version on each call and
    // the two responses can race the local state.
    if (get().signingOut) return { ok: false, reason: 'in-flight' }
    set({ signingOut: true, logoutError: null })
    const epoch = getAccountEpoch()

    let failure = null
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
    } catch (err) {
      const status = err?.response?.status
      // 401 means the server already considers this session gone (expired,
      // revoked, or signed out in another tab), so there is nothing left to
      // revoke. A 403 is NOT the same signal: the origin guard answers 403
      // before the route runs, so the session may be completely intact and
      // claiming a sign-out would be a lie.
      if (status !== 401) failure = err
    }

    if (failure) {
      // The HttpOnly cookie may still be valid, so identity is kept and the
      // action stays retryable. Never claim a sign-out that did not happen.
      if (!isAccountEpochCurrent(epoch)) {
        // A newer identity owns the store now; this attempt must not leave the
        // signing-out lock set for it.
        set({ signingOut: false })
        return { ok: false, reason: 'superseded' }
      }
      const error = 'We could not confirm the sign-out with the server. Your session may still be active. Check your connection and try again.'
      set({ signingOut: false, logoutError: error })
      return { ok: false, reason: 'unconfirmed', error }
    }

    // A newer identity took over while the revocation was in flight. Its state
    // is newer than this response, so the old sign-out must not clear it.
    if (!isAccountEpochCurrent(epoch)) {
      set({ signingOut: false })
      return { ok: true }
    }

    // Clearing is synchronous and invalidates the account epoch first, so any
    // read still in flight for this identity is discarded when it lands.
    resetAccountData()
    set({
      currentUser: null,
      isAuthenticated: false,
      authChecked: true,
      loading: false,
      lastCheckedAt: 0,
      error: null,
      signingOut: false,
      logoutError: null
    })
    return { ok: true }
  }
}))
