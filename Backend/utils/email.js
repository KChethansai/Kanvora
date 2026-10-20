import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

const transportConfigured = Boolean(env.smtpHost && env.smtpUser && env.smtpPass)
let transport = null

const getTransport = () => {
  if (!transportConfigured) {
    throw new Error('SMTP transport is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment.')
  }
  transport ??= nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort || 587,
    secure: env.smtpSecure || env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  })

  return transport
}

export const sendEmail = async ({ to, subject, text, html }) => {
  const mailOptions = {
    from: env.emailFrom,
    to,
    subject,
    text,
    html
  }

  return getTransport().sendMail(mailOptions)
}
