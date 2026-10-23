// Card status labels use the persisted values.
//
// The lookup used "IN PROGRESS" while the database stores "IN-PROGRESS", so
// every in-progress card silently rendered with the To Do fallback. This pins
// the label and the pill styling for all three persisted statuses.
import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import axios from 'axios'
import Settings from '../components/Settings'

vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    activeWorkspace: { _id: 'workspace-1', name: 'Product' },
    fetchWorkspaces: vi.fn()
  })
}))

const cards = [
  { _id: 'c1', title: 'Draft the brief', status: 'TO-DO', projectName: 'Launch', listTitle: 'Backlog' },
  { _id: 'c2', title: 'Record the demo', status: 'IN-PROGRESS', projectName: 'Launch', listTitle: 'Doing' },
  { _id: 'c3', title: 'Ship the release', status: 'DONE', projectName: 'Launch', listTitle: 'Done' }
]

const renderCards = () => render(
  <MemoryRouter initialEntries={['/workspaces/settings/cards']}>
    <Routes>
      <Route path="/workspaces/settings/:section" element={<Settings />} />
    </Routes>
  </MemoryRouter>
)

beforeEach(() => {
  vi.resetAllMocks()
  axios.get.mockResolvedValue({ data: { payload: cards } })
})
afterEach(cleanup)

describe('workspace card status labels', () => {
  it('renders the label and the token styling for every persisted status', async () => {
    renderCards()

    const inProgress = await screen.findByText('Record the demo')
    const inProgressRow = inProgress.closest('article')
    const inProgressLabel = within(inProgressRow).getByText('In Progress')
    // The yellow in-progress token, not the blue To Do fallback.
    expect(inProgressLabel.className).toMatch(/yellow/)
    expect(inProgressLabel.className).not.toMatch(/blue/)

    const todoRow = screen.getByText('Draft the brief').closest('article')
    expect(within(todoRow).getByText('To Do').className).toMatch(/blue/)

    const doneRow = screen.getByText('Ship the release').closest('article')
    expect(within(doneRow).getByText('Done').className).toMatch(/green/)
  })

  it('defaults a card without a status to To Do', async () => {
    axios.get.mockResolvedValue({
      data: { payload: [{ _id: 'c9', title: 'Unlabelled card', projectName: 'Launch' }] }
    })
    renderCards()
    const row = (await screen.findByText('Unlabelled card')).closest('article')
    expect(within(row).getByText('To Do').className).toMatch(/blue/)
  })
})
