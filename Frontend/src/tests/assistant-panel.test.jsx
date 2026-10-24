// Assistant panel behaviour.
//
// Keyless help is local and instant. AI mode goes through the backend only, and
// a failed call falls back to built-in help rather than pretending an AI answer
// arrived. The panel is a dialog: Escape closes it and focus returns to the
// launcher.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import Assistant from '../components/Assistant'
import { ASSISTANT_ROUTES } from '../utils/assistantHelp'

const router = vi.hoisted(() => ({ navigate: vi.fn() }))
const auth = vi.hoisted(() => ({ currentUser: { _id: 'user-1', name: 'Ada' } }))
const projects = vi.hoisted(() => ({ list: [] }))

vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn(), post: vi.fn() } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => router.navigate }))
vi.mock('../store/authStore', () => ({ useAuth: () => auth }))
vi.mock('../store/projectStore', () => ({
  useProjectStore: (selector) => (selector ? selector({ projects: projects.list }) : { projects: projects.list })
}))

const statusResponse = (payload) => ({ data: { payload } })
const helpStatus = statusResponse({ enabled: false, mode: 'help', model: null, notice: null })
const aiStatus = statusResponse({ enabled: true, mode: 'ai', model: 'test-flash', notice: null })

const open = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Open Kanvora Assistant' }))
  return screen.getByRole('dialog', { name: 'Kanvora Assistant' })
}

const log = () => within(screen.getByTestId('assistant-log'))

const ask = (text) => {
  fireEvent.change(screen.getByLabelText('Message the Kanvora Assistant'), { target: { value: text } })
  fireEvent.keyDown(screen.getByLabelText('Message the Kanvora Assistant'), { key: 'Enter' })
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.currentUser = { _id: 'user-1', name: 'Ada' }
  projects.list = []
  axios.get.mockResolvedValue(helpStatus)
})
afterEach(cleanup)

describe('assistant launcher and help mode', () => {
  it('opens a labelled dialog and says which mode it is in', async () => {
    render(<Assistant />)
    const launcher = screen.getByRole('button', { name: 'Open Kanvora Assistant' })
    expect(launcher).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    open()
    expect(screen.getByRole('dialog', { name: 'Kanvora Assistant' })).toBeInTheDocument()
    expect(await screen.findByText('Help mode')).toBeInTheDocument()
    expect(screen.getByText(/AI answers are not configured/i)).toBeInTheDocument()
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/assistant/status'), expect.objectContaining({ withCredentials: true })
    ))
  })

  it('keeps help available and reports unknown status after an outage, then retries to AI mode', async () => {
    axios.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(aiStatus)
    render(<Assistant />)
    open()
    expect(await screen.findByText(/status is unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry assistant status/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry assistant status/i }))
    expect(await screen.findByText('AI · test-flash')).toBeInTheDocument()
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('refreshes failed status when reopened without duplicate requests while open', async () => {
    axios.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(aiStatus)
    render(<Assistant />)
    open()
    expect(await screen.findByText(/status is unavailable/i)).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    open()
    expect(await screen.findByText('AI · test-flash')).toBeInTheDocument()
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('answers a suggested question from local help without any network request', async () => {
    render(<Assistant />)
    open()
    fireEvent.click(screen.getByRole('button', { name: /How do I create a workspace/ }))

    expect(await log().findByText(/Create workspace in the sidebar/i)).toBeInTheDocument()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('sends on Enter and inserts a newline on Shift+Enter', () => {
    render(<Assistant />)
    open()
    const input = screen.getByLabelText('Message the Kanvora Assistant')

    fireEvent.change(input, { target: { value: 'How do I invite a teammate?' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(input.value).toBe('How do I invite a teammate?')
    expect(log().queryByText(/Select the workspace, then open Members/i)).not.toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(log().getByText(/Select the workspace, then open Members/i)).toBeInTheDocument()
    expect(input.value).toBe('')
  })

  it('answers an unknown question honestly', () => {
    render(<Assistant />)
    open()
    ask('What is the airspeed of a swallow?')
    expect(log().getByText(/I can explain how Kanvora works/i)).toBeInTheDocument()
  })

  it('offers only allowlisted navigation and closes before navigating', () => {
    render(<Assistant />)
    open()
    fireEvent.click(screen.getByRole('button', { name: /How do I create a workspace/ }))
    const routes = screen.getAllByRole('button', { name: /Open/ })
    for (const route of routes) {
      expect(route.textContent?.trim()).toBeTruthy()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Open dashboard' }))
    expect(router.navigate).toHaveBeenCalledWith('/main-page')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(ASSISTANT_ROUTES).toContain(router.navigate.mock.calls[0][0])
  })

  it('clears the conversation and closes on Escape with focus back on the launcher', async () => {
    render(<Assistant />)
    const launcher = screen.getByRole('button', { name: 'Open Kanvora Assistant' })
    launcher.focus()
    open()
    ask('How do I create a workspace?')
    expect(log().getByText(/Create workspace in the sidebar/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }))
    expect(log().queryByText(/Create workspace in the sidebar/i)).not.toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(launcher).toHaveFocus())
  })
})

  it('keeps the conversation bounded to twenty exchanges', () => {
    render(<Assistant />)
    open()
    for (let index = 0; index < 21; index += 1) {
      fireEvent.change(screen.getByLabelText('Message the Kanvora Assistant'), { target: { value: `Message ${index}` } })
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    }
    // The oldest exchange is dropped, the newest is kept.
    expect(log().queryByText('Message 0')).not.toBeInTheDocument()
    expect(log().getByText('Message 20')).toBeInTheDocument()
  })

describe('assistant AI mode', () => {
  beforeEach(() => {
    axios.get.mockResolvedValue(aiStatus)
  })

  it('asks the backend, renders the reply as text, and never injects HTML', async () => {
    axios.post.mockResolvedValue({
      data: {
        payload: {
          reply: '<img src=x onerror="alert(1)">Here is the answer.',
          mode: 'ai',
          routes: [],
          projectContext: { included: false }
        }
      }
    })
    render(<Assistant />)
    open()
    expect(await screen.findByText('AI · test-flash')).toBeInTheDocument()
    ask('How do I invite someone?')

    expect(await log().findByText(/Here is the answer/)).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
    const body = axios.post.mock.calls[0][1]
    expect(body).toEqual({ message: 'How do I invite someone?', history: [] })
  })

  it('sends bounded history and never a client-authored system turn', async () => {
    axios.post.mockImplementation((url, body) => Promise.resolve({
      data: { payload: { reply: `Answer to ${body.message}`, mode: 'ai', routes: [], projectContext: { included: false } } }
    }))
    render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')
    for (let index = 0; index < 12; index += 1) {
      ask(`Question ${index}`)
      await log().findByText(`Answer to Question ${index}`)
    }
    const body = axios.post.mock.calls.at(-1)[1]
    expect(body.history.length).toBeLessThanOrEqual(10)
    expect(body.history.every((turn) => ['user', 'assistant'].includes(turn.role))).toBe(true)
  })

  it('keeps a long answer inside the history budget of the next request', async () => {
    const long = 'S'.repeat(2500)
    axios.post.mockImplementation((url, body) => Promise.resolve({
      data: { payload: { reply: `Answer ${body.message} ${long}`, mode: 'ai', routes: [], projectContext: { included: false } } }
    }))
    render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')

    for (let index = 0; index < 4; index += 1) {
      ask(`Question ${index}`)
      await log().findByText(new RegExp(`Answer Question ${index}`))
    }
    ask('Final question')
    await log().findByText(/Answer Final question/)

    const body = axios.post.mock.calls.at(-1)[1]
    const total = body.message.length + body.history.reduce((sum, turn) => sum + turn.content.length, 0)
    expect(total).toBeLessThanOrEqual(8000)
    for (const turn of body.history) {
      expect(turn.content.length).toBeLessThanOrEqual(turn.role === 'assistant' ? 4000 : 1000)
    }
  })

  it('falls back to built-in help and says so when the provider fails', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'The assistant is busy right now.' } } })
    render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')
    ask('How do I create a workspace?')

    expect(await screen.findByRole('alert')).toHaveTextContent(/busy/i)
    expect(log().getByText(/Create workspace in the sidebar/i)).toBeInTheDocument()
    expect(screen.queryByText(/AI · test-flash/)).toBeInTheDocument()
  })

  it('shares project context only after an explicit opt-in', async () => {
    projects.list = [{ _id: '507f1f77bcf86cd799439011', name: 'Launch plan' }]
    axios.post.mockImplementation((url, body) => Promise.resolve({
      data: {
        payload: {
          reply: 'The launch is on track.', mode: 'ai', routes: [],
          projectContext: body.includeProjectContext
            ? { included: true, projectName: 'Launch plan', truncated: true, cardCount: 50, totalCards: 80 }
            : { included: false }
        }
      }
    }))
    render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')

    ask('Summarize this project')
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1))
    expect(axios.post.mock.calls[0][1].includeProjectContext).toBeUndefined()

    fireEvent.change(screen.getByLabelText('Project to share with the assistant'), { target: { value: '507f1f77bcf86cd799439011' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Include read-only context/i }))
    expect(screen.getByText(/sent to Google Gemini/i)).toBeInTheDocument()

    ask('Summarize this project again')
    const body = axios.post.mock.calls.at(-1)[1]
    expect(body.projectId).toBe('507f1f77bcf86cd799439011')
    expect(body.includeProjectContext).toBe(true)
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2))
    expect(await log().findByText(/partial snapshot/i)).toBeInTheDocument()
  })

  it('clears prior project transcript when consent is withdrawn and sends no old history', async () => {
    projects.list = [
      { _id: 'project-a', name: 'Project A' },
      { _id: 'project-b', name: 'Project B' }
    ]
    axios.post.mockImplementation((url, body) => Promise.resolve({
      data: { payload: { reply: `Answer ${body.message}`, mode: 'ai', routes: [], projectContext: { included: Boolean(body.includeProjectContext) } } }
    }))
    render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')
    fireEvent.change(screen.getByLabelText('Project to share with the assistant'), { target: { value: 'project-a' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Include read-only context/i }))
    ask('Discuss Project A')
    await log().findByText('Answer Discuss Project A')
    expect(axios.post.mock.calls[0][1]).toMatchObject({ projectId: 'project-a', includeProjectContext: true, history: [] })

    fireEvent.click(screen.getByRole('checkbox', { name: /Include read-only context/i }))
    await waitFor(() => expect(log().queryByText('Discuss Project A')).not.toBeInTheDocument())
    ask('Continue without sharing')
    await log().findByText('Answer Continue without sharing')
    expect(axios.post.mock.calls[1][1]).toEqual({ message: 'Continue without sharing', history: [] })
  })

  it('switches project consent scope without reusing the previous project transcript', async () => {
    projects.list = [
      { _id: 'project-a', name: 'Project A' },
      { _id: 'project-b', name: 'Project B' }
    ]
    axios.post.mockImplementation((url, body) => Promise.resolve({
      data: { payload: { reply: `Answer ${body.message}`, mode: 'ai', routes: [], projectContext: { included: true } } }
    }))
    render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')
    const project = screen.getByLabelText('Project to share with the assistant')
    fireEvent.change(project, { target: { value: 'project-a' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Include read-only context/i }))
    ask('Private Project A detail')
    await log().findByText('Answer Private Project A detail')

    fireEvent.change(project, { target: { value: 'project-b' } })
    await waitFor(() => expect(log().queryByText('Private Project A detail')).not.toBeInTheDocument())
    ask('Project B question')
    await log().findByText('Answer Project B question')
    expect(axios.post.mock.calls[1][1]).toMatchObject({ projectId: 'project-b', includeProjectContext: true, history: [] })
  })

  it('retires an in-flight response and clears the transcript when the account changes', async () => {
    let resolveReply
    axios.get.mockResolvedValue(aiStatus)
    axios.post.mockImplementation(() => new Promise((resolve) => { resolveReply = resolve }))
    const view = render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')
    ask('Old account question')
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1))

    auth.currentUser = { _id: 'user-2', name: 'Grace' }
    view.rerender(<Assistant />)
    await waitFor(() => expect(log().queryByText('Old account question')).not.toBeInTheDocument())
    resolveReply({ data: { payload: { reply: 'Old account secret', routes: [] } } })
    await waitFor(() => expect(log().queryByText('Old account secret')).not.toBeInTheDocument())
  })

  it('refuses a duplicate submission while a request is in flight', async () => {
    let resolve
    axios.post.mockImplementation(() => new Promise((done) => { resolve = done }))
    render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')
    const input = screen.getByLabelText('Message the Kanvora Assistant')
    fireEvent.change(input, { target: { value: 'One question' } })
    const send = screen.getByRole('button', { name: 'Send message' })
    fireEvent.click(send)
    fireEvent.click(send)
    expect(axios.post).toHaveBeenCalledTimes(1)
    resolve({ data: { payload: { reply: 'Done', mode: 'ai', routes: [], projectContext: { included: false } } } })
    expect(await log().findByText('Done')).toBeInTheDocument()
  })

  it('discards an answer that arrives after the conversation was cleared', async () => {
    let resolve
    axios.post.mockImplementation(() => new Promise((done) => { resolve = done }))
    render(<Assistant />)
    open()
    await screen.findByText('AI · test-flash')
    const input = screen.getByLabelText('Message the Kanvora Assistant')
    fireEvent.change(input, { target: { value: 'Slow question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await log().findByText('Slow question')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }))
    expect(log().queryByText('Slow question')).not.toBeInTheDocument()

    resolve({ data: { payload: { reply: 'Late answer', mode: 'ai', routes: [], projectContext: { included: false } } } })
    await waitFor(() => expect(screen.queryByText('Late answer')).not.toBeInTheDocument())
    expect(log().queryByText('Slow question')).not.toBeInTheDocument()
  })

  it('has no nested interactive controls', () => {
    const { container } = render(<Assistant />)
    open()
    expect(container.querySelectorAll('button button')).toHaveLength(0)
    expect(container.querySelectorAll('a button, button a')).toHaveLength(0)
  })
})
