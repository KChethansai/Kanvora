import { useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../store/authStore'
import { BsColumnsGap } from 'react-icons/bs'
import toast from 'react-hot-toast'

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
    <div className="min-h-screen bg-[#f9fafc] flex flex-col items-center justify-center p-4 font-apple">
      <div className="flex items-center gap-2 mb-8 select-none">
        <div className="bg-[#ff4d67] p-1.5 rounded text-white flex items-center justify-center">
          <BsColumnsGap className="text-xl" />
        </div>
        <span className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
          Kanvora
        </span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[var(--border-light)] p-8">
        <h2 className="text-center text-xl font-bold text-[var(--text-main)] mb-6">
          Reset Password
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
              New Password
            </label>
            <input
              type="password"
              className="w-full border border-[var(--border-main)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors mt-2"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>

          <div className="text-center mt-3 text-sm">
            <Link to="/login" className="text-blue-600 hover:underline">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
