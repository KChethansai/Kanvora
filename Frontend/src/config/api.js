// api config: deployment-time frontend configuration values.
import axios from 'axios'

// Central API base URL used by all browser-side network clients.
// Set VITE_API_URL in production; the fallback keeps local development simple.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || ''

// A production build must talk to a real backend. Pointing at the local
// machine would look functional while every request fails, so the build is
// refused with an explicit message instead.
const pointsAtLocalhost = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i
  .test(configuredApiUrl)

const isProductionBuild = import.meta.env.PROD === true || import.meta.env.PROD === 'true'

export const productionConfigError = isProductionBuild && (!configuredApiUrl || pointsAtLocalhost)
  ? 'This Kanvora build has no backend configured. Set VITE_API_URL to the public API origin (for example https://api.kanvora.example) and rebuild.'
  : null

export const API_BASE_URL =
  configuredApiUrl.replace(/\/$/, '') || 'http://localhost:5000'

// OAuth configuration is colocated with API config because both are deploy-time env values.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

axios.defaults.timeout = 15000
axios.defaults.withCredentials = true


