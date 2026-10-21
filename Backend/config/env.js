// env config: validates deployment-time backend configuration.
import { config } from 'dotenv'

import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// One loader, one location. Real process/deployment variables always win over
// Backend/.env (dotenv's default `override: false`), so a stale shell or a
// .env in the launch directory can never replace the configured secret.
config({ path: path.join(__dirname, '../.env'), override: false })

const requiredVars = ['DB_URL', 'SECRET_KEY', 'NODE_ENV']

const missingVars = requiredVars.filter((key) => !process.env[key])

if (missingVars.length > 0) {
  throw new Error(`Missing required env vars: ${missingVars.join(', ')}`)
}

const nodeEnv = process.env.NODE_ENV.trim().toLowerCase()
if (!['production', 'development', 'test'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be one of production, development, or test')
}

const parseBoolean = (value) =>
  typeof value === 'string' && /^(true|1|yes|y|ssl|tls)$/i.test(value.trim())

const sessionDays = Number(process.env.SESSION_TTL_DAYS || 7)
const safeSessionDays = Number.isFinite(sessionDays) ? Math.min(30, Math.max(1, sessionDays)) : 7
const configuredSameSite = (process.env.COOKIE_SAME_SITE || '').trim().toLowerCase()
const sameSite = ['lax', 'strict', 'none'].includes(configuredSameSite)
  ? configuredSameSite
  : 'lax'
const configuredTrustProxy = process.env.TRUST_PROXY
const trustProxy = configuredTrustProxy === undefined || configuredTrustProxy.trim() === ''
  ? 0
  : Number(configuredTrustProxy)
if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 10) {
  throw new Error('TRUST_PROXY must be an integer from 0 to 10')
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  dbUrl: process.env.DB_URL,
  secretKey: process.env.SECRET_KEY,
  clientUrls: (process.env.CLIENT_URL || (nodeEnv === 'production' ? '' : 'http://localhost:5173'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  cookieSameSite: sameSite,
  trustProxy,
  sessionTtlMs: safeSessionDays * 24 * 60 * 60 * 1000,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpSecure: parseBoolean(process.env.SMTP_SECURE),
  emailFrom:
    process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@kanvora.com'
}

export const isProduction = env.nodeEnv === 'production'

if (isProduction && env.secretKey.length < 32) {
  throw new Error('SECRET_KEY must be at least 32 characters in production')
}
if (isProduction && env.clientUrls.length === 0) {
  throw new Error('CLIENT_URL must be configured in production')
}
if (isProduction && (configuredTrustProxy === undefined || configuredTrustProxy.trim() === '')) {
  throw new Error('TRUST_PROXY must be explicitly configured in production')
}

export const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: env.cookieSameSite,
  secure: isProduction || env.cookieSameSite === 'none',
  path: '/',
  maxAge: env.sessionTtlMs
})

export const getClearCookieOptions = () => {
  const { maxAge, ...options } = getCookieOptions()
  return options
}
