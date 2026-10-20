import 'dotenv/config'
import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { rejectUnsafePayload, securityMiddleware } from './config/security.js'
import { Userapp } from './APIs/UserAPI.js'
import { oauthApp } from './APIs/OAuthAPI.js'
import { projectsApp } from './APIs/ProjectsAPI.js'
import { workspaceApp } from './APIs/WorkspaceAPI.js'
import { commentApp } from './APIs/commentAPI.js'
import { templeteApp } from './APIs/templateAPI.js'
import { projectApp } from './APIs/ProjectManagerAPI.js'
import { commonTaskApp } from './APIs/CommonTasksAPI.js'
import { notificationApp } from './APIs/NotificationsAPI.js'
import { errorHandler } from './middlewares/errormiddleware.js'

const normalizeOrigin = (url) => url.replace(/\/+$/, '')

const allowedOrigins = [
  ...env.clientUrls,
  'https://kanvora-5d5t.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173'
].map(normalizeOrigin)

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

export const createApp = () => {
  const app = express()
  app.set('trust proxy', 1)
  app.options('*', cors(corsOptions))
  app.use(cors(corsOptions))
  app.use(securityMiddleware)
  app.use(cookieParser())
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
    const frontendUrl = env.clientUrls[0] || 'http://localhost:5173'
    const targetUrl = invite
      ? `${frontendUrl}/auth?invite=${invite}`
      : `${frontendUrl}/login`
    res.send(`
    <html>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1d2125; color: white; margin: 0;">
        <div style="text-align: center; max-width: 500px; padding: 20px;">
          <p style="margin-bottom: 20px; font-size: 1.1rem; opacity: 0.8;">You have been invited!</p>
          <a href="${targetUrl}" style="display: inline-block; padding: 12px 24px; color: white; background: #0052cc; border-radius: 5px; text-decoration: none; font-weight: 500; transition: background 0.2s;" onmouseover="this.style.background='#0040a3'" onmouseout="this.style.background='#0052cc'">Click here to join the Workspace</a>
        </div>
      </body>
    </html>
  `)
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
  mount('/api', projectApp, 'Backend/APIs/ProjectManagerAPI.js')
  mount('/api', commonTaskApp, 'Backend/APIs/CommonTasksAPI.js')
  mount('/notifications', notificationApp, 'Backend/APIs/NotificationsAPI.js')
  mount('/api/templates', templeteApp, 'Backend/APIs/templateAPI.js')

  app.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      time: new Date()
    })
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
