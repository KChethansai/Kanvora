// Tests for template create/edit: only accepted fields are sent, retired
// view-only flags are never included, and project-backed limits are honest.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import axios from 'axios'
import toast from 'react-hot-toast'
import TemplateEditForm from '../components/TemplateEditForm'
import { API_BASE_URL } from '../config/api'

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

const created = { _id: 'tpl-new', title: 'Sprint review' }

const fill = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

const submit = (name) =>
  fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  vi.resetAllMocks()
  axios.post.mockResolvedValue({ data: { payload: created } })
  axios.put.mockResolvedValue({ data: { payload: created } })
})
afterEach(cleanup)

describe('template create form', () => {
  it('posts one accepted-fields body built from the form', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<TemplateEditForm onClose={onClose} onSave={onSave} />)

    expect(
      screen.getByRole('dialog', { name: 'Create template' })
    ).toBeTruthy()
    fill('Template title', '  Sprint review  ')
    fill('Category', 'Business')
    fill('Description', 'Weekly review workflow')
    fill('Cover image URL (optional)', 'https://example.com/cover.png')
    fill('Company', 'Acme')
    fireEvent.click(
      screen.getByRole('checkbox', { name: /published in the marketplace/i })
    )
    submit('Create template')

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/templates`,
        expect.any(Object),
        { withCredentials: true }
      )
    )
    const body = axios.post.mock.calls[0][1]
    expect(Object.keys(body).sort()).toEqual([
      'category',
      'description',
      'images',
      'isPublished',
      'publishDetails',
      'title'
    ])
    expect(body.title).toBe('Sprint review')
    expect(body.category).toBe('Business')
    expect(body.images).toEqual(['https://example.com/cover.png'])
    expect(body.publishDetails).toEqual({ companyName: 'Acme' })
    expect(body).not.toHaveProperty('isViewOnly')
    expect(body).not.toHaveProperty('allowPublicEdit')
    expect(onSave).toHaveBeenCalledWith(created)
    expect(onClose).toHaveBeenCalled()
  })

  it('blocks submission and reports the problem instead of calling the API', async () => {
    render(<TemplateEditForm onClose={vi.fn()} onSave={vi.fn()} />)
    submit('Create template')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Template title is required'
    )
    expect(axios.post).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('rejects a non-http cover image before sending anything', async () => {
    render(<TemplateEditForm onClose={vi.fn()} onSave={vi.fn()} />)
    fill('Template title', 'Sprint review')
    fill('Category', 'Business')
    fill('Cover image URL (optional)', 'javascript:alert(1)')
    submit('Create template')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cover image must be a valid http(s) URL'
    )
    expect(axios.post).not.toHaveBeenCalled()
  })
})

describe('template edit form', () => {
  const projectBacked = {
    _id: 'tpl-project',
    type: 'project',
    title: 'Published board',
    description: 'From a project',
    category: 'Project',
    images: ['https://example.com/project.png'],
    isPublished: true,
    publishDetails: { companyName: 'Acme', category: 'Business' }
  }

  it('omits category and images for a project-backed template', async () => {
    render(
      <TemplateEditForm
        template={projectBacked}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.queryByLabelText('Category')).toBeNull()
    expect(screen.queryByLabelText(/Cover image URL/)).toBeNull()
    expect(
      screen.getByText(/backed by a published project/i)
    ).toBeTruthy()

    fill('Template title', 'Published board v2')
    submit('Save template')

    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/templates/tpl-project`,
        expect.any(Object),
        { withCredentials: true }
      )
    )
    const body = axios.put.mock.calls[0][1]
    expect(body).not.toHaveProperty('category')
    expect(body).not.toHaveProperty('images')
    expect(body).not.toHaveProperty('isViewOnly')
    expect(body).not.toHaveProperty('allowPublicEdit')
    expect(body).toMatchObject({
      title: 'Published board v2',
      isPublished: true
    })
  })

  it('sends an edited category and preserves extra template images', async () => {
    const templateDoc = {
      _id: 'tpl-doc',
      type: 'template',
      title: 'Doc template',
      description: '',
      category: 'Business',
      images: ['https://example.com/one.png', 'https://example.com/two.png'],
      isPublished: false,
      publishDetails: {}
    }
    render(
      <TemplateEditForm
        template={templateDoc}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )

    fill('Category', 'Marketing')
    submit('Save template')

    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/templates/tpl-doc`,
        expect.any(Object),
        { withCredentials: true }
      )
    )
    const body = axios.put.mock.calls[0][1]
    expect(body.category).toBe('Marketing')
    expect(body.images).toEqual([
      'https://example.com/one.png',
      'https://example.com/two.png'
    ])
    expect(body).not.toHaveProperty('isViewOnly')
    expect(body).not.toHaveProperty('allowPublicEdit')
  })

  it('shows the server 400 message instead of pretending the edit worked', async () => {
    const onSave = vi.fn()
    axios.put.mockRejectedValue({
      response: {
        data: { message: 'Use project settings for project images and category' }
      }
    })
    render(
      <TemplateEditForm
        template={projectBacked}
        onClose={vi.fn()}
        onSave={onSave}
      />
    )
    submit('Save template')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Use project settings for project images and category'
    )
    expect(toast.error).toHaveBeenCalledWith(
      'Use project settings for project images and category'
    )
    expect(toast.success).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('is a labelled modal that closes with Escape and a named close button', () => {
    const onClose = vi.fn()
    render(
      <TemplateEditForm
        template={projectBacked}
        onClose={onClose}
        onSave={vi.fn()}
      />
    )

    const dialog = screen.getByRole('dialog', { name: 'Edit template' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Close template form' })
    )
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
