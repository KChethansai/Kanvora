import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

test('backend configuration fails closed when NODE_ENV is absent', () => {
  const envPath = fileURLToPath(new URL('../config/env.js', import.meta.url))
  const env = {
    ...process.env,
    NODE_ENV: '',
    DB_URL: 'mongodb://127.0.0.1:27017/never-used',
    SECRET_KEY: 'synthetic-config-test-key'
  }
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '-e',
    `import(${JSON.stringify(pathToFileURL(envPath).href)})`
  ], { env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Missing required env vars: NODE_ENV/)
})
