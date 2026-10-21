// Public shell guards: the marketing shell must paint itself with the public
// token set, must navigate with real links instead of buttons, and its loader
// and 404 page must stay inside the application theme.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'

import BrandMark from '../components/BrandMark'
import AboutKanvora from '../components/AboutKanvora'
import Header from '../components/Header'
import { NotFound, PageLoader } from '../App'

const read = (...parts) => readFileSync(join(import.meta.dirname, '..', ...parts), 'utf8')

const aboutSource = read('components', 'AboutKanvora.jsx')

const auth = vi.hoisted(() => ({
  currentUser: null,
  isAuthenticated: false,
  authChecked: true,
  loading: false,
  checkAuth: vi.fn()
}))

vi.mock('../store/authStore', () => ({ useAuth: () => auth }))

const LocationProbe = () => {
  const location = useLocation()
  return <span data-testid="location">{location.pathname}</span>
}

const renderHeader = (pathname) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header />
    </MemoryRouter>
  )

afterEach(() => {
  cleanup()
})

describe('about hero', () => {
  it('drops the legacy black/red gradient stops for the public hero tokens', () => {
    expect(aboutSource).not.toContain('from-[#050505]')
    expect(aboutSource).not.toContain('via-[#111111]')
    expect(aboutSource).not.toContain('to-[#3b0a14]')
  })

  it('paints the hero band with the public hero tokens', () => {
    expect(aboutSource).toContain('var(--kt-pub-hero-from)')
    expect(aboutSource).toContain('var(--kt-pub-hero-via)')
    expect(aboutSource).toContain('var(--kt-pub-hero-to)')
  })

  it('renders the hero band with the public hero tokens', () => {
    render(
      <MemoryRouter>
        <AboutKanvora />
      </MemoryRouter>
    )

    const hero = screen.getByRole('heading', { name: 'About Kanvora' }).parentElement
    expect(hero.className).toContain('from-[var(--kt-pub-hero-from)]')
    expect(hero.className).toContain('via-[var(--kt-pub-hero-via)]')
    expect(hero.className).toContain('to-[var(--kt-pub-hero-to)]')
    expect(hero.className).not.toContain('#050505')
  })
})

describe('public navigation', () => {
  it('renders every marketing destination as a real in-app link', () => {
    renderHeader('/features')

    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute(
      'href',
      '/features'
    )
    expect(screen.getByRole('link', { name: 'Solutions' })).toHaveAttribute(
      'href',
      '/solutions'
    )
    expect(screen.getByRole('link', { name: 'Resources' })).toHaveAttribute(
      'href',
      '/resources'
    )
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help')
  })

  it('marks the current route with aria-current', () => {
    renderHeader('/features')

    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', { name: 'Help' })).not.toHaveAttribute('aria-current')
  })
})

describe('brand mark', () => {
  it('carries the name as text and keeps the logo image decorative', () => {
    const { container } = render(
      <MemoryRouter>
        <BrandMark />
      </MemoryRouter>
    )

    expect(screen.getByText('Kanvora')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kanvora' })).toHaveAttribute('href', '/')

    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    expect(image).toHaveAttribute('alt', '')
  })
})

describe('not found page', () => {
  it('keeps the 404 page on the application theme', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )

    const page = container.firstElementChild
    expect(page.className).toContain('bg-[var(--kt-bg)]')
    expect(page.className).not.toContain('premium-app-bg')

    const heading = screen.getByRole('heading', { name: 'Page not found' })
    expect(heading.className).toContain('text-[var(--kt-text)]')

    const copy = screen.getByText(
      'The page you are looking for does not exist or has moved.'
    )
    expect(copy.className).toContain('text-[var(--kt-muted)]')

    const cta = screen.getByRole('link', { name: 'Back to home' })
    expect(cta.className).toContain('bg-[var(--kt-accent)]')
    expect(cta.className).toContain('text-[var(--kt-on-accent)]')
  })

  it('returns home through the router instead of reloading the document', () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <NotFound />
        <LocationProbe />
      </MemoryRouter>
    )

    const cta = screen.getByRole('link', { name: 'Back to home' })
    expect(cta).toHaveAttribute('href', '/')

    fireEvent.click(cta)

    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })
})

describe('page loader', () => {
  it('announces the wait to assistive technology', () => {
    render(<PageLoader />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})
