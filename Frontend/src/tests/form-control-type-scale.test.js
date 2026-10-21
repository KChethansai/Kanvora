// The type scale of the form controls.
//
// Tailwind's preflight sets `font: inherit` inside `@layer base`, where a
// `text-sm` / `text-xs` utility can still override the size. The application
// stylesheet is unlayered, so an unlayered `font: inherit` on the controls
// would outrank every font-size utility and render every field and button at
// the body size. The rule may set the family, but never the shorthand.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const raw = readFileSync(join(import.meta.dirname, '..', 'index.css'), 'utf8')
// Comments are not declarations.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')

const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selector: selector.trim(),
  body
}))

const formControlSelector = /(input|select|textarea|button)\b/

describe('form control type scale', () => {
  it('never uses the font shorthand on a form control', () => {
    const offenders = rules
      .filter(
        (rule) =>
          formControlSelector.test(rule.selector) &&
          /(^|;|\s)font\s*:/.test(rule.body)
      )
      .map((rule) => rule.selector)

    expect(offenders).toEqual([])
  })

  it('inherits the font family on the form controls', () => {
    const familyRule = rules.find(
      (rule) =>
        formControlSelector.test(rule.selector) &&
        /font-family\s*:\s*inherit/.test(rule.body)
    )

    expect(familyRule).toBeTruthy()
  })
})
