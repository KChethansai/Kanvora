import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (name) => readFileSync(resolve(import.meta.dirname, `../components/${name}.jsx`), 'utf8')

describe('account drawers layer above the sticky navbar', () => {
  it.each(['Notifications', 'UserProfile'])('%s uses the shared modal layer', (name) => {
    expect(source(name)).toMatch(/fixed inset-0 z-50/)
  })
})
