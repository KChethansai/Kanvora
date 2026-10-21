// A2 — the native select and checkbox styling is opt-in.
//
// The application styles its own native controls. Those rules used to be
// element selectors (`select`, `input[type="checkbox"]`), so they also
// restyled any native control rendered by another component or library.
// They are now scoped to `app-native-select` / `app-native-checkbox`, and
// every control the application renders carries the opt-in class.
//
// The `font-family: inherit` rule on controls is deliberately NOT scoped: it
// is inheritance, not a visual override, and the U01 regression test depends
// on it.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(import.meta.dirname, '..')
const read = (...parts) => readFileSync(join(srcDir, ...parts), 'utf8')
const css = read('index.css').replace(/\/\*[\s\S]*?\*\//g, '')

const componentFiles = readdirSync(join(srcDir, 'components')).filter((f) => f.endsWith('.jsx'))

// Collect every native <select> and <input type="checkbox"> in the
// components, with the className it renders. The opening tag is scanned
// directly so a multi-line attribute - and the `=>` of an arrow function
// inside an event handler - cannot end the tag early.
const openingTags = (source) => {
  const tags = []
  const pattern = /<(select|input)\b/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    let index = match.index + match[0].length
    let depth = 0
    while (index < source.length) {
      const two = source.slice(index, index + 2)
      if (two === '=>') { index += 2; continue }
      const char = source[index]
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth <= 0) break
      index += 1
    }
    tags.push({ name: match[1], text: source.slice(match.index, index + 1) })
    pattern.lastIndex = index
  }
  return tags
}

const collect = () => {
  const found = []
  for (const file of componentFiles) {
    const source = read('components', file)
    for (const tag of openingTags(source)) {
      if (tag.name === 'select') found.push({ file, kind: 'select', classText: tag.text })
      else if (/type=["']checkbox["']/.test(tag.text)) {
        found.push({ file, kind: 'checkbox', classText: tag.text })
      }
    }
  }
  return found
}

describe('native control styling is opt-in', () => {
  it('gives every application select the opt-in class', () => {
    const selects = collect().filter((c) => c.kind === 'select')
    expect(selects.length).toBeGreaterThan(0)
    for (const control of selects) {
      expect(control.classText, `${control.file}: a select without app-native-select`).toContain('app-native-select')
    }
  })

  it('gives every application checkbox the opt-in class', () => {
    const checkboxes = collect().filter((c) => c.kind === 'checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
    for (const control of checkboxes) {
      expect(control.classText, `${control.file}: a checkbox without app-native-checkbox`).toContain('app-native-checkbox')
    }
  })

  it('does not style a bare select or a bare checkbox', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
      selector: selector.trim(),
      body
    }))
    const offenders = rules.filter((rule) => {
      if (rule.selector.includes('app-native-')) return false
      const touchesASelect = /(^|[\s,>+~])select\b/.test(rule.selector)
      const touchesACheckbox = /input\s*\[\s*type\s*=\s*["']?checkbox/.test(rule.selector)
      if (!touchesASelect && !touchesACheckbox) return false
      // A rule that only sets the focus outline (the global focus ring) or the
      // font family (inheritance) is not a control restyle.
      const withoutAllowed = rule.body
        .replace(/outline[^;]*;/g, '')
        .replace(/font-family[^;]*;/g, '')
        .trim()
      return withoutAllowed.length > 0
    })
    expect(offenders.map((o) => o.selector)).toEqual([])
  })

  it('keeps the control font family inheritance unscoped', () => {
    // The U01 regression: an unlayered `font: inherit` (or a font-size
    // inheritance) would render every field and button at the body size.
    expect(css).toMatch(/button,\s*input,\s*textarea,\s*select\s*\{\s*font-family:\s*inherit;\s*\}/)
    expect(/(^|[\s,{])(font|font-size)\s*:\s*inherit/.test(css)).toBe(false)
  })
})
