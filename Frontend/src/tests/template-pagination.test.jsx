// Template discovery is paged: the first page replaces the list, a cursor page
// appends without repeating a row that moved between pages, and the load-more
// control stays reachable even when the current filter matches nothing.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import axios from 'axios'
import Templates from '../components/Templates'
import { API_BASE_URL } from '../config/api'

const router = vi.hoisted(() => ({ navigate: vi.fn() }))
const auth = vi.hoisted(() => ({ currentUser: { _id: 'user-1', role: 'MEMBER' } }))

vi.mock('axios', () => ({
  default: { defaults: {}, get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
const location = vi.hoisted(() => ({ search: '' }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => router.navigate,
  useLocation: () => ({ search: location.search }),
  useParams: () => ({ id: 'tpl-1' })
}))
vi.mock('../store/authStore', () => ({ useAuth: () => auth }))
vi.mock('../store/projectStore', () => ({ useProjectStore: () => ({ activeFilter: { search: '' } }) }))
vi.mock('../components/Navbar', () => ({ default: () => null }))

const template = (id, title) => ({
  _id: id,
  title,
  description: `${title} description`,
  category: 'Business',
  creatorId: 'creator-1',
  creatorName: 'Ada',
  images: [],
  isPublished: true,
  isEditable: false,
  isViewOnly: true,
  allowPublicEdit: false,
  capabilities: { edit: false, delete: false },
  favourite: false,
  type: 'template'
})

beforeEach(() => {
  vi.resetAllMocks()
  location.search = ''
  axios.get.mockImplementation((url, config) => {
    if (!String(url).includes('/api/templates')) return Promise.resolve({ data: { payload: [] } })
    const cursor = config?.params?.cursor
    if (!cursor) {
      return Promise.resolve({
        data: {
          payload: [template('a', 'Alpha'), template('b', 'Beta')],
          page: { limit: 2, hasMore: true, nextCursor: 'cursor-1' }
        }
      })
    }
    // 'b' moved into the next window: it must not be rendered twice.
    return Promise.resolve({
      data: {
        payload: [template('c', 'Gamma'), template('b', 'Beta')],
        page: { limit: 2, hasMore: false, nextCursor: null }
      }
    })
  })
})
afterEach(cleanup)

describe('template discovery paging', () => {
  it('appends the next page without duplicating a row and hides the control at the end', async () => {
    render(<Templates />)
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /load more templates/i }))
    await screen.findByText('Gamma')

    expect(screen.getAllByText('Beta')).toHaveLength(1)
    expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/api/templates`, {
      params: { cursor: 'cursor-1' }, withCredentials: true
    })
    await waitFor(() => expect(screen.queryByRole('button', { name: /load more templates/i })).not.toBeInTheDocument())
  })

  it('keeps the load-more control available when the first page is empty', async () => {
    axios.get.mockImplementation((url) => {
      if (!String(url).includes('/api/templates')) return Promise.resolve({ data: { payload: [] } })
      return Promise.resolve({ data: { payload: [], page: { limit: 24, hasMore: true, nextCursor: 'cursor-empty' } } })
    })
    render(<Templates />)
    expect(await screen.findByText('No templates found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load more templates/i })).toBeInTheDocument()
  })

  it('opens a deep-linked template that is outside the loaded page', async () => {
    location.search = '?selected=deep-link-1'
    axios.get.mockImplementation((url) => {
      if (String(url).endsWith('/api/templates/deep-link-1')) {
        return Promise.resolve({ data: { payload: template('deep-link-1', 'Deep linked template') } })
      }
      if (String(url).includes('/api/templates')) {
        return Promise.resolve({ data: { payload: [template('a', 'Alpha')], page: { limit: 24, hasMore: true, nextCursor: 'c1' } } })
      }
      return Promise.resolve({ data: { payload: [] } })
    })

    render(<Templates />)
    // The row is fetched by id instead of leaving the deep link silently closed.
    expect(await screen.findByText('Deep linked template')).toBeInTheDocument()
    expect(axios.get).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/templates/deep-link-1`,
      { withCredentials: true }
    )
  })
})
