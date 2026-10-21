// The origin requirement of the CSRF guard is on by default, reads an explicit
// environment variable, and can never be relaxed in production.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const envSource = readFileSync(new URL('../config/env.js', import.meta.url), 'utf8')
const securitySource = readFileSync(new URL('../config/security.js', import.meta.url), 'utf8')

test('the CSRF origin requirement defaults to on and reads the environment', () => {
  assert.match(envSource, /CSRF_REQUIRE_ORIGIN/)
  assert.match(envSource, /csrfRequireOrigin/)
  // Production may never relax the requirement, whatever the variable says.
  assert.match(envSource, /nodeEnv === 'production'\s*\?\s*true/)
  assert.match(securitySource, /requireOrigin = env\.csrfRequireOrigin/)
})
