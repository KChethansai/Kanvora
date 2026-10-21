// Dashboard responsive views: the table and calendar views need a legible
// narrow-viewport treatment, the analytics workload panel keeps a fixed dark
// surface and therefore needs scrim ink, and the marketing hero headings must
// wrap instead of pushing the document wider than the viewport.
//
// These are STRUCTURAL assertions. jsdom has no layout engine, so nothing here
// measures pixels: the test proves the responsive branches exist in the
// markup. The pixel-level confirmation (no horizontal overflow at 320/360/390,
// readable contrast in light and dark) was done in a real browser.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { createElement } from 'react'

const project = {
  _id: 'project-1',
  title: 'Release planning',
  updatedAt: new Date().toISOString(),
  archivedAt: null,
  color: null
}

const stores = vi.hoisted(() => ({
  viewMode: 'table',
  projects: [],
  analytics: null
}))

vi.mock('../store/projectStore', () => ({
  useProjectStore: () => ({
    projects: stores.projects,
    activeFilter: { search: '', status: 'ALL' },
    setActiveFilter: vi.fn(),
    saveFilter: vi.fn(),
    savedFilters: [],
    viewMode: stores.viewMode
  })
}))

vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    activeWorkspace: null,
    analytics: stores.analytics,
    fetchWorkspaceAnalytics: vi.fn()
  })
}))

vi.mock('react-router-dom', () => ({
  Outlet: () => null,
  useNavigate: () => vi.fn()
}))

vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Navbar', () => ({ default: () => null }))
vi.mock('../components/Projects', () => ({ default: () => null }))

const { default: MainPage } = await import('../components/MainPage')
const { default: TeamManagement } = await import('../components/TeamManagement')
const { default: AboutKanvora } = await import('../components/AboutKanvora')

const renderDashboard = () => render(createElement(MainPage))

// A fluid type scale, an explicit wrapping utility or a balanced wrap all
// keep a heading inside the viewport.
const hasFluidOrWrappingType = (className = '') =>
  /break-words|break-all|hyphens-auto|text-balance|(?:^|\s)(?:sm|md|lg|xl|2xl):text-/.test(
    className
  )

beforeEach(() => {
  stores.viewMode = 'table'
  stores.projects = [project]
  stores.analytics = {
    totals: { projects: 3, cards: 7, invitations: 1 },
    workload: [{ userId: 'u1', name: 'Ada Lovelace', count: 4 }]
  }
})

afterEach(() => {
  cleanup()
})

describe('dashboard table view', () => {
  it('exposes the wide view as a real table with scoped column headers', () => {
    renderDashboard()

    // The wide view is native table markup: a screen reader can announce the
    // column headers and walk the rows instead of reading three unrelated
    // strings per project.
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()

    const headers = screen.getAllByRole('columnheader')
    expect(headers.length).toBeGreaterThanOrEqual(3)
    for (const header of headers) {
      expect(header.getAttribute('scope')).toBe('col')
    }

    // The table only renders from the `sm` breakpoint up.
    expect(table.closest('[class*="sm:block"]')).toBeTruthy()
  })

  it('renders a stacked narrow-viewport alternative next to the table', () => {
    renderDashboard()

    const title = screen.getAllByText('Release planning')
    // Once in the stacked narrow row and once in the wide table row.
    expect(title.length).toBeGreaterThanOrEqual(2)

    const narrow = Array.from(document.querySelectorAll('[class*="sm:hidden"]')).find(
      (node) => node.textContent.includes('Release planning')
    )
    expect(narrow).toBeTruthy()

    // The status pill and the date stay part of the stacked row.
    expect(narrow.textContent).toMatch(/Active/)
    expect(narrow.textContent).toMatch(/Updated/)

    // The wide view keeps one row per project inside the table body.
    const row = Array.from(document.querySelectorAll('tbody tr')).find(
      (node) => node.textContent.includes('Release planning')
    )
    expect(row).toBeTruthy()
  })
})

describe('dashboard calendar view', () => {
  beforeEach(() => {
    stores.viewMode = 'calendar'
  })

  it('keeps the seven-column grid for wide viewports', () => {
    renderDashboard()

    expect(document.querySelector('[class*="grid-cols-7"]')).toBeInTheDocument()
  })

  it('renders a narrow-viewport agenda alternative next to the grid', () => {
    renderDashboard()

    const narrow = Array.from(document.querySelectorAll('[class*="sm:hidden"]')).find(
      (node) => node.textContent.includes('Release planning')
    )
    expect(narrow).toBeTruthy()

    // The agenda is a list, not a grid of seven clipped columns.
    expect(narrow.querySelectorAll('li').length).toBeGreaterThan(0)
    expect(document.querySelector('[class*="grid-cols-7"]')).toBeInTheDocument()
  })
})

describe('dashboard analytics view', () => {
  beforeEach(() => {
    stores.viewMode = 'analytics'
  })

  it('keeps the workload panel on a themed surface with themed ink', () => {
    renderDashboard()

    // The workload panel used to be a fixed black box with white ink, which
    // read as a defect inside the light dashboard. It follows the theme now,
    // so its ink must be the themed foreground rather than scrim ink.
    const heading = screen.getByRole('heading', { name: /Team Workload/i })
    expect(heading.className).toContain('text-[var(--kt-text)]')
    expect(heading.className).not.toContain('on-scrim')
    expect(heading.className).not.toContain('text-white')

    expect(screen.getByText('Ada Lovelace').className).toContain('text-[var(--kt-text)]')
    expect(screen.getByText(/4 cards/).className).toContain('text-[var(--kt-muted)]')
  })
})

describe('marketing hero headings', () => {
  it('lets the team management hero heading wrap and scale down', () => {
    render(createElement(TeamManagement))

    const heading = screen.getByRole('heading', { name: /Kanvora for Team Management/i })
    expect(hasFluidOrWrappingType(heading.className)).toBe(true)
  })

  it('lets the about hero heading wrap and scale down', () => {
    render(createElement(AboutKanvora))

    const heading = screen.getByRole('heading', { name: /About Kanvora/i })
    expect(hasFluidOrWrappingType(heading.className)).toBe(true)
  })
})
