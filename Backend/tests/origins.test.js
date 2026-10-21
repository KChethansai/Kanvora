import test from 'node:test'
import assert from 'node:assert/strict'
import { clientOrigins, LOCAL_DEV_ORIGINS, normalizeOrigin } from '../config/origins.js'

test('origins are normalised so a trailing slash cannot disable realtime', () => {
  assert.equal(normalizeOrigin('https://app.example.test/'), 'https://app.example.test')
  assert.equal(normalizeOrigin('https://app.example.test///'), 'https://app.example.test')
  assert.equal(normalizeOrigin('https://app.example.test'), 'https://app.example.test')
  assert.equal(normalizeOrigin(''), '')
  assert.equal(normalizeOrigin(undefined), '')
})

test('configured client origins are normalised and de-duplicated', () => {
  assert.deepEqual(
    clientOrigins(['https://app.example.test/', 'https://app.example.test', 'https://docs.example.test']),
    ['https://app.example.test', 'https://docs.example.test']
  )
  assert.deepEqual(clientOrigins([]), [])
  assert.deepEqual(clientOrigins(['  ']), [])
})

test('the local development origins are exact and never include a trailing slash', () => {
  for (const origin of LOCAL_DEV_ORIGINS) {
    assert.equal(normalizeOrigin(origin), origin)
  }
})
