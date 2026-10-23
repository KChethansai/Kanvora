// Assistant API routes: read-only product help and optional AI answers.
import express from 'express'
import rateLimit from 'express-rate-limit'
import { verifyRolesToken } from '../middlewares/verifyRolesToken.js'
import { createAssistantHandlers } from '../controllers/assistantController.js'

const auth = verifyRolesToken('MEMBER', 'ADMIN', 'MANAGER', 'VIEWER')

// Per-account budget: the limiter runs after auth, so the key is the session's
// user, not the connection's address.
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // `auth` runs first, so every limited request has a user key.
  keyGenerator: (req) => String(req.user.id),
  message: { message: 'Too many assistant requests, please wait a minute and try again' }
})

export const createAssistantApp = (provider) => {
  const assistantApp = express.Router()
  const { status, chat } = createAssistantHandlers(provider)

  assistantApp.get('/status', auth, status)
  assistantApp.post('/chat', auth, assistantLimiter, chat)

  return assistantApp
}
