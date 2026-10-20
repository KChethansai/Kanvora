import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { validateTestDatabaseUrl, connectTestDatabase } from './helpers/database.js'

test('database tests refuse missing, remote, production and authenticated targets', () => {
  for (const uri of [undefined, 'mongodb+srv://example.com/kanvora_test',
    'mongodb://127.0.0.1/kanvora', 'mongodb://example.com/kanvora_test',
    'mongodb://user:password@127.0.0.1/kanvora_test']) {
    assert.throws(() => validateTestDatabaseUrl(uri))
  }
  assert.equal(validateTestDatabaseUrl('mongodb://127.0.0.1:27028/kanvora_test?directConnection=true'),
    'mongodb://127.0.0.1:27028/kanvora_test?directConnection=true')
})

test('test connections cannot discover a remote replica primary', async () => {
  const previous = process.env.KANVORA_TEST_DB_URL
  const connect = test.mock.method(mongoose, 'createConnection', () => ({ asPromise: async () => ({}) }))
  try {
    for (const query of ['', '?directConnection=false']) {
      process.env.KANVORA_TEST_DB_URL = `mongodb://127.0.0.1:27028/kanvora_test${query}`
      await connectTestDatabase()
      assert.equal(connect.mock.calls.at(-1).arguments[1].directConnection, true)
    }
  } finally {
    connect.mock.restore()
    if (previous === undefined) delete process.env.KANVORA_TEST_DB_URL
    else process.env.KANVORA_TEST_DB_URL = previous
  }
})
