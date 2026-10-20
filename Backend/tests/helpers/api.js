import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { once } from 'node:events'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { validateTestDatabaseUrl } from './database.js'

export async function testApi(t) {
  const uri = validateTestDatabaseUrl(process.env.KANVORA_TEST_DB_URL)
  const dbName = `kanvora_test_${process.pid}_${randomUUID().replaceAll('-', '')}`
  Object.assign(process.env, {
    NODE_ENV: 'test', DB_URL: uri, SECRET_KEY: 'synthetic-test-key-only',
    CLIENT_URL: 'http://localhost:5173', COOKIE_SAME_SITE: 'lax', EMAIL_FROM: 'no-reply@example.test',
    SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', GOOGLE_CLIENT_ID: '',
    CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: ''
  })
  const { createApp } = await import('../../app.js')
  const { init } = await import('../../socket.js')
  await mongoose.connect(uri, { dbName, directConnection: true, serverSelectionTimeoutMS: 5000 })
  const mailbox = []
  const server = createServer(createApp({ sendEmail: async (message) => { mailbox.push(message) } }))
  const io = init(server)
  t.after(async () => {
    await new Promise((resolve) => io.close(resolve))
    if (server.listening) await new Promise((resolve) => server.close(resolve))
    // Only the random database created by this fixture may be destroyed.
    assert.equal(mongoose.connection.name, dbName)
    assert.match(dbName, /^kanvora_test_\d+_[a-f0-9]{32}$/)
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  return {
    base, io, mailbox,
    tokenFor: async (user) => jwt.sign({ id: String(user._id), email: user.email, role: user.role }, process.env.SECRET_KEY),
    request: async (method, path, body, token) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Cookie: `token=${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      })
      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch { data = text }
      return { status: response.status, data, headers: response.headers }
    }
  }
}
