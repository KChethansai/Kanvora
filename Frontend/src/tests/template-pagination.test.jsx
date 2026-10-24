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
const filterState = vi.hoisted(() => ({ activeFilter: { search: '' } }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => router.navigate,
  useLocation: () => ({ search: location.search }),
  useParams: () => ({ id: 'tpl-1' })
}))
vi.mock('../store/authStore', () => ({ useAuth: () => auth }))
vi.mock('../store/projectStore', () => ({ useProjectStore: () => filterState }))
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
  filterState.activeFilter = { search: '' }
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
      params: { cursor: 'cursor-1' }, withCredentials: true, signal: expect.any(AbortSignal)
    })
    await waitFor(() => expect(screen.queryByRole('button', { name: /load more templates/i })).not.toBeInTheDocument())
  })

  it('keeps the load-more control available when the first page is empty', async () => {
    axios.get.mockImplementation((url) => {
      if (!String(url).includes('/api/templates')) return Promise.resolve({ data: { payload: [] } })
      return Promise.resolve({ data: { payload: [], page: { limit: 24, hasMore: true, nextCursor: 'cursor-empty' } } })
    })
    render(<Templates />)
    expect(await screen.findByText('No matching templates on this page')).toBeInTheDocument()
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

  it('sends marketplace search to every page and preserves it on load more', async () => {
    filterState.activeFilter = { search: '  Incident   retro ' }
    axios.get.mockImplementation((url, config) => {
      if (!String(url).includes('/api/templates')) return Promise.resolve({ data: { payload: [] } })
      if (config?.params?.cursor) return Promise.resolve({
        data: { payload: [template('second', 'Incident retro second page')], page: { hasMore: false, nextCursor: null } }
      })
      return Promise.resolve({
        data: { payload: [template('first', 'Incident retro first page')], page: { hasMore: true, nextCursor: 'search-cursor' } }
      })
    })
    render(<Templates />)
    await screen.findByText('Incident retro first page')
    expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/api/templates`, {
      params: { search: 'Incident retro' }, withCredentials: true, signal: expect.any(AbortSignal)
    })
    fireEvent.click(screen.getByRole('button', { name: /load more templates/i }))
    await screen.findByText('Incident retro second page')
    expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/api/templates`, {
      params: { search: 'Incident retro', cursor: 'search-cursor' }, withCredentials: true, signal: expect.any(AbortSignal)
    })
  })

  it('shows a retryable error instead of an authoritative empty result', async () => {
    axios.get.mockRejectedValue(new Error('offline'))
    render(<Templates />)
    expect(await screen.findByText('Could not load templates.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('No templates found')).not.toBeInTheDocument()
  })

  it('restarts from the first page when a cursor expires and clears the loading state', async () => {
    axios.get.mockImplementation((url, config) => {
      if (!String(url).includes('/api/templates')) return Promise.resolve({ data: { payload: [] } })
      if (config?.params?.cursor) return Promise.reject({ response: { status: 400 } })
      return Promise.resolve({
        data: { payload: [template('fresh', 'Fresh first page')], page: { hasMore: true, nextCursor: 'fresh-cursor' } }
      })
    })
    render(<Templates />)
    await screen.findByText('Fresh first page')
    fireEvent.click(screen.getByRole('button', { name: /load more templates/i }))
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(3))
    expect(axios.get.mock.calls[2][1].params).toEqual({})
    expect(await screen.findByText('Fresh first page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load more templates/i })).toBeEnabled()
  })
})
