// Template identity: the route id decides which template is on screen, the
// server payload decides what the viewer may do with it, and every mutation
// must target the template that is actually displayed.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import TemplateDetail from '../components/TemplateDetail'

const router = vi.hoisted(() => ({ params: { id: 'tpl-a' }, navigate: vi.fn() }))

vi.mock('axios', () => ({
  default: {
    defaults: {},
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('react-router-dom', () => ({
  useParams: () => router.params,
  useNavigate: () => router.navigate
}))

const template = (id, overrides = {}) => ({
  _id: id,
  title: `Title ${id}`,
  description: 'A template',
  category: 'Business',
  creatorId: 'creator-1',
  creatorName: 'Ada',
  images: [],
  isPublished: true,
  favourite: false,
  type: 'template',
  capabilities: { edit: true },
  ...overrides
})

const goToRoute = async (id, rerender) => {
  router.params = { id }
  rerender(<TemplateDetail />)
}

beforeEach(() => {
  vi.resetAllMocks()
  router.params = { id: 'tpl-a' }
  router.navigate.mockClear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(cleanup)

describe('template identity', () => {
  it('does not render a previous route\'s response as the current template', async () => {
    let resolveA
    axios.get.mockImplementation((url) => {
      if (url === `${API_BASE_URL}/api/templates/tpl-a`) {
        return new Promise((resolve) => { resolveA = resolve })
      }
      return Promise.resolve({ data: { payload: template('tpl-b') } })
    })

    const { rerender } = render(<TemplateDetail />)
    await goToRoute('tpl-b', rerender)

    expect(await screen.findByRole('heading', { name: 'Title tpl-b' })).toBeInTheDocument()

    // The first route finally answers, long after the user moved on.
    resolveA({ data: { payload: template('tpl-a') } })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Title tpl-b' })).toBeInTheDocument()
    )

    expect(screen.queryByRole('heading', { name: 'Title tpl-a' })).not.toBeInTheDocument()
  })

  it('hides the edit and delete controls when the payload denies edit capability', async () => {
    axios.get.mockResolvedValue({
      data: { payload: template('tpl-a', { capabilities: { edit: false } }) }
    })

    render(<TemplateDetail />)
    await screen.findByRole('heading', { name: 'Title tpl-a' })

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to favourites' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /use template/i })).toBeEnabled()
  })

  it('shows the edit and delete controls when the payload grants edit capability', async () => {
    axios.get.mockResolvedValue({
      data: { payload: template('tpl-a', { capabilities: { edit: true } }) }
    })

    render(<TemplateDetail />)
    await screen.findByRole('heading', { name: 'Title tpl-a' })

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('does not offer the previous template\'s actions while the route points at another template', async () => {
    axios.get.mockImplementation(async (url) => {
      if (url === `${API_BASE_URL}/api/templates/tpl-b`) {
        return { data: { payload: template('tpl-b') } }
      }
      // The new route never answers.
      return new Promise(() => {})
    })

    const { rerender } = render(<TemplateDetail />)
    await goToRoute('tpl-b', rerender)
    await screen.findByRole('heading', { name: 'Title tpl-b' })

    await goToRoute('tpl-c', rerender)

    // The template on screen is not the route's template any more, so no
    // action may be offered for it.
    expect(screen.queryByRole('heading', { name: 'Title tpl-b' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(axios.patch).not.toHaveBeenCalled()
    expect(axios.delete).not.toHaveBeenCalled()
  })

  it('sends favourite and delete requests for the template that is on screen', async () => {
    let resolveA
    axios.get.mockImplementation((url) => {
      if (url === `${API_BASE_URL}/api/templates/tpl-a`) {
        return new Promise((resolve) => { resolveA = resolve })
      }
      return Promise.resolve({ data: { payload: template('tpl-b') } })
    })
    axios.patch.mockResolvedValue({ data: { payload: {} } })
    axios.delete.mockResolvedValue({ data: {} })

    const { rerender } = render(<TemplateDetail />)
    await goToRoute('tpl-b', rerender)
    await screen.findByRole('heading', { name: 'Title tpl-b' })

    // The stale route answers last; it must not take over the screen.
    resolveA({ data: { payload: template('tpl-a') } })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Title tpl-b' })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add to favourites' }))
    await waitFor(() => expect(axios.patch).toHaveBeenCalledTimes(1))
    expect(axios.patch.mock.calls[0][0]).toBe(`${API_BASE_URL}/api/templates/tpl-b/favourite`)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(axios.delete).toHaveBeenCalledTimes(1))
    expect(axios.delete.mock.calls[0][0]).toBe(`${API_BASE_URL}/api/templates/tpl-b`)
  })
})
