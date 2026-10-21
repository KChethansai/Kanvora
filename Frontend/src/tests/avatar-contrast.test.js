// The avatar fill is a fixed saturated colour in both themes, so the ink on it
// must be fixed too. The theme foreground would be dark on a light fill in one
// theme and light on it in the other, and the initials would be unreadable in
// one of them.
//
// Every entry of the palette has to clear 4.5:1 for 12 px bold text.
import { describe, expect, it } from 'vitest'
import { avatarColorStyles } from '../utils/projectUtils'

// The colours the palette resolves to, and the ink that sits on them.
const PALETTE = {
  'bg-red-500': { fill: '#ef4444', ink: 'text-[var(--kt-on-avatar)]', inkColour: '#0b1f1c' },
  'bg-orange-500': { fill: '#f97316', ink: 'text-[var(--kt-on-avatar)]', inkColour: '#0b1f1c' },
  'bg-amber-500': { fill: '#f59e0b', ink: 'text-[var(--kt-on-avatar)]', inkColour: '#0b1f1c' },
  'bg-emerald-500': { fill: '#10b981', ink: 'text-[var(--kt-on-avatar)]', inkColour: '#0b1f1c' },
  'bg-sky-500': { fill: '#0ea5e9', ink: 'text-[var(--kt-on-avatar)]', inkColour: '#0b1f1c' },
  'bg-violet-600': { fill: '#7c3aed', ink: 'on-scrim', inkColour: '#ffffff' },
  'bg-pink-500': { fill: '#ec4899', ink: 'text-[var(--kt-on-avatar)]', inkColour: '#0b1f1c' },
  'bg-slate-500': { fill: '#64748b', ink: 'on-scrim', inkColour: '#ffffff' }
}

const luminance = (hex) => {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
  const channel = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrast = (a, b) => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('avatar palette', () => {
  it('gives every avatar fill an ink that clears 4.5:1', () => {
    for (const entry of avatarColorStyles) {
      const expected = PALETTE[entry.fill]
      expect(expected, `unknown fill ${entry.fill}`).toBeTruthy()
      expect(entry.ink).toBe(expected.ink)
      expect(
        contrast(expected.inkColour, expected.fill),
        `${entry.fill} with ${entry.ink}`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('covers every fill exactly once', () => {
    const fills = avatarColorStyles.map((entry) => entry.fill)
    expect(new Set(fills).size).toBe(fills.length)
    expect(fills.length).toBe(Object.keys(PALETTE).length)
  })

  it('never lets the theme foreground onto a fixed fill', () => {
    for (const entry of avatarColorStyles) {
      expect(entry.ink).not.toContain('text-white')
      expect(entry.ink).not.toContain('var(--kt-text)')
    }
  })
})
