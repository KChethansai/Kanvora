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

  //manually set user (used by OAuth flows)
  setUser: (user) => {
    if (get().currentUser?._id !== user?._id) resetAccountData()
    set({
      currentUser: user,
      isAuthenticated: !!user,
      loading: false,
      lastCheckedAt: 0,
      authChecked: true,
      error: null
    })
  },

  //email + password login
  login: async (data) => {
    resetAccountData()
    const epoch = getAccountEpoch()
    set({ currentUser: null, isAuthenticated: false, lastCheckedAt: 0 })
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
        loading: false
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
    // Clear identity and invalidate requests synchronously, not after the network.
    resetAccountData()
    set({ currentUser: null, isAuthenticated: false, authChecked: true, loading: false, lastCheckedAt: 0, error: null })
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
    } catch {
      //silent
    }
  }
}))
