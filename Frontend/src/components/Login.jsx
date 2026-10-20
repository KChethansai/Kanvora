// Login component: renders a focused piece of the Kanvora UI.
import { useForm } from 'react-hook-form'
import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import kanvoraLogo from '../assets/kanvora-logo.png'
import { FaGoogle } from 'react-icons/fa'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config/api'
import { inviteFromLocation } from '../utils/inviteToken'
import { loadGoogleIdentity } from '../utils/googleIdentity'
import {
  loginContainer,
  loginBox,
  loginInput,
  loginBtn,
  errorClass,
  errorText,
  accentText,
  primaryText,
  mutedText,
  defaultBorderColor
} from '../Styles/common'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const inviteToken = inviteFromLocation(location)
  const { login, loading, error, isAuthenticated, setUser } = useAuth()
  const { fetchWorkspaces } = useWorkspaceStore()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()

  useEffect(() => {
    document.body.style.backgroundColor = '#ffffff'
    return () => {
      document.body.style.backgroundColor = ''
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) navigate('/main-page', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  // Google One Tap

  const handleGoogleCredential = useCallback(
    async (response) => {
      try {
        const res = await axios.post(
          `${API_BASE_URL}/oauth/google`,
          { credential: response.credential },
          { withCredentials: true }
        )
        const user = res.data.payload
        setUser(user)
        toast.success(`Welcome, ${user.name}!`)

        // if there's an invite token, accept it
        if (inviteToken) {
          try {
            const inviteRes = await axios.post(
              `${API_BASE_URL}/api/invitations/accept`,
              { token: inviteToken },
              { withCredentials: true }
            )
            await fetchWorkspaces()
            toast.success(inviteRes.data.message || 'Invitation accepted')
          } catch (err) {
            toast.error(
              err.response?.data?.message || 'Could not accept invitation'
            )
          }
        }

        navigate('/main-page', { replace: true })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Google sign-in failed')
      }
    },
    [fetchWorkspaces, inviteToken, navigate, setUser]
  )

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    loadGoogleIdentity().then(() => {
      if (cancelled || !window.google) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential
      })
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', width: 320, text: 'signin_with' }
      )
    }).catch(() => {})
    return () => { cancelled = true }
  }, [handleGoogleCredential])

  // Email / password

  const onSubmit = async (data) => {
    try {
      await login(data)
    } catch {
      return
    }
    // if there's an invite token, accept it then refresh workspaces
    if (inviteToken) {
      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/invitations/accept`,
          { token: inviteToken },
          { withCredentials: true }
        )
        // refresh workspace list so member appears
        await fetchWorkspaces()
        toast.success(res.data.message || 'Invitation accepted')
      } catch (err) {
        toast.error(
          err.response?.data?.message || 'Could not accept invitation'
        )
      }
    }
    navigate('/main-page', { replace: true })
  }

  useEffect(() => {
    // if already authenticated and invite present, accept immediately
    if (isAuthenticated && inviteToken) {
      ;(async () => {
        try {
          const res = await axios.post(
            `${API_BASE_URL}/api/invitations/accept`,
            { token: inviteToken },
            { withCredentials: true }
          )
          await fetchWorkspaces()
          toast.success(res.data.message || 'Invitation accepted')
          navigate('/main-page', { replace: true })
        } catch (err) {
          toast.error(
            err.response?.data?.message || 'Could not accept invitation'
          )
        }
      })()
    }
  }, [isAuthenticated, inviteToken, fetchWorkspaces, navigate])

  return (
    <div className={loginContainer}>
      <form className={loginBox} onSubmit={handleSubmit(onSubmit)}>
        {/* logo */}
        <div className="flex justify-center mb-2">
          <img className="w-10 h-10" src={kanvoraLogo} alt="Kanvora" />
        </div>

        <h2 className={`text-center text-xl font-bold ${primaryText} mb-1`}>
          Log in
        </h2>
        <p className={`text-center text-xs ${mutedText} mb-4`}>
          Continue to your workspace
        </p>

        {/* email */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${mutedText}`}>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            className={loginInput}
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <p className={errorClass}>{errors.email.message}</p>}
        </div>

        {/* password */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${mutedText}`}>Password</label>
          <input
            type="password"
            placeholder="********"
            className={loginInput}
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && (
            <p className={errorClass}>{errors.password.message}</p>
          )}
        </div>

        <button type="submit" className={loginBtn} disabled={loading}>
          {loading ? 'Logging in...' : 'Continue'}
        </button>

        <div className="relative flex items-center my-2">
          <div className="grow border-t border-[#e5e5ea]" />
          <span className="mx-3 text-xs text-[#a1a1aa]">or continue with</span>
          <div className="grow border-t border-[#e5e5ea]" />
        </div>

        {/* Google - rendered by GSI SDK if client ID is set */}
        {GOOGLE_CLIENT_ID ? (
          <div id="google-signin-btn" className="flex justify-center" />
        ) : (
          <button
            type="button"
            className={`flex items-center justify-center gap-2 border ${defaultBorderColor} rounded-full py-2.5 text-sm ${primaryText} hover:bg-[#ffffff] transition-colors w-full`}
            disabled
          >
            <FaGoogle className={`${errorText}`} /> Google (set
            VITE_GOOGLE_CLIENT_ID to enable)
          </button>
        )}

        <div className="flex justify-between text-xs mt-3">
          <button type="button" className={`${accentText} hover:underline`} onClick={() => navigate('/forgot-password')}>
            Can't log in?
          </button>
          <button
            type="button"
            className={`${accentText} hover:underline`}
            onClick={() => navigate(inviteToken ? `/register#invite=${inviteToken}` : '/register')}
          >
            Create account
          </button>
        </div>
      </form>
    </div>
  )
}

export default Login
