import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { allowedClientOrigins, normalizeOrigin } from './config/origins.js'
import { csrfProtection, rejectUnsafePayload, securityMiddleware } from './config/security.js'
import { Userapp } from './APIs/UserAPI.js'
import { oauthApp } from './APIs/OAuthAPI.js'
import { projectsApp } from './APIs/ProjectsAPI.js'
import { workspaceApp } from './APIs/WorkspaceAPI.js'
import { commentApp } from './APIs/commentAPI.js'
import { templeteApp } from './APIs/templateAPI.js'
import { createAssistantApp } from './APIs/assistantAPI.js'
import { createGeminiProvider, isProvider } from './services/geminiProvider.js'
import { notificationApp } from './APIs/NotificationsAPI.js'
import { errorHandler } from './middlewares/errormiddleware.js'

const allowedOrigins = allowedClientOrigins(env).map(normalizeOrigin)

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}

export const createApp = ({ sendEmail, assistantProvider } = {}) => {
  if (sendEmail !== undefined && typeof sendEmail !== 'function') throw new TypeError('sendEmail must be a function')
  if (assistantProvider !== undefined && assistantProvider !== null && !isProvider(assistantProvider)) {
    throw new TypeError('assistantProvider must implement reply() and expose a model name')
  }
  // Without GEMINI_API_KEY this is null, so the assistant serves deterministic
  // help and cannot reach the provider.
  const provider = assistantProvider === undefined ? createGeminiProvider() : assistantProvider
  const app = express()
  app.locals.sendEmail = sendEmail
  app.set('trust proxy', env.trustProxy)
  app.options('*', cors(corsOptions))
  app.use(cors(corsOptions))
  app.use(securityMiddleware)
  app.use(cookieParser())
  app.use(csrfProtection(allowedOrigins))
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    res.vary('Cookie')
    next()
  })
  app.use(express.json({ limit: '1mb' }))
  app.use((req, res, next) => {
    req.requestId =
      req.headers['x-request-id'] ||
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`
    res.setHeader('X-Request-Id', req.requestId)
    next()
  })
  app.use(rejectUnsafePayload)

  app.get('/auth', (req, res) => {
    const invite = req.query.invite
    if (invite !== undefined && (typeof invite !== 'string' || !/^(?:[a-f0-9]{48}|[a-f0-9]{64})$/i.test(invite))) {
      return res.status(400).json({ message: 'Invalid invitation' })
    }
    const targetUrl = new URL('/login', env.clientUrls[0])
    if (invite) targetUrl.hash = `invite=${invite}`
    return res.redirect(302, targetUrl.toString())
  })

  app.locals.routeMounts = new Map()
  const mount = (path, router, source) => {
    app.use(path, router)
    app.locals.routeMounts.set(app._router.stack.at(-1), { path, source })
  }
  mount('/auth', Userapp, 'Backend/APIs/UserAPI.js')
  mount('/oauth', oauthApp, 'Backend/APIs/OAuthAPI.js')
  mount('/projects-api', projectsApp, 'Backend/APIs/ProjectsAPI.js')
  mount('/api', workspaceApp, 'Backend/APIs/WorkspaceAPI.js')
  mount('/api', commentApp, 'Backend/APIs/commentAPI.js')
  // Legacy /api/project and /api/task routers are intentionally not mounted.
  // Active application consumers use the authorized /projects-api resources.
  mount('/notifications', notificationApp, 'Backend/APIs/NotificationsAPI.js')
  mount('/api/templates', templeteApp, 'Backend/APIs/templateAPI.js')
  mount('/api/assistant', createAssistantApp(provider), 'Backend/APIs/assistantAPI.js')

  app.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      time: new Date()
    })
  })

  // Readiness is separate from liveness: the process can be up while the
  // database is unreachable, and a deployment probe should be able to tell
  // the difference.
  app.get('/health/ready', async (_req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      const { default: mongoose } = await import('mongoose')
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ status: 'not-ready', database: 'disconnected', time: new Date() })
      }
      await mongoose.connection.db.admin().command({ ping: 1 })
      return res.status(200).json({ status: 'ready', database: 'connected', time: new Date() })
    } catch {
      return res.status(503).json({ status: 'not-ready', database: 'unreachable', time: new Date() })
    }
  })

  app.use((req, res) => {
    res.status(404).json({
      message: `Route ${req.method} ${req.url} not found`,
      requestId: req.requestId
    })
  })
  app.use(errorHandler)
  return app
}
