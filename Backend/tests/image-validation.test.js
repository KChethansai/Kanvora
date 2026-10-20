import test from 'node:test'
import assert from 'node:assert/strict'
import { hasImageSignature } from '../utils/image.js'

test('uploaded image signatures must match the declared image type', () => {
  assert.equal(hasImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'), true)
  assert.equal(hasImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), 'image/jpeg'), true)
  assert.equal(hasImageSignature(Buffer.from('<svg onload="alert(1)">'), 'image/png'), false)
  assert.equal(hasImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), 'image/png'), false)
  assert.equal(hasImageSignature(Buffer.alloc(0), 'image/jpeg'), false)
})
