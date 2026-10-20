import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { env } from './env.js'
import { UserModel } from '../models/usermodel.js'

export const SESSION_ISSUER = 'kanvora'
export const SESSION_AUDIENCE = 'kanvora-web'
export const SESSION_TTL_SECONDS = Math.floor(env.sessionTtlMs / 1000)

export const signSession = (user) => jwt.sign({
  email: user.email,
  id: String(user._id),
  role: user.role,
  ver: user.sessionVersion ?? 0
}, env.secretKey, {
  algorithm: 'HS256',
  audience: SESSION_AUDIENCE,
  expiresIn: SESSION_TTL_SECONDS,
  issuer: SESSION_ISSUER
})

export const verifySession = (token) => {
  if (typeof token !== 'string' || !token || token.length > 8192) throw new Error('Invalid session')
  const claims = jwt.verify(token, env.secretKey, {
    algorithms: ['HS256'], audience: SESSION_AUDIENCE, issuer: SESSION_ISSUER
  })
  if (!Number.isInteger(claims.ver) || !Number.isInteger(claims.exp) ||
    !mongoose.isObjectIdOrHexString(claims.id)) throw new Error('Invalid session')
  return claims
}

export async function currentUserFromToken(token) {
  const claims = verifySession(token)
  const user = await UserModel.findById(claims.id).select('_id name email username bio profilePic role sessionVersion emailVerified createdAt updatedAt')
  if (!user || (user.sessionVersion ?? 0) !== claims.ver) throw new Error('Invalid session')
  return user
}
