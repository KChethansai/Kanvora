import test from 'node:test'
import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'

process.env.NODE_ENV = 'test'
process.env.DB_URL = 'mongodb://127.0.0.1:1/kanvora_test'
process.env.SECRET_KEY = 'synthetic-test-key-only'
process.env.SMTP_HOST = '127.0.0.1'
process.env.SMTP_USER = 'synthetic-test-user'
process.env.SMTP_PASS = 'synthetic-test-password'

test('importing mail utilities performs no provider initialization or verification', async () => {
  const sent = []
  const create = test.mock.method(nodemailer, 'createTransport', () => ({
    verify: () => Promise.resolve(),
    sendMail: async (message) => { sent.push(message); return { accepted: [message.to] } }
  }))
  try {
    const { sendEmail } = await import('../utils/email.js')
    assert.equal(create.mock.callCount(), 0, 'mail transport must be lazy')
    await sendEmail({ to: 'recipient@example.test', subject: 'Test', text: 'Synthetic content' })
    assert.equal(create.mock.callCount(), 1)
    assert.equal(sent.length, 1)
  } finally {
    create.mock.restore()
  }
})
