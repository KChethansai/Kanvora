// Login component: renders a focused piece of the Kanvora UI.
import { useForm } from 'react-hook-form'
import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import kanvoraLogo from '../assets/kanvora-logo.png'
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
  accentText,
  primaryText,
  mutedText
} from '../Styles/common'

const validInviteToken = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)

// An invitation token is accepted once per browser session. A failed attempt
// is released again so the user can retry.
const acceptedInviteTokens = new Set()
const pendingInviteTokens = new Set()

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

  // The invitation is accepted exactly once, whether the account is already
  // signed in or is signing in through the invite link. The server deletes the
  // invitation after acceptance, so a second attempt would report a false
  // failure to the user.
  const acceptInvite = useCallback(async () => {
    // The accept endpoint only accepts a 64 character token.
    if (!validInviteToken(inviteToken)) return
    if (acceptedInviteTokens.has(inviteToken) || pendingInviteTokens.has(inviteToken)) return
    pendingInviteTokens.add(inviteToken)
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/invitations/accept`,
        { token: inviteToken },
        { withCredentials: true }
      )
      acceptedInviteTokens.add(inviteToken)
      await fetchWorkspaces()
      toast.success(res.data.message || 'Invitation accepted')
      navigate('/main-page', { replace: true })
    } catch (err) {
      // The invitation is still valid server side: let the user try again.
      pendingInviteTokens.delete(inviteToken)
      toast.error(
        err.response?.data?.message || 'Could not accept invitation'
      )
    } finally {
      pendingInviteTokens.delete(inviteToken)
    }
  }, [inviteToken, fetchWorkspaces, navigate])

  const onSubmit = async (data) => {
    try {
      await login(data)
    } catch {
      return
    }
    // if there's an invite token, accept it then refresh workspaces
    if (inviteToken) {
      await acceptInvite()
    }
    navigate('/main-page', { replace: true })
  }

  useEffect(() => {
    // if already authenticated and invite present, accept immediately
    if (isAuthenticated && inviteToken) {
      void acceptInvite()
    }
  }, [isAuthenticated, inviteToken, acceptInvite])

  return (
    <div className={loginContainer}>
            <form className={loginBox} onSubmit={handleSubmit(onSubmit)} aria-labelledby="login-heading">
        {/* logo */}
        <div className="flex justify-center mb-2">
          <img className="w-10 h-10" src={kanvoraLogo} alt="Kanvora" />
        </div>

        <h1 id="login-heading" className={`text-center text-xl font-bold mt-0 ${primaryText} mb-1`}>
          Log in
        </h1>
        <p className={`text-center text-xs ${mutedText} mb-4`}>
          Continue to your workspace
        </p>

        {/* email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="login-email" className={`text-xs font-medium ${mutedText}`}>Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            className={loginInput}
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p id="login-email-error" role="alert" className={errorClass}>
              {errors.email.message}
            </p>
          )}
        </div>

        {/* password */}
        <div className="flex flex-col gap-1">
          <label htmlFor="login-password" className={`text-xs font-medium ${mutedText}`}>Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="********"
            autoComplete="current-password"
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            className={loginInput}
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && (
            <p id="login-password-error" role="alert" className={errorClass}>
              {errors.password.message}
            </p>
          )}
        </div>

        <button type="submit" className={loginBtn} disabled={loading}>
          {loading ? 'Logging in...' : 'Continue'}
        </button>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="relative flex items-center my-2">
              <div className="grow border-t border-[#e5e5ea]" />
              <span className="mx-3 text-xs text-[#a1a1aa]">or continue with</span>
              <div className="grow border-t border-[#e5e5ea]" />
            </div>
            <div id="google-signin-btn" className="flex justify-center" />
          </>
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
