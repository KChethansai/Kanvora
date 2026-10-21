// Contrast guard: the semantic tokens must stay WCAG AA in both themes and on
// the fixed light auth surface. Values are read from index.css so the test
// fails if a token drifts, not just if a component class changes.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(import.meta.dirname, '..', 'index.css'), 'utf8')

const block = (selector) => {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`Missing CSS block: ${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

const tokens = (selector) => {
  const body = block(selector)
  return Object.fromEntries([...body.matchAll(/--kt-([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}

const hex = (value) => {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) throw new Error(`Expected a solid hex token, received: ${value}`)
  return [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16))
}

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (foreground, background) => {
  const [light, dark] = [luminance(hex(foreground)), luminance(hex(background))].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

const themes = {
  dark: { tokens: tokens(':root,\n[data-theme="dark"]'), surface: 'surface-raised' },
  light: { tokens: tokens('[data-theme="light"]'), surface: 'surface' },
  auth: { tokens: tokens('.surface-light'), surface: 'surface' }
}

describe.each(Object.entries(themes))('%s theme contrast tokens', (name, { tokens: theme, surface }) => {
  it('keeps body and muted text at AA (4.5:1) on the card surface', () => {
    expect(ratio(theme.text, theme[surface])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(theme.muted, theme[surface])).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps accents, links, and danger text readable', () => {
    expect(ratio(theme['on-accent'], theme.accent)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(theme['accent-text'], theme[surface])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(theme.danger, theme[surface])).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps field outlines at the 3:1 non-text minimum', () => {
    expect(ratio(theme['field-border'], theme[surface])).toBeGreaterThanOrEqual(3)
  })
})

describe('light-theme board surfaces', () => {
  it('keeps status list panels light and chip ink dark', () => {
    for (const token of [
      "[class~='bg-sky-950/40']",
      "[class~='bg-amber-950/35']",
      "[class~='bg-emerald-950/35']",
      "[class~='bg-[#111111]/92']",
      "[class~='text-amber-200']",
      "[class~='text-slate-200']",
      "[class~='text-blue-200']",
      "[class~='text-red-200']",
      "[class~='text-sky-200']",
      "[class~='text-emerald-200']"
    ]) {
      expect(css).toContain(`[data-theme='light'] ${token}`)
    }
  })
})

describe('fixed light auth surface', () => {
  it('overrides the document theme instead of inheriting dark ink', () => {
    expect(themes.auth.tokens.text).toBe('#102522')
    expect(themes.auth.tokens.surface).toBe('#ffffff')
    expect(themes.auth.tokens['on-accent']).toBe('#ffffff')
  })

  it('exposes the surface scope in CSS so markup can opt in', () => {
    expect(css).toContain('.surface-light {')
    expect(css).toContain('.on-accent {')
    expect(css).toContain('.on-scrim {')
  })
})
