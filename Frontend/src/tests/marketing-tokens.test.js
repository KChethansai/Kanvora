// Batch 4 — the public marketing pages use the marketing tokens.
//
// The migration had to be colour-identical, so the tokens alias the real
// Tailwind theme variables instead of copying hex values. This test keeps
// that true: a marketing page must not carry a raw palette utility again,
// and the tokens must stay aliases rather than literal colours.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(import.meta.dirname, '..')
const componentsDir = join(srcDir, 'components')
const read = (...parts) => readFileSync(join(srcDir, ...parts), 'utf8')
const css = read('index.css')

const marketingPages = [
  'Home.jsx',
  'Features.jsx',
  'Solutions.jsx',
  'Resources.jsx',
  'Engineering.jsx',
  'Design.jsx',
  'TeamManagement.jsx',
  'CustomerStories.jsx',
  'AboutKanvora.jsx'
]

// The palette utilities a marketing page must not carry any more. The colours
// themselves live in the token block.
const rawPalette =
  /\b(?:text|bg|border|from|via|to|ring|divide)-(?:teal|cyan|sky|emerald|amber|rose|pink|violet|indigo|blue|purple|gray|grey|slate|green|orange|yellow|lime|fuchsia|red)-(?:[0-9]{2,3})(?:\/[0-9]+)?\b/

describe('public marketing tokens', () => {
  it('has no raw palette utility in a marketing page', () => {
    const offenders = []
    for (const file of marketingPages) {
      const source = read('components', file)
      const matches = source.match(rawPalette) || []
      for (const match of matches) {
        offenders.push(`${file}: ${match}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('has no raw hex colour in a marketing page', () => {
    const offenders = []
    for (const file of marketingPages) {
      const source = read('components', file)
      const matches = source.match(/\[#[0-9a-fA-F]{3,8}\]/g) || []
      for (const match of matches) {
        offenders.push(`${file}: ${match}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the marketing tokens as aliases of the Tailwind theme variables', () => {
    // The marketing palette lives in the root scope, so an application
    // surface that uses a token in the dark theme gets the same value.
    const block = css.match(/:root,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)
    expect(block).toBeTruthy()
    const declarations = block[1]
    // Every marketing token resolves to another variable, never to a literal
    // colour: a literal would drift from the utility it replaces.
    const literals = [...declarations.matchAll(/--kt-pub-[a-z0-9-]+:\s*(#[0-9a-fA-F]{3,8}|oklch\([^)]*\))/g)]
    // `#f0fdfa` is the one arbitrary value the pages used and is kept verbatim.
    const allowed = literals.filter((m) => m[0].includes('#f0fdfa'))
    expect(literals.length - allowed.length).toBe(0)
    expect(declarations).toMatch(/--kt-pub-ink:\s*var\(--color-teal-900\)/)
    // #f0fdfa IS Tailwind's teal-50, so the token aliases it instead of
    // copying the hex.
    expect(declarations).toMatch(/--kt-pub-bg:\s*var\(--color-teal-50\)/)
  })

  it('keeps the ink on a saturated fill white in both scopes', () => {
    // `text-white` on a coloured fill was repainted by the compatibility
    // bridge to the dark theme ink, which made it dark on dark.
    expect(css).toMatch(/--kt-pub-on-fill:\s*var\(--color-white\)/)
    for (const file of marketingPages) {
      expect(read('components', file), file).not.toMatch(/\btext-white\b/)
    }
  })

  it('still exports every marketing page', () => {
    for (const file of marketingPages) {
      expect(readdirSync(componentsDir)).toContain(file)
    }
  })
})
