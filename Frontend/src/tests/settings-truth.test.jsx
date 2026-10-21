import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Settings from '../components/Settings'

const realRoutes = new Set([
  '/main-page',
  '/main-page/notifications',
  '/main-page/profile',
  '/workspaces/members',
  '/workspaces/settings',
  '/workspaces/settings/profile',
  '/workspaces/settings/activity',
  '/workspaces/settings/cards',
  '/help'
])

const renderSettings = (section) =>
  render(
    <MemoryRouter initialEntries={[`/workspaces/settings/${section}`]}>
      <Routes>
        <Route path="/workspaces/settings/:section" element={<Settings />} />
      </Routes>
    </MemoryRouter>
  )

const inertLabels = [
  /Change language/i,
  /Select all notifications/i,
  /Yes, delete/i,
  /Make profile visible/i
]

describe('settings truthfulness', () => {
  it('replaces inert preference panels with real navigation and an explicit limitation', () => {
    renderSettings('settings')

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    for (const label of inertLabels) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(
      screen.getByText(/does not currently offer email notification preferences/i)
    ).toBeInTheDocument()

    for (const link of screen.getAllByRole('link')) {
      expect(realRoutes.has(link.getAttribute('href'))).toBe(true)
    }
  })

  it('keeps the working profile mutation with associated labels and no fake visibility toggle', () => {
    renderSettings('profile')

    for (const label of ['Full Name', 'Username', 'Bio', 'Email']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeInTheDocument()
    expect(screen.queryByText(/Make profile visible/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open profile and password settings/i }))
      .toHaveAttribute('href', '/main-page/profile')
  })

  it('does not pretend to toggle AI or delete a workspace from this panel', () => {
    renderSettings('ws-settings')

    expect(screen.getByRole('heading', { name: 'Workspace settings' })).toBeInTheDocument()
    expect(screen.queryByText(/AI features/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Yes, delete/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open workspace settings/i })).toBeInTheDocument()
  })
})
