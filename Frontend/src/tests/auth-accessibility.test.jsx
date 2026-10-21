import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Login from '../components/Login'
import Register from '../components/Register'
import ForgotPassword from '../components/ForgotPassword'
import ResetPassword from '../components/ResetPassword'
import VerifyEmail from '../components/VerifyEmail'

vi.mock('../store/authStore', () => ({
  useAuth: () => ({
    login: vi.fn(),
    loading: false,
    error: null,
    isAuthenticated: false,
    setUser: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn()
  })
}))
vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({ fetchWorkspaces: vi.fn() })
}))

const mount = (ui, entries = ['/']) =>
  render(<MemoryRouter initialEntries={entries}>{ui}</MemoryRouter>)

afterEach(cleanup)

describe('auth forms expose programmatic labels', () => {
  it('labels both Login fields and names the form', () => {
    mount(<Login />)
    expect(screen.getByRole('form', { name: 'Log in' })).toBeInTheDocument()
    const email = screen.getByLabelText('Email')
    const password = screen.getByLabelText('Password')
    expect(email).toHaveAttribute('id', 'login-email')
    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(password).toHaveAttribute('id', 'login-password')
  })

  it('labels every Register field including the role select', () => {
    mount(<Register />)
    expect(screen.getByRole('form', { name: 'Sign up' })).toBeInTheDocument()
    for (const label of ['Full Name', 'Email', 'Password', 'Confirm Password', 'I want to register as a']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('labels the recovery and reset password fields', () => {
    mount(<ForgotPassword />)
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('id', 'forgot-email')
    cleanup()

    mount(<ResetPassword />, ['/reset/token'])
    expect(screen.getByLabelText('New Password')).toHaveAttribute('id', 'reset-password')
  })
})

describe('verification screen semantics and contrast tokens', () => {
  const token = 'a'.repeat(64)

  it('uses the scoped light surface and inverse-ink button tokens', () => {
    mount(<VerifyEmail />, [`/verify?token=${token}`])
    const heading = screen.getByRole('heading', { name: 'Finish verifying your email' })
    expect(heading.closest('main')).toHaveClass('surface-light')
    expect(screen.getByLabelText('New password')).toHaveAttribute('id', 'verify-password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('id', 'verify-confirmation')

    const submit = screen.getByRole('button', { name: 'Verify email' })
    expect(submit.className).toContain('text-[var(--kt-on-accent)]')
    expect(submit.className).toContain('bg-[var(--kt-accent)]')
    expect(submit.className).not.toContain('text-white')
  })

  it('labels the resend field and uses semantic success/danger colours', () => {
    mount(<VerifyEmail />, ['/verify?token=expired'])
    expect(screen.getByRole('heading', { name: 'Verification failed' })).toBeInTheDocument()
    const email = screen.getByLabelText('Email address')
    expect(email).toHaveAttribute('id', 'verify-email')
    expect(screen.getByRole('button', { name: 'Resend verification' }).className).toContain('text-[var(--kt-on-accent)]')
  })
})
