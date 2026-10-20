// verifyRolesToken middleware: database-checked, expiring session admission.
import { currentUserFromToken } from '../config/session.js'

export const verifyRolesToken = (...allowedRoles) => async (req, res, next) => {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).json({ message: 'Please login to the application' })
  }

  let user
  try {
    user = await currentUserFromToken(token)
  } catch (err) {
    if (['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(err.name) || err.message === 'Invalid session') {
      return res.status(401).json({ message: 'Session expired or invalid, please login again' })
    }
    return next(err)
  }

  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({
      message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
    })
  }

  req.user = {
    email: user.email,
    id: String(user._id),
    role: user.role,
    ver: user.sessionVersion ?? 0
  }
  next()
}
