// The cascade rule the compatibility bridge forces on every themed fill.
//
// The bridge paints a base fill with `!important`, so a hover or focus utility
// on that same element only wins if it is important too. A plain utility is
// silently dead: the control keeps its resting colour on hover.
//
// This checks the real class strings: an element whose base fill is a bridged
// hex must carry an important hover or focus utility.
//
// Usage: npx vitest run src/tests/themed-state-cascade.test.js
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsDir = join(import.meta.dirname, '..', 'components')
const styleDir = join(import.meta.dirname, '..', 'Styles')
const files = [
  ...readdirSync(componentsDir).filter((f) => f.endsWith('.jsx')).map((f) => join(componentsDir, f)),
  ...readdirSync(styleDir).filter((f) => f.endsWith('.js')).map((f) => join(styleDir, f))
]

// The base fills the compatibility bridge repaints with `!important`.
const BRIDGED_BASE = [
  'bg-[#ff4d67]',
  'bg-[#ff6b82]',
  'bg-[#050505]',
  'bg-[#09090b]',
  'bg-[#0a0a0a]',
  'bg-[#0c0c0e]',
  'bg-[#0e1114]',
  'bg-[#101418]',
  'bg-[#111111]',
  'bg-[#18181b]',
  'bg-[#1a1a1a]',
  'bg-[#1b1b1b]',
  'bg-[#1d2125]',
  'bg-[#22272b]',
  'bg-[#242024]',
  'bg-[#27272a]',
  'bg-[#2c333a]'
]

// A themed hover or focus fill that has to win over the bridge.
const STATE_FILL = /((?:hover|focus|focus-visible):bg-\[var\(--kt-[a-z-]+\)\])(!?)(?![\w-])/g

const classStrings = (text) => {
  const out = []
  for (const m of text.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) out.push(m[1] ?? m[2] ?? '')
  for (const m of text.matchAll(/`([\s\S]*?)`/g)) out.push(m[1] ?? '')
  return out
}

describe('themed hover and focus fills over a bridged base', () => {
  it('makes every themed state fill important where the base fill is bridged', () => {
    const offenders = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const s of classStrings(text)) {
        const tokens = s.split(/\s+/)
        const hasBridgedBase = tokens.some((t) => BRIDGED_BASE.includes(t))
        if (!hasBridgedBase) continue
        STATE_FILL.lastIndex = 0
        let match
        while ((match = STATE_FILL.exec(s)) !== null) {
          const [full, , important] = match
          if (!important) {
            offenders.push(`${file.replace(/.*Frontend\//, '')}: ${full} on a bridged base fill`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the bridge repainting the base fills it owns', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'index.css'), 'utf8')
    expect(css).toMatch(/\[class~='bg-\[#ff4d67\]'\][^{]*\{[^}]*background-color: var\(--kt-accent\) !important/)
    expect(css).toMatch(/\[class~='bg-\[#0a0a0a\]'\][^{]*\{[^}]*background-color: var\(--kt-bg\) !important/)
  })

  it('does not use a class the retired bridge no longer repaints', () => {
    // These tokens lost their themed repaint. A component that still uses one
    // renders the raw utility - a literal pink hover, a black focus fill.
    const retired = [
      'hover:bg-[#ff6b82]',
      'hover:bg-[#ff4d67]/20',
      'focus:bg-[#050505]',
      'focus:bg-[#0a0a0a]',
      'bg-[#0c0c0e]',
      'bg-[#242024]',
      'bg-[#27272a]',
      'bg-[#2c333a]',
      'bg-[#ff6b82]',
      'bg-[#ff4d67]/[0.14]',
      'bg-[#101418]/80'
    ]
    const offenders = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const s of classStrings(text)) {
        for (const token of s.split(/\s+/)) {
          if (retired.includes(token)) {
            offenders.push(`${file.replace(/.*Frontend\//, '')}: ${token}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
