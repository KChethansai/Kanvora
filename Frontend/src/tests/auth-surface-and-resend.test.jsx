// Public auth surfaces must not leak deployment instructions, and registration
// activates and signs the user in immediately without mandatory email verification.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import Login from '../components/Login'
import Register from '../components/Register'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const auth = vi.hoisted(() => ({
  setUser: vi.fn(),
  isAuthenticated: false
}))

vi.mock('../store/authStore', () => ({
  useAuth: () => auth
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('axios')

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(cleanup)

describe('public auth surfaces', () => {
  it('never shows Google provider configuration instructions', () => {
    const { unmount } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    expect(document.body.textContent).not.toMatch(/VITE_GOOGLE_CLIENT_ID/i)
    expect(document.body.textContent).not.toMatch(/Google \(set/i)
    unmount()

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    expect(document.body.textContent).not.toMatch(/VITE_GOOGLE_CLIENT_ID/i)
    expect(document.body.textContent).not.toMatch(/Google \(set/i)
  })
})

describe('registration without email verification', () => {
  it('creates account, sets session user, and navigates directly to main page', async () => {
    axios.post.mockResolvedValueOnce({
      status: 201,
      data: {
        message: 'User created successfully',
        payload: { _id: 'u-1', name: 'Ada Lovelace', email: 'ada@example.com', role: 'MEMBER' }
      }
    })

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Ada Lovelace' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secret123!' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Secret123!' } })

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'Secret123!' }),
        { withCredentials: true }
      )
    })

    await waitFor(() => {
      expect(auth.setUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada Lovelace' }))
      expect(mockNavigate).toHaveBeenCalledWith('/main-page', { replace: true })
    })
  })
})
