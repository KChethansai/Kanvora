// Public auth surfaces must not leak deployment instructions, and the
// verification-email resend must report a failure instead of failing silently.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Login from '../components/Login'
import Register from '../components/Register'
import VerifyEmail from '../components/VerifyEmail'

const auth = vi.hoisted(() => ({
  resendVerification: vi.fn(),
  verifyEmail: vi.fn()
}))

vi.mock('../store/authStore', () => ({
  useAuth: () => auth
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))

beforeEach(() => {
  vi.resetAllMocks()
  auth.resendVerification.mockResolvedValue(undefined)
  auth.verifyEmail.mockResolvedValue(undefined)
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

describe('verification email resend', () => {
  const renderVerify = () =>
    render(
      <MemoryRouter initialEntries={['/verify-email?token=invalid']}>
        <VerifyEmail />
      </MemoryRouter>
    )

  it('reports a failed resend with an accessible alert and stays on the form', async () => {
    auth.resendVerification.mockRejectedValue(new Error('offline'))
    renderVerify()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'ada@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Resend verification' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not send a new verification email/i)
    expect(screen.getByRole('button', { name: 'Resend verification' })).toBeInTheDocument()
  })

  it('confirms a successful resend', async () => {
    renderVerify()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'ada@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Resend verification' }))

    await waitFor(() => expect(auth.resendVerification).toHaveBeenCalledWith('ada@example.com'))
    expect(await screen.findByRole('status')).toHaveTextContent(/verification is needed/i)
  })
})
