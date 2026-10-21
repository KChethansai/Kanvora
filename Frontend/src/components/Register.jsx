// Register component: renders a focused piece of the Kanvora UI.
import { useForm } from 'react-hook-form'
import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import kanvoraLogo from '../assets/kanvora-logo.png'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../store/authStore'
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

function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const inviteToken = inviteFromLocation(location)
  const prefillEmail = location.state?.email || ''
  const { setUser, isAuthenticated } = useAuth()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({ defaultValues: { email: prefillEmail } })

  useEffect(() => {
    if (isAuthenticated) navigate('/main-page', { replace: true })
  }, [isAuthenticated, navigate])

  // Google

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
            await axios.post(
              `${API_BASE_URL}/api/invitations/accept`,
              { token: inviteToken },
              { withCredentials: true }
            )
            toast.success('Invitation accepted')
          } catch {
            toast.error('Could not accept invitation')
          }
        }

        navigate('/main-page', { replace: true })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Google sign-up failed')
      }
    },
    [inviteToken, navigate, setUser]
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
        document.getElementById('google-register-btn'),
        { theme: 'outline', size: 'large', width: 320, text: 'signup_with' }
      )
    }).catch(() => {})
    return () => { cancelled = true }
  }, [handleGoogleCredential])

  // Email / password

  const onSubmit = async (data) => {
    try {
      const payload = {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role || 'MEMBER'
      }
      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload, {
        withCredentials: true
      })
      if (res.status === 201) {
        toast.success('Account created. Check your email to verify it, then log in.')
        navigate(`/login${inviteToken ? `#invite=${inviteToken}` : ''}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    }
  }

  return (
    <div className={loginContainer}>
            <form className={loginBox} onSubmit={handleSubmit(onSubmit)} aria-labelledby="register-heading">
        {/* logo */}
        <div className="flex justify-center mb-2">
          <img className="w-10 h-10" src={kanvoraLogo} alt="Kanvora" />
        </div>

        <h1 id="register-heading" className={`text-center text-xl font-bold mt-0 ${primaryText} mb-1`}>
          Sign up
        </h1>
        <p className={`text-center text-xs ${mutedText} mb-4`}>
          Create your free Kanvora account
        </p>

        {/* full name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="register-name" className={`text-xs font-medium ${mutedText}`}>
            Full Name
          </label>
          <input
            id="register-name"
            type="text"
            placeholder="Your name"
            autoComplete="name"
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? 'register-name-error' : undefined}
            className={loginInput}
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && (
            <p id="register-name-error" role="alert" className={errorClass}>
              {errors.name.message}
            </p>
          )}
        </div>

        {/* email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="register-email" className={`text-xs font-medium ${mutedText}`}>Email</label>
          <input
            id="register-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            className={loginInput}
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p id="register-email-error" role="alert" className={errorClass}>
              {errors.email.message}
            </p>
          )}
        </div>

        {/* password */}
        <div className="flex flex-col gap-1">
          <label htmlFor="register-password" className={`text-xs font-medium ${mutedText}`}>Password</label>
          <input
            id="register-password"
            type="password"
            placeholder="Min 8 characters"
            autoComplete="new-password"
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={errors.password ? 'register-password-error' : undefined}
            className={loginInput}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Minimum 8 characters' }
            })}
          />
          {errors.password && (
            <p id="register-password-error" role="alert" className={errorClass}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* confirm password */}
        <div className="flex flex-col gap-1">
          <label htmlFor="register-confirm-password" className={`text-xs font-medium ${mutedText}`}>
            Confirm Password
          </label>
          <input
            id="register-confirm-password"
            type="password"
            placeholder="********"
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? 'true' : undefined}
            aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
            className={loginInput}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (val) =>
                val === watch('password') || 'Passwords do not match'
            })}
          />
          {errors.confirmPassword && (
            <p id="register-confirm-error" role="alert" className={errorClass}>
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* role selection */}
        <div className="flex flex-col gap-1">
          <label htmlFor="register-role" className={`text-xs font-medium ${mutedText}`}>
            I want to register as a
          </label>
          <select
            id="register-role"
            className={`app-native-select ${loginInput}`}
            {...register('role', { required: 'Role is required' })}
            defaultValue="MEMBER"
          >
            <option value="MEMBER">User (Collaborator)</option>
            <option value="MANAGER">Manager</option>
          </select>
          {errors.role && (
            <p role="alert" className={errorClass}>
              {errors.role.message}
            </p>
          )}
        </div>

        <button type="submit" className={loginBtn} disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Continue'}
        </button>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="relative flex items-center my-2">
              <div className="grow border-t border-[#e5e5ea]" />
              <span className="mx-3 text-xs text-[#a1a1aa]">or sign up with</span>
              <div className="grow border-t border-[#e5e5ea]" />
            </div>
            <div id="google-register-btn" className="flex justify-center" />
          </>
        )}

        <div className="flex justify-center text-xs mt-3">
          <button
            type="button"
            className={`${accentText} hover:underline`}
            onClick={() => navigate('/login')}
          >
            Already have an account? Log in
          </button>
        </div>
      </form>
    </div>
  )
}

export default Register
