import dns from 'dns'
import mongoose from 'mongoose'
import { createServer } from 'http'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { createApp } from './app.js'
import { init as initSocket } from './socket.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

export { createApp }

const start = async () => {
  dns.setDefaultResultOrder('ipv4first')
  const httpServer = createServer(createApp())
  initSocket(httpServer)

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server')
    httpServer.close(() => mongoose.connection.close(false))
  })

  try {
    await mongoose.connect(env.dbUrl, { family: 4 })
    logger.info('MongoDB connected')
    httpServer.listen(env.port, () => {
      logger.info(`Server listening on port ${env.port}`)
      logStartupSummary()
    })
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(
          `Port ${env.port} is in use. Is another instance already running?`
        )
        process.exit(1)
      } else {
        throw err
      }
    })
  } catch (err) {
    logger.error('MongoDB connection failed:', err.message)
    process.exit(1)
  }
}

// A non-secret summary of the effective configuration. It names what is
// configured, never a value that could be a credential.
const logStartupSummary = () => {
  logger.info('Configuration:', JSON.stringify({
    nodeEnv: env.nodeEnv,
    port: env.port,
    clientOrigins: env.clientUrls.length,
    trustProxy: env.trustProxy,
    cookieSameSite: env.cookieSameSite,
    secureCookies: env.nodeEnv === 'production' || env.cookieSameSite === 'none',
    smtpConfigured: Boolean(env.smtpHost && env.smtpUser && env.smtpPass),
    cloudinaryConfigured: Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret),
    googleOAuthConfigured: Boolean(env.googleClientId)
  }))
  if (env.nodeEnv !== 'production') {
    logger.warn(
      'NODE_ENV is not "production": rate limits, origin checks, secure cookies and error redaction are relaxed.'
    )
  }
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    logger.warn('SMTP is not configured: verification, password reset and invitation email cannot be delivered.')
  }
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    logger.warn('Cloudinary is not configured: card and avatar image uploads will be rejected.')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start()
}
