// Theme scope: the public marketing shell always presents the light palette,
// the authenticated application follows the stored Light / Dark / System
// preference, and the boot script in index.html resolves the same scope
// before the first paint so a cold load never flashes the wrong palette.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, beforeEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { APP_ROUTE_PREFIXES, isPublicShellPath } from '../config/themeScope'

const html = readFileSync(join(import.meta.dirname, '..', '..', 'index.html'), 'utf8')
const css = readFileSync(join(import.meta.dirname, '..', 'index.css'), 'utf8')

const bootScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

const RootLayout = (await import('../components/RootLayout')).default

const renderAt = (path) =>
  render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(RootLayout)
    )
  )

const scope = () => document.documentElement.dataset.themeScope

let media
let listeners

beforeEach(() => {
  localStorage.clear()
  listeners = []
  media = {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type, handler) => listeners.push(handler),
    removeEventListener: () => {},
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  }
  window.matchMedia = () => media
})

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.themeScope
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
})

describe('public route scope', () => {
  it('treats the marketing and recovery routes as the public shell', () => {
    for (const path of [
      '/',
      '/features',
      '/solutions',
      '/resources',
      '/engineering',
      '/design',
      '/team-management',
      '/about',
      '/customer-stories',
      '/help',
      '/guide',
      '/login',
      '/register',
      '/forgot-password'
    ]) {
      expect(isPublicShellPath(path)).toBe(true)
    }
  })

  it('treats the application routes as the authenticated application', () => {
    for (const path of [
      '/main-page',
      '/main-page/notifications',
      '/main-page/profile',
      '/workspaces',
      '/workspaces/projects',
      '/workspaces/members',
      '/workspaces/settings',
      '/templates',
      '/templates/abc',
      '/projects/abc',
      '/inbox',
      '/planner'
    ]) {
      expect(isPublicShellPath(path)).toBe(false)
    }
  })

  it('scopes the public shell to the light palette and leaves the app unscoped', () => {
    localStorage.setItem('kanvora-theme', 'dark')

    renderAt('/features')
    expect(scope()).toBe('light')
    cleanup()

    renderAt('/main-page')
    expect(scope()).toBeUndefined()
  })

  it('keeps the stored preference when the shell scope changes', () => {
    localStorage.setItem('kanvora-theme', 'dark')

    renderAt('/features')
    expect(scope()).toBe('light')
    expect(localStorage.getItem('kanvora-theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('keeps the system preference reactive while a public route is open', () => {
    localStorage.setItem('kanvora-theme', 'system')

    renderAt('/features')
    expect(scope()).toBe('light')

    media.matches = true
    listeners.forEach((handler) => handler())

    // The preference still follows the operating system; only the public
    // shell keeps its own light palette.
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(scope()).toBe('light')
  })
})

describe('theme scope stylesheet', () => {
  it('binds the light palette to the scope attribute as well', () => {
    expect(css).toMatch(/\[data-theme="light"\],\s*\[data-theme-scope="light"\]/)
  })

  it('applies the light-only surface overrides inside the scope too', () => {
    expect(css).toContain(":is([data-theme='light'], [data-theme-scope='light'])")
  })
})

describe('boot script', () => {
  it('resolves the same application route prefixes as the runtime scope', () => {
    const inline = bootScript.match(/var appPrefixes = \[([^\]]*)\]/)?.[1]
    expect(inline).toBeTruthy()
    const parsed = [...inline.matchAll(/'([^']+)'/g)].map(([, value]) => value)
    expect(parsed).toEqual(APP_ROUTE_PREFIXES)
  })

  it('resolves the scope in the document head, before the app renders', () => {
    expect(bootScript).toContain("dataset.themeScope = 'light'")
    expect(html.indexOf('themeScope')).toBeGreaterThan(-1)
    expect(html.indexOf('themeScope')).toBeLessThan(html.indexOf('id="root"'))
  })
})
