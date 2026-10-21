import { useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../store/authStore'
import { BsColumnsGap } from 'react-icons/bs'
import toast from 'react-hot-toast'

const fieldClass = 'w-full rounded-xl border border-[var(--kt-field-border)] bg-[var(--kt-surface)] px-3 py-2.5 text-sm text-[var(--kt-text)] placeholder:text-[var(--kt-muted)] focus:border-[var(--kt-accent)]'

export default function ResetPassword() {
  const { token: pathToken } = useParams()
  const { hash } = useLocation()
  const hashToken = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  const token = pathToken || hashToken
  const navigate = useNavigate()
  const { resetPassword } = useAuth()

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token) return toast.error('This reset link is invalid or has expired.')
    if (!password || password.length < 8)
      return toast.error('Password must be at least 8 characters.')
    try {
      setLoading(true)
      await resetPassword(token, { password })
      toast.success('Password successfully reset!')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="surface-light min-h-screen bg-[var(--kt-bg)] flex flex-col items-center justify-center p-4 font-apple">
      <div className="flex items-center gap-2 mb-8 select-none">
        <div className="bg-[var(--kt-accent)] p-1.5 rounded text-[var(--kt-on-accent)] flex items-center justify-center">
          <BsColumnsGap className="text-xl" />
        </div>
        <span className="text-3xl font-extrabold text-[var(--kt-text)] tracking-tight">
          Kanvora
        </span>
      </div>

      <div className="w-full max-w-sm bg-[var(--kt-surface)] rounded-2xl shadow-[0_4px_24px_rgba(16,37,34,0.10)] border border-[var(--kt-border)] p-8">
        <h1 id="reset-heading" className="text-center text-xl font-bold text-[var(--kt-text)] mb-6">
          Reset Password
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-labelledby="reset-heading">
          <div>
            <label htmlFor="reset-password" className="text-xs font-semibold text-[var(--kt-muted)] block mb-1">
              New Password
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[var(--kt-accent)] hover:bg-[var(--kt-accent-hover)] text-[var(--kt-on-accent)] font-semibold py-2.5 rounded-xl transition-colors mt-2 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>

          <div className="text-center mt-3 text-sm">
            <Link to="/login" className="text-[var(--kt-accent-text)] underline-offset-2 hover:underline">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
