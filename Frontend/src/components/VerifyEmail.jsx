import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/authStore'

const validToken = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const { verifyEmail, resendVerification } = useAuth()
  const token = params.get('token')
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
    <main className="min-h-screen bg-[#f9fafc] flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-[#e5e5ea] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <h1 className="text-center text-xl font-bold text-[#111113]">
          {state === 'verified' ? 'Email verified' : state === 'invalid' ? 'Verification failed' : 'Finish verifying your email'}
        </h1>

        {state === 'ready' && (
          <form className="mt-5 flex flex-col gap-3" onSubmit={submit}>
            <p className="text-sm text-[#63636b]">
              Choose a password to claim this account. Any password chosen before this link was opened will stop working.
            </p>
            <label className="text-xs font-semibold text-[#63636b]" htmlFor="verify-password">New password</label>
            <input id="verify-password" type="password" autoComplete="new-password" required value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#d4d4d8] px-3 py-2.5 text-sm focus:outline-none focus:border-blue-600" />
            <label className="text-xs font-semibold text-[#63636b]" htmlFor="verify-confirmation">Confirm password</label>
            <input id="verify-confirmation" type="password" autoComplete="new-password" required value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-xl border border-[#d4d4d8] px-3 py-2.5 text-sm focus:outline-none focus:border-blue-600" />
            {error && <p className="text-sm text-[#b42318]" role="alert">{error}</p>}
            <button type="submit" disabled={busy}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {busy ? 'Verifying…' : 'Verify email'}
            </button>
          </form>
        )}

        {state === 'verified' && (
          <div className="mt-4 text-center">
            <p className="text-sm text-[#63636b]">Your account is ready. Sign in with the password you just chose.</p>
            <Link className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700" to="/login">Sign in</Link>
          </div>
        )}

        {state === 'invalid' && (
          <div className="mt-4">
            <p className="text-sm text-[#63636b]">{error || 'This link is invalid or has expired. Request a new verification email.'}</p>
            {resent ? <p className="mt-4 text-sm text-[#166534]" role="status">If verification is needed, an email was sent.</p> : (
              <form className="mt-5 flex flex-col gap-3" onSubmit={resend}>
                <label className="text-xs font-semibold text-[#63636b]" htmlFor="verify-email">Email address</label>
                <input id="verify-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-[#d4d4d8] px-3 py-2.5 text-sm focus:outline-none focus:border-blue-600" />
                <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Resend verification</button>
              </form>
            )}
            <Link className="mt-4 inline-block text-sm text-blue-600 hover:underline" to="/login">Back to login</Link>
          </div>
        )}
      </section>
    </main>
  )
}
