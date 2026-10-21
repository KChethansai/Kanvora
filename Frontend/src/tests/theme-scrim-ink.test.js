// Scrim ink and fixed-status-fill ink must not follow the theme.
// The theme bridge repaints `text-white` with the theme foreground, so an
// element that sits on a dark scrim or on a saturated status fill has to opt
// out of that repaint. These assertions read the real sources, so a drift in
// index.css or in the shared primitives fails the test.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { modalTitleInput, scrimText, scrimTextMuted, successInk, fieldText } from '../Styles/common'

const root = join(import.meta.dirname, '..')
const css = readFileSync(join(root, 'index.css'), 'utf8')

const block = (selector) => {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`Missing CSS block: ${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

const tokens = (selector) => {
  const body = block(selector)
  return Object.fromEntries(
    [...body.matchAll(/--kt-([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
  )
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

const dark = tokens(':root,\n[data-theme="dark"]')
const light = tokens('[data-theme="light"]')

describe('scrim ink', () => {
  it('never repaints scrim ink with the theme foreground', () => {
    // The general bridge rule and the light-theme override must both skip
    // `on-scrim`, otherwise light ink on a dark scrim is lost in one theme.
    expect(css).toMatch(
      /\[class~='text-white'\]:not\(\[class~='on-accent'\]\):not\(\[class~='on-scrim'\]\)/
    )
    expect(css).toMatch(/\[data-theme='light'\][^{]*\[class~='text-white'\][^{]*:not\(\[class~='on-scrim'\]\)/)
  })

  it('leaves accent-filled controls to the accent ink rule', () => {
    // The bridge must not out-specify the accent rule: an accent-filled
    // button keeps the on-accent ink instead of the theme foreground.
    const bridge = /\[class~='text-white'\][^{]*\{[^}]*\}/.exec(css)?.[0] ?? ''
    for (const fill of ['bg-[#ff4d67]', 'bg-[#e11d48]', 'bg-[#b91c1c]']) {
      expect(bridge).toContain(`:not([class~='${fill}'])`)
    }
    expect(css).toMatch(
      /\[class~='bg-\[#ff4d67\]'\]\[class~='text-white'\][^{]*\{[^}]*var\(--kt-on-accent\)/
    )
  })

  it('keeps the alpha variants of the legacy ink on the theme foreground', () => {
    // The alphas that are still in use stay in the bridge; the ones whose only
    // consumers were converted now carry the theme foreground directly, so the
    // rendered colour is the same either way.
    const components = readFileSync(join(root, 'components', 'MainPage.jsx'), 'utf8')
    for (const alpha of ['40', '60', '70', '80', '90']) {
      const inBridge = css.includes(`[class~='text-white/${alpha}']`)
      const inComponent = components.includes(`text-[var(--kt-text)]/${alpha}`)
      expect(inBridge || inComponent, `text-white/${alpha} has no themed rule and no consumer`).toBe(true)
      if (inBridge) {
        expect(css).toMatch(
          new RegExp(`\\[class~='text-white/${alpha}'\\][^{]*:not\\(\\[class~='on-scrim'\\]\\)[^{]*\\{[^}]*var\\(--kt-text\\)`)
        )
      }
    }
  })

  it('exposes the scrim ink helpers as shared primitives', () => {
    expect(scrimText).toBe('on-scrim')
    expect(scrimTextMuted).toBe('on-scrim-muted')
    expect(css).toContain('.on-scrim {')
    expect(css).toContain('.on-scrim-muted {')
    // Scrim ink must win against any Tailwind text utility.
    expect(css).toMatch(/\.on-scrim \{[^}]*color: #ffffff !important;/)
    expect(css).toMatch(/\.on-scrim-muted \{[^}]*color: rgba\(255, 255, 255, 0\.85\) !important;/)
  })
})

describe('fixed status fill ink', () => {
  // Tailwind's green-500 is a fixed fill in both themes, so its ink must be
  // fixed too: theme ink fails in one of the two themes.
  const greenFill = '#00c950'

  it('defines the status ink in both themes', () => {
    expect(dark['on-success']).toBeTruthy()
    expect(light['on-success']).toBeTruthy()
    expect(light['on-success']).toBe(dark['on-success'])
  })

  it('keeps the status ink readable on the fixed fill', () => {
    expect(ratio(dark['on-success'], greenFill)).toBeGreaterThanOrEqual(4.5)
  })

  it('exposes the status ink as a shared primitive', () => {
    expect(successInk).toContain('var(--kt-on-success)')
  })
})

describe('ink on saturated gradients', () => {
  // Avatar initials and the project card title sit on a saturated colour
  // gradient, not on a neutral scrim. A single ink cannot work for every
  // gradient, so the surface carries its own dark scrim.
  it('gives the avatar initials their own scrim layer', () => {
    const avatar = readFileSync(join(root, 'components', 'MemberAvatar.jsx'), 'utf8')
    expect(avatar).toContain('absolute inset-0 rounded-full bg-black/35')
    expect(avatar).toContain('on-scrim')
  })

  it('gives the project card title a scrim over its gradient', () => {
    const projects = readFileSync(join(root, 'components', 'Projects.jsx'), 'utf8')
    expect(projects).toMatch(/from-black\/55 to-transparent/)
  })
})

describe('variant-prefixed legacy fills', () => {
  const remaps = [
    "[class~='hover:bg-[#18181b]']:hover",
    "[class~='bg-[#0c0c0e]/95']",
    "[class~='bg-[#ff4d67]/14']",
    "[class~='bg-white/[0.04]']"
  ]

  it.each(remaps)('remaps %s to a themed surface', (selector) => {
    expect(css).toContain(selector)
  })

  it('retired the focus fill that no component used', () => {
    // The rule existed to repaint a class nothing rendered any more. It is
    // gone, and nothing can silently depend on it again.
    expect(css).not.toContain("[class~='focus:bg-[#0a0a0a]']")
    const components = readdirSync(join(root, 'components')).filter((f) => f.endsWith('.jsx'))
    for (const file of components) {
      expect(readFileSync(join(root, 'components', file), 'utf8'), file).not.toContain('focus:bg-[#0a0a0a]')
    }
  })
})

describe('modal title field', () => {
  it('keeps a themed focus indicator instead of a fixed dark fill', () => {
    expect(modalTitleInput).not.toMatch(/focus:bg-\[#/)
    expect(modalTitleInput).toContain('focus:ring-[var(--kt-accent)]')
  })
})

describe('field foreground and placeholder', () => {
  it('separates the entered value from the placeholder', () => {
    expect(fieldText).toContain('text-[var(--kt-text)]')
    expect(fieldText).toContain('placeholder:text-[var(--kt-muted)]')
  })
})
