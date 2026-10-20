// authStore store: centralizes client state and API calls for this domain.
import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useNotificationStore } from './notificationStore'
import { useProjectStore } from './projectStore'
import { useWorkspaceStore } from './workspaceStore'

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
    set({
      currentUser: user,
      isAuthenticated: true,
      authChecked: true,
      error: null
    })
  },

  //email + password login
  login: async (data) => {
    set({ loading: true, error: null })
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, data, {
        withCredentials: true
      })
      const user = res.data.payload
      set({
        currentUser: user,
        isAuthenticated: true,
        authChecked: true,
        loading: false
      })
    } catch (err) {
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
    if (get().loading) return
    if (get().authChecked && Date.now() - get().lastCheckedAt < 30 * 1000)
      return
    set({ loading: true })
    try {
      const res = await axios.get(`${API_BASE_URL}/auth/check-auth`, {
        withCredentials: true
      })
      set({
        currentUser: res.data.payload,
        isAuthenticated: !!res.data.payload,
        authChecked: true,
        lastCheckedAt: Date.now(),
        loading: false
      })
    } catch {
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
    try {
      const res = await axios.put(`${API_BASE_URL}/auth/profile`, data, {
        withCredentials: true
      })
      set({ currentUser: res.data.payload })
      return res.data.payload
    } catch (err) {
      throw err
    }
  },

  //change password
  changePassword: async (data) => {
    const res = await axios.put(`${API_BASE_URL}/auth/change-password`, data, {
      withCredentials: true
    })
    return res.data
  },

  forgotPassword: async ({ email }) => {
    const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email }, { withCredentials: true })
    return res.data
  },

  resetPassword: async (token, { password }) => {
    const res = await axios.post(`${API_BASE_URL}/auth/reset-password`, { token, password }, { withCredentials: true })
    return res.data
  },

  verifyEmail: async (token, { password }) => {
    const res = await axios.post(`${API_BASE_URL}/auth/verify-email`, { token, password }, { withCredentials: true })
    return res.data
  },

  resendVerification: async (email) => {
    const res = await axios.post(`${API_BASE_URL}/auth/resend-verification`, { email }, { withCredentials: true })
    return res.data
  },

  //logout
  logout: async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
    } catch {
      //silent
    }
    useNotificationStore.getState().reset()
    useProjectStore.getState().resetProjects()
    useProjectStore.getState().resetBoard()
    useWorkspaceStore.getState().resetWorkspaces()
    set({
      currentUser: null,
      isAuthenticated: false,
      authChecked: true,
      error: null
    })
  }
}))
