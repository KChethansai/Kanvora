// Contract for the board's create forms.
//
// A rejected creation must never silently discard what the person typed: the
// form keeps the title, due date and priority, states inline that nothing was
// created and allows a safe retry. Only a confirmed creation clears the form,
// and the submit button never stays stuck on "Adding...".
//
// jsdom has no layout engine, so the layout assertion below is STRUCTURAL: it
// asserts the option row is a single-column stack, not that the browser gave
// the date input a measured width. The real geometry is verified in a browser
// by the visual pass.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { AddCardForm } from '../components/Card'
import { AddListForm } from '../components/ListColumn'
import Project from '../components/Project'
import { useProjectStore as board } from '../store/projectStore'

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

vi.mock('react-router-dom', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/projects/p1' })
}))

vi.mock('../store/authStore', () => ({
  useAuth: () => ({
    currentUser: { _id: 'u1', name: 'Owner', email: 'owner@example.test' }
  })
}))

vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({ activeWorkspace: null, fetchWorkspace: vi.fn() })
}))

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  })
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))

const PROJECT = {
  _id: 'p1',
  title: 'Audit',
  capabilities: { edit: true, manage: true }
}
const LISTS = [{ _id: 'l1', projectId: 'p1', title: 'To Do', order: 0 }]

const classesOf = (node) => {
  const value =
    typeof node.className === 'string'
      ? node.className
      : node.getAttribute('class') || ''
  return value.split(/\s+/).filter(Boolean)
}

const renderCardForm = (props = {}) =>
  render(
    <AddCardForm listId="l1" onAdd={vi.fn()} onCancel={vi.fn()} {...props} />
  )

const renderListForm = (props = {}) =>
  render(<AddListForm onAdd={vi.fn()} onCancel={vi.fn()} {...props} />)

const fillCardForm = ({
  title = 'Ship the audit',
  dueDate = '2026-11-02',
  priority = 'HIGH'
} = {}) => {
  fireEvent.change(screen.getByLabelText('Card title'), {
    target: { value: title }
  })
  fireEvent.change(screen.getByLabelText('Due date'), {
    target: { value: dueDate }
  })
  fireEvent.change(screen.getByLabelText('Priority'), {
    target: { value: priority }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  board.getState().resetProjects()
  board.getState().resetBoard()
  axios.get.mockImplementation(async (url) => {
    if (url.includes('/projects/p1/lists')) return { data: { payload: LISTS } }
    if (url.includes('/projects/p1')) return { data: { payload: PROJECT } }
    if (url.includes('/lists/l1/cards')) return { data: { payload: [] } }
    return { data: { payload: [] } }
  })
  axios.put.mockResolvedValue({ data: { payload: [] } })
})

afterEach(cleanup)

describe('add-card form contract', () => {
  it('keeps the typed title, date and priority and reports the failure inline', async () => {
    const onAdd = vi.fn().mockResolvedValue(null)
    renderCardForm({ onAdd })

    fillCardForm()
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/not created/i)

    // Nothing the person typed may be lost by a rejected creation.
    expect(screen.getByLabelText('Card title')).toHaveValue('Ship the audit')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-11-02')
    expect(screen.getByLabelText('Priority')).toHaveValue('HIGH')

    // The action stays usable: a retry is possible and the button is not stuck.
    const submit = screen.getByRole('button', { name: 'Add card' })
    expect(submit).toBeEnabled()
  })

  it('keeps the typed title when the creation throws', async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error('network down'))
    renderCardForm({ onAdd })

    fillCardForm()
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/not created/i)
    expect(screen.getByLabelText('Card title')).toHaveValue('Ship the audit')
    expect(screen.getByRole('button', { name: 'Add card' })).toBeEnabled()
  })

  it('clears the title only after a confirmed creation', async () => {
    const onAdd = vi.fn().mockResolvedValue({ _id: 'c1', title: 'Ship the audit' })
    renderCardForm({ onAdd })

    fillCardForm()
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Card title')).toHaveValue('')
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ignores a second Enter while the creation is in flight', async () => {
    let resolveAdd
    const onAdd = vi.fn(
      () => new Promise((resolve) => {
        resolveAdd = resolve
      })
    )
    renderCardForm({ onAdd })

    const title = screen.getByLabelText('Card title')
    fireEvent.change(title, { target: { value: 'Only once' } })
    fireEvent.keyDown(title, { key: 'Enter' })
    fireEvent.keyDown(title, { key: 'Enter' })

    expect(onAdd).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveAdd({ _id: 'c1' })
    })
    expect(screen.getByLabelText('Card title')).toHaveValue('')
  })

  it('stacks the option controls so the date field is never squeezed into a half-width track', () => {
    renderCardForm()

    const dateInput = screen.getByLabelText('Due date')
    const optionsRow = dateInput.parentElement
    const rowClasses = classesOf(optionsRow)

    expect(rowClasses).toContain('grid')
    // One column: the board column has a fixed width, so a two-column track
    // squeezes the native date input below its own minimum width.
    expect(rowClasses).toContain('grid-cols-1')
    expect(rowClasses).not.toContain('grid-cols-2')

    // The control fills the row and may shrink instead of forcing a scroll.
    const inputClasses = classesOf(dateInput)
    expect(inputClasses).toContain('w-full')
    expect(inputClasses).toContain('min-w-0')
    expect(classesOf(screen.getByLabelText('Priority'))).toContain('min-w-0')
  })
})

describe('add-list form contract', () => {
  it('keeps the typed title and reports the failure inline', async () => {
    const onAdd = vi.fn().mockResolvedValue(null)
    renderListForm({ onAdd })

    fireEvent.change(screen.getByLabelText('List title'), {
      target: { value: 'Backlog' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add list' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/not created/i)
    expect(screen.getByLabelText('List title')).toHaveValue('Backlog')
    expect(screen.getByRole('button', { name: 'Add list' })).toBeEnabled()
  })

  it('clears the title only after a confirmed creation', async () => {
    const onAdd = vi.fn().mockResolvedValue({ _id: 'l2', title: 'Backlog' })
    renderListForm({ onAdd })

    fireEvent.change(screen.getByLabelText('List title'), {
      target: { value: 'Backlog' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add list' }))

    await waitFor(() => expect(screen.getByLabelText('List title')).toHaveValue(''))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('board create flows', () => {
  it('reports a rejected card creation in the form and keeps what was typed', async () => {
    axios.post.mockRejectedValue(new Error('server error'))

    render(<Project />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add a card' }))

    const title = screen.getByLabelText('Card title')
    fireEvent.change(title, { target: { value: 'Ship the audit' } })
    fireEvent.change(screen.getByLabelText('Due date'), {
      target: { value: '2026-11-02' }
    })
    fireEvent.keyDown(title, { key: 'Enter' })

    expect(await screen.findByRole('alert')).toHaveTextContent(/not created/i)
    expect(screen.getByLabelText('Card title')).toHaveValue('Ship the audit')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-11-02')
  })

  it('clears the form after a card creation the board confirmed', async () => {
    axios.post.mockResolvedValue({
      data: {
        payload: { _id: 'c1', listId: 'l1', title: 'Ship the audit' }
      }
    })

    render(<Project />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add a card' }))

    const title = screen.getByLabelText('Card title')
    fireEvent.change(title, { target: { value: 'Ship the audit' } })
    fireEvent.keyDown(title, { key: 'Enter' })

    await waitFor(() => expect(screen.getByLabelText('Card title')).toHaveValue(''))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(board.getState().cards.l1?.map((card) => card._id)).toContain('c1')
  })

  it('reports a rejected list creation in the form and keeps what was typed', async () => {
    axios.post.mockRejectedValue(new Error('server error'))

    render(<Project />)
    fireEvent.click(await screen.findByRole('button', { name: /add another list/i }))

    const title = screen.getByLabelText('List title')
    fireEvent.change(title, { target: { value: 'Backlog' } })
    fireEvent.keyDown(title, { key: 'Enter' })

    expect(await screen.findByRole('alert')).toHaveTextContent(/not created/i)
    expect(screen.getByLabelText('List title')).toHaveValue('Backlog')
  })
})
