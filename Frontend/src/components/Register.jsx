// Register component: renders a focused piece of the Kanvora UI.
import { useForm } from 'react-hook-form'
import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import kanvoraLogo from '../assets/kanvora-logo.png'
import { FaGoogle } from 'react-icons/fa'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../store/authStore'
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config/api'
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

function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const inviteToken = new URLSearchParams(location.search).get('invite')
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

  useEffect(() => {
    document.body.style.backgroundColor = '#ffffff'
    return () => {
      document.body.style.backgroundColor = ''
    }
  }, [])

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
    if (!GOOGLE_CLIENT_ID || !window.google) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential
    })
    window.google.accounts.id.renderButton(
      document.getElementById('google-register-btn'),
      { theme: 'outline', size: 'large', width: 320, text: 'signup_with' }
    )
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
        navigate(`/login${inviteToken ? `?invite=${inviteToken}` : ''}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    }
  }

  return (
    <div className={loginContainer}>
      {GOOGLE_CLIENT_ID && (
        <script src="https://accounts.google.com/gsi/client" async defer />
      )}
      <form className={loginBox} onSubmit={handleSubmit(onSubmit)}>
        {/* logo */}
        <div className="flex justify-center mb-2">
          <img className="w-10 h-10" src={kanvoraLogo} alt="Kanvora" />
        </div>

        <h2 className={`text-center text-xl font-bold ${primaryText} mb-1`}>
          Sign up
        </h2>
        <p className={`text-center text-xs ${mutedText} mb-4`}>
          Create your free Kanvora account
        </p>

        {/* full name */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${mutedText}`}>
            Full Name
          </label>
          <input
            type="text"
            placeholder="Your name"
            className={loginInput}
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

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
            placeholder="Min 8 characters"
            className={loginInput}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Minimum 8 characters' }
            })}
          />
          {errors.password && (
            <p className={errorClass}>{errors.password.message}</p>
          )}
        </div>

        {/* confirm password */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${mutedText}`}>
            Confirm Password
          </label>
          <input
            type="password"
            placeholder="********"
            className={loginInput}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (val) =>
                val === watch('password') || 'Passwords do not match'
            })}
          />
          {errors.confirmPassword && (
            <p className={errorClass}>{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* role selection */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${mutedText}`}>
            I want to register as a
          </label>
          <select
            className={loginInput}
            {...register('role', { required: 'Role is required' })}
            defaultValue="MEMBER"
          >
            <option value="MEMBER">User (Collaborator)</option>
            <option value="MANAGER">Manager</option>
          </select>
          {errors.role && (
            <p className={errorClass}>{errors.role.message}</p>
          )}
        </div>

        <button type="submit" className={loginBtn} disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Continue'}
        </button>

        <div className="relative flex items-center my-2">
          <div className="grow border-t border-[#e5e5ea]" />
          <span className="mx-3 text-xs text-[#a1a1aa]">or sign up with</span>
          <div className="grow border-t border-[#e5e5ea]" />
        </div>

        {/* Google */}
        {GOOGLE_CLIENT_ID ? (
          <div id="google-register-btn" className="flex justify-center" />
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
