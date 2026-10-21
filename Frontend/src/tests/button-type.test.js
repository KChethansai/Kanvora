// A5 — every native <button> declares its type.
//
// A button without a `type` defaults to `type="submit"`, so inside a form it
// submits, and outside one it is a control whose behaviour depends on where
// it is later moved. A line-based grep cannot find the attribute when it sits
// on the next line, so this check scans the opening tag itself.
//
// The submit controls in this application already declare `type="submit"`
// explicitly, so every remaining button is a plain action button.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(import.meta.dirname, '..')
const componentsDir = join(srcDir, 'components')
const files = readdirSync(componentsDir).filter((f) => f.endsWith('.jsx'))

// The opening tag of a JSX element, tolerating an arrow function inside the
// attributes (`=>` must not be mistaken for the end of the tag).
const openingTags = (source) => {
  const tags = []
  const pattern = /<button\b/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    let index = match.index + match[0].length
    let depth = 0
    while (index < source.length) {
      if (source.slice(index, index + 2) === '=>') { index += 2; continue }
      const char = source[index]
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth <= 0) break
      index += 1
    }
    tags.push(source.slice(match.index, index + 1))
    pattern.lastIndex = index
  }
  return tags
}

describe('native button types', () => {
  it('gives every native button an explicit type', () => {
    const missing = []
    for (const file of files) {
      const source = readFileSync(join(componentsDir, file), 'utf8')
      for (const tag of openingTags(source)) {
        if (!/\btype\s*=/.test(tag)) missing.push(`${file}: ${tag.split('\n')[0].trim().slice(0, 60)}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('still declares the real submit controls as submit', () => {
    const submitControls = []
    for (const file of files) {
      const source = readFileSync(join(componentsDir, file), 'utf8')
      for (const tag of openingTags(source)) {
        if (/\btype\s*=\s*["']submit["']/.test(tag)) submitControls.push(file)
      }
    }
    // Login, Register, the profile and the password forms, the publish and the
    // template form, and the recovery screens all submit explicitly.
    expect(new Set(submitControls).size).toBeGreaterThanOrEqual(5)
  })
})
