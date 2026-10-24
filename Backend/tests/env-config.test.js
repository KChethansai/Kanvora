import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const envModuleUrl = pathToFileURL(fileURLToPath(new URL('../config/env.js', import.meta.url))).href

// The probe prints only non-secret configuration so assertions can inspect the
// effective environment without ever exposing a secret value.
const PROBE = `const { env } = await import(${JSON.stringify(envModuleUrl)})
process.stdout.write(JSON.stringify({ nodeEnv: env.nodeEnv, clientUrls: env.clientUrls, trustProxy: env.trustProxy, geminiModel: env.geminiModel }))`

const runEnvConfig = ({ env, cwd }) => spawnSync(process.execPath, ['--input-type=module', '-e', PROBE], {
  env,
  cwd,
  encoding: 'utf8'
})

// Explicit minimal environments: the parent environment is never inherited, so
// a developer's shell can never decide what the child configuration is.
const minimalEnv = (overrides = {}) => ({
  NODE_ENV: 'production',
  DB_URL: 'mongodb://127.0.0.1:27017/never-used',
  SECRET_KEY: 'x'.repeat(32),
  CLIENT_URL: 'https://app.example.test',
  TRUST_PROXY: '1',
  ...overrides
})

const readProbe = (result) => JSON.parse(result.stdout)

test('backend configuration fails closed when NODE_ENV is absent', () => {
  const result = runEnvConfig({
    env: {
      NODE_ENV: '',
      DB_URL: 'mongodb://127.0.0.1:27017/never-used',
      SECRET_KEY: 'synthetic-config-test-key'
    }
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Missing required env vars: NODE_ENV/)
})

test('production rejects an invalid proxy trust setting', () => {
  const result = runEnvConfig({
    env: minimalEnv({ TRUST_PROXY: 'not-a-number' })
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /TRUST_PROXY must be an integer/)
})

test('production rejects a SECRET_KEY shorter than 32 characters', () => {
  const result = runEnvConfig({
    env: minimalEnv({ SECRET_KEY: 'x'.repeat(31) })
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /SECRET_KEY must be at least 32 characters in production/)
})

test('production accepts a SECRET_KEY of exactly 32 characters', () => {
  const result = runEnvConfig({
    env: minimalEnv({ SECRET_KEY: 'x'.repeat(32) })
  })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readProbe(result), {
    nodeEnv: 'production',
    clientUrls: ['https://app.example.test'],
    trustProxy: 1,
    geminiModel: 'gemini-3.8-flash'
  })
})

test('GEMINI_MODEL overrides the stable default without exposing credentials', () => {
  const result = runEnvConfig({ env: minimalEnv({ GEMINI_MODEL: 'gemini-3.8-flash-lite' }) })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(readProbe(result).geminiModel, 'gemini-3.8-flash-lite')
  assert.doesNotMatch(result.stdout, /GEMINI_API_KEY/)
})

test('the process environment takes precedence over Backend/.env', () => {
  const result = runEnvConfig({
    env: minimalEnv({ CLIENT_URL: 'https://process-env-wins.example.test' })
  })
  assert.equal(result.status, 0, result.stderr)
  const effective = readProbe(result)
  assert.equal(effective.nodeEnv, 'production')
  assert.deepEqual(effective.clientUrls, ['https://process-env-wins.example.test'])
})

test('a .env in the launch directory cannot select the configuration', () => {
  const launchDir = mkdtempSync(join(tmpdir(), 'kanvora-launch-'))
  try {
    writeFileSync(join(launchDir, '.env'), [
      'NODE_ENV=production',
      `SECRET_KEY=${'y'.repeat(31)}`,
      'CLIENT_URL=https://stale-launch-dir.example.test',
      'TRUST_PROXY=not-a-number',
      ''
    ].join('\n'))

    const result = runEnvConfig({
      cwd: launchDir,
      env: minimalEnv({ CLIENT_URL: 'https://process-env.example.test' })
    })

    assert.equal(result.status, 0, result.stderr)
    const effective = readProbe(result)
    assert.equal(effective.nodeEnv, 'production')
    assert.deepEqual(effective.clientUrls, ['https://process-env.example.test'])
    assert.equal(effective.trustProxy, 1)
  } finally {
    rmSync(launchDir, { recursive: true, force: true })
  }
})

test('the production secret guard still rejects a short key supplied through the process environment', () => {
  const result = runEnvConfig({
    env: minimalEnv({ SECRET_KEY: 'x'.repeat(31) })
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /SECRET_KEY must be at least 32 characters in production/)
  assert.doesNotMatch(result.stderr, /Missing required env vars/)
})

// The application entry point is what used to load a .env from the launch
// directory. Booting it proves that file is no longer able to select the
// configuration of a real server process.
const appModuleUrl = pathToFileURL(fileURLToPath(new URL('../app.js', import.meta.url))).href
const APP_PROBE = `await import(${JSON.stringify(appModuleUrl)})
const { env } = await import(${JSON.stringify(envModuleUrl)})
process.stdout.write(JSON.stringify({ nodeEnv: env.nodeEnv, clientUrls: env.clientUrls, trustProxy: env.trustProxy }))`

const runAppConfig = ({ env, cwd }) => spawnSync(process.execPath, ['--input-type=module', '-e', APP_PROBE], {
  env,
  cwd,
  encoding: 'utf8'
})

const launchDirectoryEnv = () => {
  const launchDir = mkdtempSync(join(tmpdir(), 'kanvora-app-launch-'))
  writeFileSync(join(launchDir, '.env'), [
    'NODE_ENV=production',
    `SECRET_KEY=${'z'.repeat(32)}`,
    'DB_URL=mongodb://127.0.0.1:27017/never-used',
    'CLIENT_URL=https://stale-launch-dir.example.test',
    'TRUST_PROXY=2',
    ''
  ].join('\n'))
  return launchDir
}

test('booting the application ignores a .env in the launch directory', () => {
  const launchDir = launchDirectoryEnv()
  try {
    const result = runAppConfig({
      cwd: launchDir,
      env: {
        NODE_ENV: 'production',
        DB_URL: 'mongodb://127.0.0.1:27017/never-used',
        SECRET_KEY: 'x'.repeat(32)
      }
    })

    if (result.status === 0) {
      // The server booted from the real configuration sources. The file in the
      // launch directory must not have contributed to it.
      const effective = JSON.parse(result.stdout)
      assert.equal(effective.clientUrls.includes('https://stale-launch-dir.example.test'), false)
      assert.notEqual(effective.trustProxy, 2)
    } else {
      // The server must fail closed on whatever it is still missing, and it
      // must never fail with a value taken from the launch directory.
      assert.match(result.stderr, /must be (explicitly )?configured in production/)
      assert.doesNotMatch(result.stderr, /stale-launch-dir\.example\.test/)
    }
  } finally {
    rmSync(launchDir, { recursive: true, force: true })
  }
})

test('booting the application uses the process environment, not the launch directory', () => {
  const launchDir = launchDirectoryEnv()
  try {
    const result = runAppConfig({
      cwd: launchDir,
      env: minimalEnv({ CLIENT_URL: 'https://process-env.example.test' })
    })

    assert.equal(result.status, 0, result.stderr)
    const effective = JSON.parse(result.stdout)
    assert.equal(effective.nodeEnv, 'production')
    assert.deepEqual(effective.clientUrls, ['https://process-env.example.test'])
    assert.equal(effective.trustProxy, 1)
  } finally {
    rmSync(launchDir, { recursive: true, force: true })
  }
})
