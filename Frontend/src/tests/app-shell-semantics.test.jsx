// App shell semantics.
//
// Three contracts are guarded here:
//
//  1. The dashboard "table" view is a REAL table. A screen reader must be able
//     to announce the column headers and navigate row by row. A div grid with
//     three unrelated strings per project is not a table.
//  2. The narrow (phone) stacked cards keep working and label every field,
//     because the phone layout drops the header row entirely.
//  3. The two authenticated overview routes (/inbox, /planner) read from the
//     application tokens. They sit behind ProtectedRoute, so a fixed
//     marketing surface renders a white card on a dark page.
//
// These are STRUCTURAL assertions. jsdom has no layout engine, so nothing
// here measures pixels: the test proves the semantics exist in the markup.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const read = (...parts) =>
  readFileSync(join(import.meta.dirname, '..', ...parts), 'utf8')

const inboxSource = read('components', 'Inbox.jsx')
const plannerSource = read('components', 'Planner.jsx')
const mainPageSource = read('components', 'MainPage.jsx')
const notificationsSource = read('components', 'Notifications.jsx')
const projectSource = read('components', 'Project.jsx')

const project = {
  _id: 'project-1',
  title: 'Release planning',
  updatedAt: new Date().toISOString(),
  archivedAt: null,
  color: null
}

const secondProject = {
  ...project,
  _id: 'project-2',
  title: 'Design system'
}

const stores = vi.hoisted(() => ({
  viewMode: 'table',
  projects: []
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
    activeWorkspace: { _id: 'workspace-1', name: 'Acme workspace' },
    analytics: null,
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

const renderDashboard = () => render(createElement(MainPage))

beforeEach(() => {
  stores.viewMode = 'table'
  stores.projects = [project]
})

afterEach(() => {
  cleanup()
})

describe('dashboard table view exposes table semantics', () => {
  it('renders a real table with a caption and scoped column headers', () => {
    renderDashboard()

    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()

    const caption = table.querySelector('caption')
    expect(caption).not.toBeNull()
    expect(caption.textContent).toMatch(/Acme workspace/)

    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(3)
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col')
    }
  })

  it('renders one table body row per project', () => {
    stores.projects = [project, secondProject]
    renderDashboard()

    // The body rows only - the header row lives in thead.
    const bodyRows = document.querySelectorAll('tbody tr')
    expect(bodyRows).toHaveLength(stores.projects.length)
    expect(bodyRows[0].textContent).toMatch(/Release planning/)
    expect(bodyRows[1].textContent).toMatch(/Design system/)
  })
})

describe('narrow stacked cards keep their field labels', () => {
  it('renders the stacked card with a label on every field', () => {
    renderDashboard()

    const narrow = Array.from(
      document.querySelectorAll('[class*="sm:hidden"]')
    ).find((node) => node.textContent.includes('Release planning'))

    expect(narrow).toBeTruthy()
    expect(narrow.textContent).toMatch(/Project:/)
    expect(narrow.textContent).toMatch(/Status:/)
    expect(narrow.textContent).toMatch(/Last updated:/)
    // The values themselves are still there.
    expect(narrow.textContent).toMatch(/Active/)
    expect(narrow.textContent).toMatch(/Updated/)
  })
})

describe('authenticated overview routes use the application tokens', () => {
  const fixedMarketingSurfaces = [
    'bg-[#f0fdfa]',
    'bg-[#111111]',
    'text-teal-900',
    'text-teal-700',
    'text-teal-800'
  ]

  it('removes the fixed marketing surfaces from Inbox and Planner', () => {
    for (const [name, source] of [
      ['Inbox.jsx', inboxSource],
      ['Planner.jsx', plannerSource]
    ]) {
      for (const forbidden of fixedMarketingSurfaces) {
        expect(source.includes(forbidden), `${name} still contains ${forbidden}`).toBe(
          false
        )
      }
      expect(source, `${name} uses no app token`).toMatch(/var\(--kt-/)
    }
  })

  it('keeps the honest product copy verbatim', () => {
    expect(inboxSource).toMatch(/not connected to\s+external email/i)
    expect(plannerSource).toMatch(/does not connect to\s+Google Calendar/i)
    expect(plannerSource).toMatch(/A planning overview, not a calendar integration/)
  })
})

describe('shared skeleton primitive', () => {
  it('is marked decorative and pulses with the app token', () => {
    const skeleton = read('components', 'ui', 'skeleton.jsx')

    expect(skeleton).toMatch(/aria-hidden="true"/)
    expect(skeleton).toMatch(/animate-pulse/)
    expect(skeleton).toMatch(/bg-\[var\(--kt-surface-soft\)\]/)
  })

  it('backs the notification list and the board columns', () => {
    expect(notificationsSource).toMatch(/import \{ Skeleton \} from '\.\/ui\/skeleton'/)
    expect(projectSource).toMatch(/import \{ Skeleton \} from '\.\/ui\/skeleton'/)

    // The hand-rolled copies are gone.
    expect(notificationsSource).not.toMatch(/function Skeleton\(\)/)
    expect(mainPageSource).not.toMatch(/function Skeleton\(\)/)
  })
})
