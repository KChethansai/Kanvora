// OAuthAPI routes: verified Google identity exchange with explicit account linking.
import express from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { UserModel } from '../models/usermodel.js'
import { env, getCookieOptions } from '../config/env.js'
import { signSession } from '../config/session.js'
import { authLimiter } from '../config/security.js'
import { revokeUserAccess } from '../socket.js'

export const oauthApp = express.Router()

const googleClient = new OAuth2Client(env.googleClientId)
const fail = (status, message) => Object.assign(new Error(message), { status })

export async function resolveGoogleUser(payload) {
  const email = typeof payload?.email === 'string' ? payload.email.toLowerCase().trim() : ''
  if (!email || payload.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub) {
    throw fail(401, 'A verified Google email is required')
  }

  let user = await UserModel.findOne({ email }).select('+googleSub')
  if (user) {
    if (user.googleSub && user.googleSub !== payload.sub) {
      throw fail(409, 'This email is linked to a different Google account')
    }
    if (!user.googleSub) {
      throw fail(409, 'An account with this email already exists; please sign in with your password')
    }
    return { user, created: false }
  }

  try {
    user = await UserModel.create({
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 50) : email.split('@')[0],
      email,
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 11),
      profilePic: typeof payload.picture === 'string' ? payload.picture : '',
      role: 'VIEWER',
      emailVerified: true,
      googleSub: payload.sub
    })
    return { user, created: true }
  } catch (error) {
    if (error.code === 11000) throw fail(409, 'Account already exists; sign in and retry Google linking')
    throw error
  }
}

oauthApp.post('/google', authLimiter, async (req, res) => {
  try {
    if (!env.googleClientId) return res.status(503).json({ message: 'Google OAuth is not configured' })
    const credential = req.body?.credential
    if (typeof credential !== 'string' || !credential || credential.length > 4096) {
      return res.status(400).json({ message: 'Valid credential is required' })
    }
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.googleClientId })
    const { user } = await resolveGoogleUser(ticket.getPayload())
    res.cookie('token', signSession(user), getCookieOptions())
    const safeUser = user.toObject()
    delete safeUser.password
    delete safeUser.googleSub
    return res.status(200).json({ message: 'Google login success', payload: safeUser })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message })
    return res.status(401).json({ message: 'Google authentication failed' })
  }
})

// Apple OAuth placeholder - must remain disabled until a verified provider is implemented.
oauthApp.post('/apple', async (_req, res) => {
  res.status(501).json({ message: 'Apple OAuth not configured' })
})
