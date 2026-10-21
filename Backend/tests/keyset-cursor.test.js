// The signed keyset cursor is the one pagination scheme every paged read
// uses. It must be unforgeable, bound to its scope and resume exactly where
// the previous page stopped.
import test from 'node:test'
import assert from 'node:assert/strict'

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_URL: 'mongodb://127.0.0.1:1/kanvora_test',
  SECRET_KEY: 'synthetic-test-key-only',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: ''
})

const scope = { userId: 'a'.repeat(24), projectId: 'b'.repeat(24), endpoint: 'lists' }

test('a cursor round trips and carries the sort key of the last row', async () => {
  const { encodeKeysetCursor, decodeKeysetCursor } = await import('../utils/keysetCursor.js')
  const cursor = encodeKeysetCursor(scope, [7, 'c'.repeat(24)])
  assert.deepEqual(decodeKeysetCursor(cursor, scope, { validate: () => true }), [7, 'c'.repeat(24)])
})

test('a cursor is refused for another scope, another caller or another endpoint', async () => {
  const { encodeKeysetCursor, decodeKeysetCursor } = await import('../utils/keysetCursor.js')
  const cursor = encodeKeysetCursor(scope, [7, 'c'.repeat(24)])
  const refused = [
    { ...scope, projectId: 'd'.repeat(24) },
    { ...scope, userId: 'e'.repeat(24) },
    { ...scope, endpoint: 'cards' }
  ]
  for (const other of refused) {
    assert.throws(() => decodeKeysetCursor(cursor, other, { validate: () => true }), (err) => err.status === 400)
  }
})

test('a forged or malformed cursor is refused', async () => {
  const { encodeKeysetCursor, decodeKeysetCursor } = await import('../utils/keysetCursor.js')
  const cursor = encodeKeysetCursor(scope, [7, 'c'.repeat(24)])
  const [value, signature] = cursor.split('.')
  const forged = `${Buffer.from(JSON.stringify({ ...scope, keys: [9, 'f'.repeat(24)] })).toString('base64url')}.${signature}`
  for (const candidate of [
    `${value}.x`,
    forged,
    'not-a-cursor',
    `${value}.${'x'.repeat(43)}`,
    '',
    undefined,
    42
  ]) {
    assert.throws(() => decodeKeysetCursor(candidate, scope, { validate: () => true }), (err) => err.status === 400)
  }
})

test('the keys of a cursor are validated by the caller', async () => {
  const { encodeKeysetCursor, decodeKeysetCursor } = await import('../utils/keysetCursor.js')
  const cursor = encodeKeysetCursor(scope, [7, 'not-an-object-id'])
  assert.throws(
    () => decodeKeysetCursor(cursor, scope, { validate: (keys) => /^[a-f\d]{24}$/i.test(keys[1]) }),
    (err) => err.status === 400
  )
})

test('a page size is bounded and never clamped silently', async () => {
  const { parsePageLimit, MAX_PAGE_SIZE } = await import('../utils/keysetCursor.js')
  assert.equal(MAX_PAGE_SIZE, 100)
  assert.equal(parsePageLimit(undefined, MAX_PAGE_SIZE), 100)
  assert.equal(parsePageLimit('25', MAX_PAGE_SIZE), 25)
  for (const value of ['0', '101', '1.5', '-1', 'abc', '', ' 1']) {
    assert.throws(() => parsePageLimit(value, MAX_PAGE_SIZE), (err) => err.status === 400, `limit=${value} must be refused`)
  }
})

test('the keyset filter resumes after a position without skipping a row', async () => {
  const { keysetAfter } = await import('../utils/keysetCursor.js')
  const fields = ['order', '_id']
  const values = [7, 'c'.repeat(24)]
  const filter = keysetAfter(fields, values, 'asc')
  assert.equal(filter.$or.length, 2)
  assert.deepEqual(filter.$or[0], { order: { $gt: 7 } })
  assert.deepEqual(filter.$or[1], { order: 7, _id: { $gt: 'c'.repeat(24) } })
  const descending = keysetAfter(fields, values, 'desc')
  assert.deepEqual(descending.$or[0], { order: { $lt: 7 } })
})
