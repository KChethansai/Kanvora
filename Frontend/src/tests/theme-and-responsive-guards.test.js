// Theme and responsive guards: the stored theme must be resolved before the
// first paint, "system" must stay live, and the layout must not force a
// minimum viewport width.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import RootLayout from '../components/RootLayout'

const read = (...parts) => readFileSync(join(import.meta.dirname, '..', ...parts), 'utf8')

const html = read('..', 'index.html')
const css = read('index.css')
const rootLayout = read('components', 'RootLayout.jsx')

const auth = vi.hoisted(() => ({
  currentUser: null,
  isAuthenticated: false,
  checkAuth: vi.fn(),
  authChecked: true,
  loading: false
}))

vi.mock('../store/authStore', () => ({ useAuth: () => auth }))

const bodyRule = () => {
  const match = /(^|\n)body\s*\{([^}]*)\}/.exec(css)
  if (!match) throw new Error('Missing body rule in index.css')
  return match[2]
}

const mediaListeners = new Set()
const media = {
  matches: false,
  media: '(prefers-color-scheme: dark)',
  onchange: null,
  addEventListener: (_type, handler) => mediaListeners.add(handler),
  removeEventListener: (_type, handler) => mediaListeners.delete(handler),
  addListener: (handler) => mediaListeners.add(handler),
  removeListener: (handler) => mediaListeners.delete(handler),
  dispatchEvent: vi.fn()
}

const fireSystemChange = () => {
  for (const handler of [...mediaListeners]) handler()
}

beforeEach(() => {
  vi.resetAllMocks()
  mediaListeners.clear()
  media.matches = false
  window.matchMedia = vi.fn(() => media)
  window.scrollTo = vi.fn()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.theme
  localStorage.clear()
})

describe('pre-paint theme resolution', () => {
  it('resolves the stored theme into the document before the app module loads', () => {
    const inlineScript = html.indexOf('<script>')
    const appModule = html.indexOf('<script type="module"')

    expect(inlineScript).toBeGreaterThan(-1)
    expect(appModule).toBeGreaterThan(-1)
    expect(inlineScript).toBeLessThan(appModule)

    expect(html).toContain("kanvora-theme")
    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('document.documentElement.dataset.theme')
  })
})

describe('root layout theme handling', () => {
  it('keeps the system theme reactive to the operating system preference', () => {
    expect(rootLayout).toContain('kanvora-theme')
    expect(rootLayout).toContain('prefers-color-scheme: dark')
    expect(rootLayout).toMatch(/addEventListener\?\.\('change'/)
  })

  it('follows an operating system theme change while the theme is "system"', () => {
    localStorage.setItem('kanvora-theme', 'system')
    render(createElement(MemoryRouter, null, createElement(RootLayout)))

    expect(document.documentElement.dataset.theme).toBe('light')

    media.matches = true
    fireSystemChange()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('stores a manual theme choice and applies it', () => {
    localStorage.setItem('kanvora-theme', 'system')
    render(createElement(MemoryRouter, null, createElement(RootLayout)))

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))

    expect(localStorage.getItem('kanvora-theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('responsive layout guard', () => {
  it('does not force a minimum viewport width on the body', () => {
    expect(bodyRule()).not.toMatch(/min-width/)
  })
})
