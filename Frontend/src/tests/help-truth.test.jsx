import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import Help from '../components/Help'
import { helpArticles } from '../content/helpArticles'

// Routes declared in App.jsx. Help links must resolve to one of these.
const appRoutes = new Set([
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
  '/auth',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/workspaces',
  '/workspaces/projects',
  '/workspaces/members',
  '/workspaces/settings',
  '/workspaces/settings/profile',
  '/workspaces/settings/activity',
  '/workspaces/settings/cards',
  '/workspaces/settings/ws-settings',
  '/templates',
  '/inbox',
  '/planner',
  '/main-page',
  '/main-page/notifications',
  '/main-page/profile'
])

const articleText = (article) =>
  [article.summary, article.note, ...article.steps].join(' ')

describe('help content truthfulness', () => {
  it('keeps the curated set at 14 articles with real app routes', () => {
    expect(helpArticles).toHaveLength(14)
    for (const article of helpArticles) {
      for (const route of article.routes ?? []) {
        expect(appRoutes.has(route.to), `${article.id} links to ${route.to}`).toBe(true)
      }
    }
  })

  it('does not send notification help to the Inbox route', () => {
    const notifications = helpArticles.find((article) => article.id === 'comments-and-notifications')
    expect(notifications.routes).toEqual([
      { label: 'Open notifications', to: '/main-page/notifications' }
    ])
    expect(articleText(notifications)).not.toMatch(/open inbox/i)
  })

  it('describes template use without claiming cards or members are copied', () => {
    const templates = helpArticles.find((article) => article.id === 'templates')
    expect(articleText(templates)).toMatch(/does not copy cards, comments, members, or attachments/i)
    expect(articleText(templates)).toMatch(/To Do, In Progress, and Done/)
    expect(articleText(templates)).not.toMatch(/review its lists and cards/i)
  })

  it('does not claim an archive button or save indicator, and describes live OS theme updates', () => {
    const archive = helpArticles.find((article) => article.id === 'archive-restore-delete')
    expect(articleText(archive)).toMatch(/does not include an archive or restore button/i)
    expect(archive.note).toMatch(/no in-app restore control/i)

    const drag = helpArticles.find((article) => article.id === 'reorder-and-move')
    expect(articleText(drag)).not.toMatch(/save indicator/i)

    const theme = helpArticles.find((article) => article.id === 'theme-and-display')
    expect(articleText(theme)).toMatch(/Ctrl\+K or Cmd\+K/)
    expect(theme.note).toMatch(/updates live/i)
    expect(theme.note).not.toMatch(/does not update live/i)
  })

  it('renders the notification article with a working destination', () => {
    render(
      <MemoryRouter initialEntries={['/help']}>
        <Help />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Comments and notifications/i }))
    const link = screen.getByRole('link', { name: /Open notifications/i })
    expect(link).toHaveAttribute('href', '/main-page/notifications')
  })
})
