import mongoose from 'mongoose'

export function validateTestDatabaseUrl(value) {
  if (!value) throw new Error('KANVORA_TEST_DB_URL must name an isolated local test database')
  const url = new URL(value)
  if (url.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !/^\/kanvora_test(?:_[a-z0-9_]+)?$/i.test(url.pathname) || url.username || url.password) {
    throw new Error('Refusing database tests outside a local kanvora_test database')
  }
  return value
}

export async function connectTestDatabase() {
  const uri = validateTestDatabaseUrl(process.env.KANVORA_TEST_DB_URL)
  return mongoose.createConnection(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 }).asPromise()
}
