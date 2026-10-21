// Contrast guard for the template marketplace overlays.
//
// The theme bridge repaints `text-white` with the theme foreground, so any
// ink that sits on a dark scrim (cover overlay) or on a fixed saturated fill
// (the green PUBLISHED badge) has to opt out of that repaint. The resolver
// below replays the real index.css bridge against the class list the
// components actually render, so a drift in the stylesheet or in the
// components fails here instead of shipping.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import axios from 'axios'

import TemplateCard from '../components/TemplateCard'
import TemplateDetailPanel from '../components/TemplateDetailPanel'
import TemplateDetail from '../components/TemplateDetail'

const router = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), patch: vi.fn(), post: vi.fn() }
}))
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'tpl-1' }),
  // Stable identity: a fresh function on every render would re-run the
  // component's fetch effect in a loop.
  useNavigate: () => router.navigate
}))

const root = join(import.meta.dirname, '..')
const css = readFileSync(join(root, 'index.css'), 'utf8')

const block = (selector) => {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`Missing CSS block: ${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

const tokens = (selector) =>
  Object.fromEntries(
    [...block(selector).matchAll(/--kt-([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim()
    ])
  )

const themeTokens = {
  dark: tokens(':root,\n[data-theme="dark"]'),
  light: tokens('[data-theme="light"]')
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
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

// Tailwind's real green-500, read from the installed theme so the published
// badge is measured against the fill the browser actually paints.
const oklchToRgb = (l, c, h) => {
  const hue = (h * Math.PI) / 180
  const a = c * Math.cos(hue)
  const b = c * Math.sin(hue)
  const red = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const green = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const blue = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * red - 3.3077115913 * green + 0.2309699292 * blue,
    -1.2684380046 * red + 2.6097574011 * green - 0.3413193965 * blue,
    -0.0041960863 * red - 0.7034186147 * green + 1.707614701 * blue
  ].map((value) => {
    const channel =
      value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(Math.max(value, 0), 1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, channel)) * 255)
  })
}

const tailwindTheme = readFileSync(
  join(root, '..', 'node_modules', 'tailwindcss', 'theme.css'),
  'utf8'
)
const green500 = /--color-green-500:\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/.exec(tailwindTheme)
if (!green500) throw new Error('Missing Tailwind green-500 definition')
const GREEN_FILL = oklchToRgb(Number(green500[1]) / 100, Number(green500[2]), Number(green500[3]))

// Backings measured in a real browser at 1280px in both themes: the
// composited colour behind the overlays on the marketplace cover. The cover is
// a bright teal-green, so `bg-black/60` lands on rgb(0,80,58) and `bg-black/40`
// lands on rgb(0,120,87).
const BADGE_BACKING = [0, 80, 58]
const HEART_BACKING = [0, 120, 87]

const classListOf = (element) => (element.getAttribute('class') || '').split(/\s+/)

const hasClass = (element, name) => classListOf(element).includes(name)

// Replays the index.css cascade for the ink of these overlays:
//   .on-scrim                      -> #ffffff
//   .on-accent                     -> var(--kt-on-accent)
//   text-[var(--kt-on-success)]    -> var(--kt-on-success)
//   text-white (without on-accent/on-scrim) -> var(--kt-text)   [the bridge]
const resolveInk = (element, theme) => {
  const tokens = themeTokens[theme]
  if (hasClass(element, 'on-scrim')) return '#ffffff'
  if (hasClass(element, 'on-accent')) return tokens['on-accent']
  if (hasClass(element, 'text-[var(--kt-on-success)]')) return tokens['on-success']
  if (hasClass(element, 'text-white')) return tokens.text
  return null
}

const template = {
  _id: 'tpl-1',
  title: 'Starter',
  description: 'A starter board',
  category: 'Business',
  creatorId: 'creator-1',
  creatorName: 'Ada',
  images: [],
  isPublished: true,
  capabilities: { edit: false },
  favourite: false,
  type: 'template'
}

const projectTemplate = { ...template, type: 'project' }

const noop = () => {}

const renderCard = (data = template) =>
  render(<TemplateCard template={data} onToggleFav={noop} onClick={noop} onUse={noop} />)

const renderPanel = (data = projectTemplate) =>
  render(
    <TemplateDetailPanel
      template={data}
      onClose={noop}
      isOwner={false}
      onUse={noop}
      onEdit={noop}
      onDelete={noop}
      onToggleFav={noop}
    />
  )

const renderDetail = async (data = projectTemplate) => {
  axios.get.mockResolvedValue({ data: { payload: data } })
  const view = render(<TemplateDetail />)
  await screen.findByText(data.title)
  return view
}

beforeEach(() => {
  vi.resetAllMocks()
  axios.get.mockResolvedValue({ data: { payload: template } })
})

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-theme')
})

describe.each(['dark', 'light'])('%s theme scrim ink', (theme) => {
  it('keeps the marketplace card type badge off the theme foreground', async () => {
    document.documentElement.setAttribute('data-theme', theme)
    renderCard()

    const badge = screen.getByText('Template')
    const ink = resolveInk(badge, theme)

    expect(ink).not.toBe(themeTokens[theme].text)
    expect(ink).toBe('#ffffff')
    expect(hasClass(badge, 'text-white')).toBe(false)
    expect(ratio(hex(ink), BADGE_BACKING)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the card favourite heart off the theme foreground', async () => {
    document.documentElement.setAttribute('data-theme', theme)
    renderCard()

    const heart = screen
      .getByRole('button', { name: 'Add Starter to favourites' })
      .querySelector('svg')
    const ink = resolveInk(heart, theme)

    expect(ink).not.toBe(themeTokens[theme].text)
    expect(ink).toBe('#ffffff')
    expect(hasClass(heart, 'text-white')).toBe(false)
    expect(ratio(hex(ink), HEART_BACKING)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the drawer close button off the theme foreground', async () => {
    document.documentElement.setAttribute('data-theme', theme)
    renderPanel()

    const close = screen.getByRole('button', { name: 'Close template details' })
    const ink = resolveInk(close, theme)

    expect(ink).not.toBe(themeTokens[theme].text)
    expect(ink).toBe('#ffffff')
    expect(hasClass(close, 'text-white')).toBe(false)
    expect(ratio(hex(ink), HEART_BACKING)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the detail page type badge off the theme foreground', async () => {
    document.documentElement.setAttribute('data-theme', theme)
    await renderDetail()

    const badge = screen.getByText('PROJECT BOARD')
    const ink = resolveInk(badge, theme)

    expect(ink).not.toBe(themeTokens[theme].text)
    expect(ink).toBe('#ffffff')
    expect(hasClass(badge, 'text-white')).toBe(false)
    expect(ratio(hex(ink), BADGE_BACKING)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the published badge on the fixed status ink in both themes', async () => {
    document.documentElement.setAttribute('data-theme', theme)
    renderCard()

    const badge = screen.getByText('PUBLISHED')
    const ink = resolveInk(badge, theme)

    expect(ink).toBe(themeTokens[theme]['on-success'])
    expect(ink).toBe('#052e16')
    expect(ink).not.toBe(themeTokens[theme].text)
    expect(hasClass(badge, 'text-white')).toBe(false)
    expect(ratio(hex(ink), GREEN_FILL)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the drawer published badge on the fixed status ink', async () => {
    document.documentElement.setAttribute('data-theme', theme)
    renderPanel()

    const badge = screen.getByText('PUBLISHED')
    const ink = resolveInk(badge, theme)

    expect(ink).toBe(themeTokens[theme]['on-success'])
    expect(ink).not.toBe(themeTokens[theme].text)
    expect(ratio(hex(ink), GREEN_FILL)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the detail page published badge on the fixed status ink', async () => {
    document.documentElement.setAttribute('data-theme', theme)
    await renderDetail()

    const badge = screen.getByText('PUBLISHED')
    const ink = resolveInk(badge, theme)

    expect(ink).toBe(themeTokens[theme]['on-success'])
    expect(ink).not.toBe(themeTokens[theme].text)
    expect(ratio(hex(ink), GREEN_FILL)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('scrim ink invariants', () => {
  it('uses one status ink for the fixed green fill in both themes', () => {
    expect(themeTokens.light['on-success']).toBe(themeTokens.dark['on-success'])
    expect(themeTokens.light['on-success']).toBe('#052e16')
  })

  it('keeps the Tailwind green fill the browser paints', () => {
    expect(GREEN_FILL).toEqual([0, 201, 80])
  })

  it('keeps the bridge rules the ink resolver depends on', () => {
    // Scrim ink must be `!important`, otherwise a Tailwind text utility with
    // the same specificity wins and the ink follows the theme again.
    expect(css).toMatch(/\.on-scrim \{\s*color: #ffffff\s*!important;/)
    expect(css).toMatch(/\.on-accent \{\s*color: var\(--kt-on-accent\);/)
    expect(css).toMatch(
      /\[class~='text-white'\]:not\(\[class~='on-accent'\]\):not\(\[class~='on-scrim'\]\)/
    )
    expect(css).toMatch(
      /\[data-theme='light'\][^{]*\[class~='text-white'\][^{]*:not\(\[class~='on-scrim'\]\)/
    )
  })
})
