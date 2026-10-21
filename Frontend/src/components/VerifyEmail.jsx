import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/authStore'

const validToken = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)

const fieldClass = 'w-full rounded-xl border border-[var(--kt-field-border)] bg-[var(--kt-surface)] px-3 py-2.5 text-sm text-[var(--kt-text)] placeholder:text-[var(--kt-muted)] focus:border-[var(--kt-accent)]'
const primaryClass = 'inline-flex items-center justify-center rounded-xl bg-[var(--kt-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--kt-on-accent)] transition-colors hover:bg-[var(--kt-accent-hover)] disabled:opacity-60'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const { hash } = useLocation()
  const { verifyEmail, resendVerification } = useAuth()
  const token = params.get('token') || new URLSearchParams(hash.replace(/^#/, '')).get('token')
  const [state, setState] = useState(validToken(token) ? 'ready' : 'invalid')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.')
      return
    }
    if (password !== confirmation) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await verifyEmail(token, { password })
      setState('verified')
    } catch (err) {
      setError(err.response?.data?.message || 'This link is invalid or has expired.')
      setState('invalid')
    } finally {
      setBusy(false)
    }
  }

  const resend = async (event) => {
    event.preventDefault()
    if (!email.trim()) return
    await resendVerification(email.trim())
    setResent(true)
  }

  return (
    <main className="surface-light min-h-screen bg-[var(--kt-bg)] flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-8 shadow-[0_4px_24px_rgba(16,37,34,0.10)]">
        <h1 id="verify-heading" className="text-center text-xl font-bold text-[var(--kt-text)]">
          {state === 'verified' ? 'Email verified' : state === 'invalid' ? 'Verification failed' : 'Finish verifying your email'}
        </h1>

        {state === 'ready' && (
          <form className="mt-5 flex flex-col gap-3" onSubmit={submit} aria-labelledby="verify-heading">
            <p className="text-sm text-[var(--kt-muted)]">
              Choose a password to claim this account. Any password chosen before this link was opened will stop working.
            </p>
            <label className="text-xs font-semibold text-[var(--kt-muted)]" htmlFor="verify-password">New password</label>
            <input id="verify-password" type="password" autoComplete="new-password" required value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClass} />
            <label className="text-xs font-semibold text-[var(--kt-muted)]" htmlFor="verify-confirmation">Confirm password</label>
            <input id="verify-confirmation" type="password" autoComplete="new-password" required value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={fieldClass} />
            {error && <p className="text-sm text-[var(--kt-danger)]" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className={primaryClass}>
              {busy ? 'Verifying…' : 'Verify email'}
            </button>
          </form>
        )}

        {state === 'verified' && (
          <div className="mt-4 text-center">
            <p className="text-sm text-[var(--kt-muted)]">Your account is ready. Sign in with the password you just chose.</p>
            <Link className={`${primaryClass} mt-5 px-5`} to="/login">Sign in</Link>
          </div>
        )}

        {state === 'invalid' && (
          <div className="mt-4">
            <p className="text-sm text-[var(--kt-muted)]">{error || 'This link is invalid or has expired. Request a new verification email.'}</p>
            {resent ? <p className="mt-4 text-sm text-[var(--kt-success)]" role="status">If verification is needed, an email was sent.</p> : (
              <form className="mt-5 flex flex-col gap-3" onSubmit={resend}>
                <label className="text-xs font-semibold text-[var(--kt-muted)]" htmlFor="verify-email">Email address</label>
                <input id="verify-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass} />
                <button type="submit" className={primaryClass}>Resend verification</button>
              </form>
            )}
            <Link className="mt-4 inline-block text-sm text-[var(--kt-accent-text)] underline-offset-2 hover:underline" to="/login">Back to login</Link>
          </div>
        )}
      </section>
    </main>
  )
}
