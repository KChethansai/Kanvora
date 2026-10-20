// security config: centralizes production-safe Express middleware.
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './env.js'

export const securityMiddleware = [
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Allow popups (Google sign-in uses postMessage between popup/iframe)
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
  }),
  compression(),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.nodeEnv === 'production' ? 300 : 10000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' }
  })
]

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
const originOf = (value) => {
  try { return new URL(value).origin } catch { return null }
}

export const csrfProtection = (allowedOrigins, { requireOrigin = env.nodeEnv === 'production' } = {}) => (req, res, next) => {
  if (safeMethods.has(req.method)) return next()
  const origin = req.get('origin')
  const referer = req.get('referer')
  const source = origin || referer
  if (!source) {
    // Non-browser clients may call public endpoints without a browser origin.
    // A request carrying an authenticated cookie must still come from a browser.
    return req.cookies?.token && requireOrigin
      ? res.status(403).json({ message: 'Request origin required' })
      : next()
  }
  const normalized = originOf(source)
  return normalized && allowedOrigins.includes(normalized)
    ? next()
    : res.status(403).json({ message: 'Request origin denied' })
}

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.nodeEnv === 'production' ? 15 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later' }
})

const hasUnsafeKey = (value) => {
  if (!value || typeof value !== 'object') return false
  return Object.keys(value).some((key) => {
    if (key.startsWith('$') || key.includes('.')) return true
    return hasUnsafeKey(value[key])
  })
}

export const rejectUnsafePayload = (req, res, next) => {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.params) || hasUnsafeKey(req.query)) {
    return res.status(400).json({ message: 'Invalid request payload' })
  }

  next()
}
