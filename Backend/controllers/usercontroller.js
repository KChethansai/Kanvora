// usercontroller controller: request handlers and domain-side persistence logic.
import { UserModel } from '../models/usermodel.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env, getCookieOptions } from '../config/env.js'

const { sign } = jwt
const { hash, compare } = bcrypt

//register user
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    if (!name?.trim() || !email?.trim() || !password) {
      return res
        .status(400)
        .json({ message: 'Name, email, and password are required' })
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const exists = await UserModel.findOne({ email: normalizedEmail })
    if (exists) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const userDoc = new UserModel({
      name: name.trim(),
      email: normalizedEmail,
      password: await hash(password, 11),
      role: 'MEMBER'
    })
    await userDoc.save()
    return res.status(201).json({ message: 'User Created' })
  } catch (err) {
    next(err)
  }
}

//login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email?.trim() || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' })
    }
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() })
    if (!user) return res.status(404).json({ message: 'Invalid email' })

    const matched = await compare(password, user.password)
    if (!matched) return res.status(400).json({ message: 'Invalid password' })

    const token = sign(
      { email: user.email, id: user._id, role: user.role },
      env.secretKey
    )

    res.cookie('token', token, {
      ...getCookieOptions()
    })

    const safeUser = user.toObject()
    delete safeUser.password

    res.status(200).json({ message: 'Login success', payload: safeUser })
  } catch (err) {
    next(err)
  }
}

//change password
export const changepassword = async (req, res, next) => {
  try {
    if (req.user?.role === 'ADMIN') {
      return res.status(403).json({ message: 'Admins cannot modify users directly' })
    }
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' })
    }
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters' })
    }

    const user = await UserModel.findById(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const isMatch = await compare(oldPassword, user.password)
    if (!isMatch)
      return res.status(400).json({ message: 'Old password is incorrect' })

    user.password = await hash(newPassword, 11)
    await user.save()

    res.status(200).json({ message: 'Password updated successfully' })
  } catch (err) {
    next(err)
  }
}

//update profile - supports name, bio, username
export const updateProfile = async (req, res, next) => {
  try {
    if (req.user?.role === 'ADMIN') {
      return res.status(403).json({ message: 'Admins cannot modify users directly' })
    }
    const { name, bio, username } = req.body
    const updatedUser = await UserModel.findByIdAndUpdate(
      req.user.id,
      { $set: { name, bio, username } },
      { new: true, runValidators: true, select: '-password' }
    )
    if (!updatedUser) return res.status(404).json({ message: 'User not found' })

    res
      .status(200)
      .json({ message: 'Profile updated successfully', payload: updatedUser })
  } catch (err) {
    next(err)
  }
}

//logout
export const logout = async (req, res, next) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: getCookieOptions().secure,
      sameSite: getCookieOptions().sameSite
    })
    res.status(200).json({ message: 'Logout successful' })
  } catch (err) {
    next(err)
  }
}

//check auth status
export const checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token
    if (!token) {
      return res.status(200).json({ message: 'Not logged in', payload: null })
    }

    const decoded = jwt.verify(token, env.secretKey)
    const user = await UserModel.findById(decoded.id).select('-password')

    if (!user) {
      return res.status(200).json({ message: 'User not found', payload: null })
    }

    res.status(200).json({ message: 'Authenticated', payload: user })
  } catch (err) {
    // Return 200 even for invalid/expired tokens to avoid console 401 noise
    res
      .status(200)
      .json({ message: 'Session expired or invalid', payload: null })
  }
}
