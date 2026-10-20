// UserAPI routes: authentication, session and account-recovery endpoints.
import exp from 'express'
import {
  registerUser,
  login,
  changepassword,
  updateProfile,
  logout,
  checkAuth,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification
} from '../controllers/usercontroller.js'
import { verifyRolesToken } from '../middlewares/verifyRolesToken.js'
import { authLimiter } from '../config/security.js'

export const Userapp = exp.Router()

const auth = verifyRolesToken('MEMBER', 'ADMIN', 'MANAGER', 'VIEWER')

Userapp.post('/register', authLimiter, registerUser)
Userapp.post('/login', authLimiter, login)
Userapp.post('/logout', auth, logout)
Userapp.put('/change-password', auth, authLimiter, changepassword)
Userapp.put('/profile', auth, updateProfile)
Userapp.get('/check-auth', checkAuth)
Userapp.post('/forgot-password', authLimiter, forgotPassword)
Userapp.post('/reset-password', authLimiter, resetPassword)
Userapp.post('/verify-email', authLimiter, verifyEmail)
Userapp.post('/resend-verification', authLimiter, resendVerification)
