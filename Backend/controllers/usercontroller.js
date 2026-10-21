// usercontroller controller: authentication, sessions and account recovery.
import crypto from 'node:crypto'
import { UserModel } from '../models/usermodel.js'
import bcrypt from 'bcryptjs'
import { env, getClearCookieOptions, getCookieOptions } from '../config/env.js'
import { currentUserFromToken, signSession } from '../config/session.js'
import { revokeUserAccess } from '../socket.js'
import { isEmailTransportConfigured, sendEmail } from '../utils/email.js'
import { logger } from '../utils/logger.js'

const { hash, compare } = bcrypt
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const tokenPattern = /^[a-f0-9]{64}$/
// Fixed dummy hash used only to equalize bcrypt timing for unknown accounts.
// nosemgrep: generic.secrets.security.detected-bcrypt-hash.detected-bcrypt-hash
const DUMMY_HASH = '$2a$11$/QpOnf7ZQ.7bNv1VQzypc.IokViuD38Z2FJChpi8snWk9u1WDdafS'
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex')
const opaqueToken = () => crypto.randomBytes(32).toString('hex')
const normalizedEmail = (value) => typeof value === 'string' ? value.toLowerCase().trim() : ''
const validEmail = (value) => value.length >= 3 && value.length <= 254 && emailPattern.test(value)
const validPassword = (value) => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const mailer = (req) => req.app.locals.sendEmail || sendEmail
const setSession = (res, user) => res.cookie('token', signSession(user), getCookieOptions())

const sendTokenEmail = async (req, user, { subject, path, token, expires }) => {
  const base = env.clientUrls[0].replace(/\/$/, '')
  const route = path.replace(/^\/|\/$/g, '')
  // Keep the bearer token in the fragment: fragments are not sent to the
  // server, CDN logs, or third-party referrers.
  const url = `${base}/${route}#token=${token}`
  const text = `${subject}\n\nThis link expires in ${expires}. If you did not request it, ignore this email.\n\n${url}`
  try {
    await mailer(req)({ to: user.email, subject, text, html: `<p>${escapeHtml(subject)}</p><p>This link expires in ${escapeHtml(expires)}. If you did not request it, ignore this email.</p><p><a href="${escapeHtml(url)}">Continue</a></p>` })
  } catch (error) {
    logger.error(
      'Account email delivery failed:',
      isEmailTransportConfigured ? error.name : 'SMTP transport is not configured'
    )
  }
}

const issueVerification = async (req, user) => {
  // Keep a live link valid. Re-registering or resending for an address must
  // not let an unauthenticated caller invalidate it or generate unlimited mail.
  if (user.emailVerificationHash && user.emailVerificationExpiresAt &&
      new Date(user.emailVerificationExpiresAt).getTime() > Date.now()) return
  const token = opaqueToken()
  user.emailVerificationHash = digest(token)
  user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await user.save()
  void sendTokenEmail(req, user, { subject: 'Verify your Kanvora email', path: 'verify-email', token, expires: '24 hours' })
}

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {}
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50 ||
      typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Valid name, email, and password are required' })
    }
    const address = normalizedEmail(email)
    if (!validEmail(address)) return res.status(400).json({ message: 'A valid email is required' })
    if (!validPassword(password)) return res.status(400).json({ message: 'Password must be 8-72 bytes' })

    const exists = await UserModel.findOne({ email: address })
      .select('+emailVerificationHash +emailVerificationExpiresAt')
    if (exists) {
      // Do not disclose whether an address is registered; resend verification
      // only to an unverified account so its owner can claim the credential.
      if (exists.emailVerified !== true) await issueVerification(req, exists)
      return res.status(201).json({ message: 'User created. Check your email to verify your account.' })
    }

    const user = new UserModel({
      name: name.trim(),
      email: address,
      password: await hash(password, 11),
      role: 'MEMBER',
      emailVerified: false
    })
    await user.save()
    await issueVerification(req, user)
    return res.status(201).json({ message: 'User created. Check your email to verify your account.' })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(201).json({ message: 'User created. Check your email to verify your account.' })
    }
    next(err)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    const user = await UserModel.findOne({ email: normalizedEmail(email) }).select('+password')
    // Always pay one bcrypt comparison so absent accounts do not answer faster.
    const matched = await compare(password, user?.password || DUMMY_HASH)
    if (!user || !matched) return res.status(401).json({ message: 'Invalid email or password' })
    if (user.emailVerified !== true) {
      return res.status(403).json({ message: 'Verify your email before signing in' })
    }

    setSession(res, user)
    const safeUser = user.toObject()
    delete safeUser.password
    delete safeUser.googleSub
    return res.status(200).json({ message: 'Login success', payload: safeUser })
  } catch (err) {
    next(err)
  }
}

export const changepassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body || {}
    if (typeof oldPassword !== 'string' || !validPassword(newPassword)) {
      return res.status(400).json({ message: 'Current and new passwords are required; new password must be 8-72 bytes' })
    }
    const user = await UserModel.findById(req.user.id).select('+password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!await compare(oldPassword, user.password)) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }
    const passwordHash = await hash(newPassword, 11)
    const updatedUser = await UserModel.findOneAndUpdate({
      _id: user._id, password: user.password, sessionVersion: req.user.ver
    }, {
      $set: { password: passwordHash, passwordChangedAt: new Date() },
      $inc: { sessionVersion: 1 },
      $unset: {
        passwordResetHash: 1, passwordResetExpiresAt: 1,
        emailVerificationHash: 1, emailVerificationExpiresAt: 1
      }
    }, { new: true })
    if (!updatedUser) return res.status(401).json({ message: 'Session expired or invalid, please login again' })
    revokeUserAccess(String(updatedUser._id))
    setSession(res, updatedUser)
    return res.status(200).json({ message: 'Password updated successfully' })
  } catch (err) {
    next(err)
  }
}

export const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, username } = req.body || {}
    if (Object.keys(req.body || {}).some((key) => !['name', 'bio', 'username'].includes(key)) ||
      (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50)) ||
      (bio !== undefined && (typeof bio !== 'string' || bio.length > 300)) ||
      (username !== undefined && (typeof username !== 'string' || username.length > 50))) {
      return res.status(400).json({ message: 'Invalid profile fields' })
    }
    const update = {}
    if (name !== undefined) update.name = name.trim()
    if (bio !== undefined) update.bio = bio
    if (username !== undefined) update.username = username.trim()
    const updatedUser = await UserModel.findByIdAndUpdate(req.user.id, { $set: update },
      { new: true, runValidators: true, select: '-password -googleSub' })
    if (!updatedUser) return res.status(404).json({ message: 'User not found' })
    return res.status(200).json({ message: 'Profile updated successfully', payload: updatedUser })
  } catch (err) {
    next(err)
  }
}

export const logout = async (req, res, next) => {
  try {
    await UserModel.updateOne({ _id: req.user.id }, { $inc: { sessionVersion: 1 } })
    revokeUserAccess(req.user.id)
    res.clearCookie('token', getClearCookieOptions())
    return res.status(200).json({ message: 'Logout successful' })
  } catch (err) {
    next(err)
  }
}

export const checkAuth = async (req, res) => {
  const token = req.cookies?.token
  if (!token) return res.status(200).json({ message: 'Not logged in', payload: null })
  try {
    const user = await currentUserFromToken(token)
    return res.status(200).json({ message: 'Authenticated', payload: user })
  } catch {
    res.clearCookie('token', getClearCookieOptions())
    return res.status(200).json({ message: 'Session expired or invalid', payload: null })
  }
}

export const forgotPassword = async (req, res, next) => {
  try {
    const address = normalizedEmail(req.body?.email)
    if (!validEmail(address)) return res.status(200).json({ message: 'If that account exists, reset instructions were sent' })
    const user = await UserModel.findOne({ email: address })
    if (user) {
      const token = opaqueToken()
      user.passwordResetHash = digest(token)
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000)
      await user.save()
      void sendTokenEmail(req, user, { subject: 'Reset your Kanvora password', path: 'reset-password', token, expires: '1 hour' })
    }
    return res.status(200).json({ message: 'If that account exists, reset instructions were sent' })
  } catch (err) {
    next(err)
  }
}

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body || {}
    if (typeof token !== 'string' || !tokenPattern.test(token) || !validPassword(password)) {
      return res.status(400).json({ message: 'Valid reset token and password are required' })
    }
    const passwordHash = await hash(password, 11)
    // Replace the credential and revoke sessions in the same token-consuming write.
    const user = await UserModel.findOneAndUpdate({
      passwordResetHash: digest(token),
      passwordResetExpiresAt: { $gt: new Date() }
    }, {
      $set: {
        password: passwordHash,
        passwordChangedAt: new Date(),
        emailVerified: true
      },
      $inc: { sessionVersion: 1 },
      $unset: {
        passwordResetHash: 1, passwordResetExpiresAt: 1,
        emailVerificationHash: 1, emailVerificationExpiresAt: 1
      }
    }, { new: true })
    if (!user) return res.status(400).json({ message: 'Reset link is invalid or expired' })
    revokeUserAccess(String(user._id))
    return res.status(200).json({ message: 'Password reset successfully' })
  } catch (err) {
    next(err)
  }
}

export const verifyEmail = async (req, res, next) => {
  try {
    const { token, password } = req.body || {}
    if (typeof token !== 'string' || !tokenPattern.test(token) || !validPassword(password)) {
      return res.status(400).json({ message: 'Valid verification token and new password are required' })
    }
    // Verification claims the credential: any password chosen by whoever
    // pre-registered the address is replaced before the account becomes usable.
    const user = await UserModel.findOneAndUpdate({
      emailVerificationHash: digest(token),
      emailVerificationExpiresAt: { $gt: new Date() }
    }, {
      $set: {
        emailVerified: true,
        password: await hash(password, 11),
        passwordChangedAt: new Date()
      },
      $inc: { sessionVersion: 1 },
      $unset: {
        emailVerificationHash: 1, emailVerificationExpiresAt: 1,
        passwordResetHash: 1, passwordResetExpiresAt: 1
      }
    }, { new: true })
    if (!user) return res.status(400).json({ message: 'Verification link is invalid or expired' })
    revokeUserAccess(String(user._id))
    return res.status(200).json({ message: 'Email verified successfully' })
  } catch (err) {
    next(err)
  }
}

export const resendVerification = async (req, res, next) => {
  try {
    const address = normalizedEmail(req.body?.email)
    if (!validEmail(address)) return res.status(200).json({ message: 'If verification is needed, an email was sent' })
    const user = await UserModel.findOne({ email: address })
      .select('+emailVerificationHash +emailVerificationExpiresAt')
    if (user && user.emailVerified !== true) await issueVerification(req, user)
    return res.status(200).json({ message: 'If verification is needed, an email was sent' })
  } catch (err) {
    next(err)
  }
}
