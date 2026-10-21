import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { BsPencil, BsCamera, BsX, BsLock } from 'react-icons/bs'
import toast from 'react-hot-toast'
import { useAuth } from '../store/authStore'
import {
  dashboardField,
  dashboardFieldReadonly,
  dashboardMutedColor,
  dashboardPrimaryBg,
  dashboardPrimaryBgHover,
  dashboardPrimaryText,
  dashboardSecondaryBtn,
  overlayCloseBtn,
  overlayHeader,
  overlayPanel,
  overlayTitle
} from '../Styles/common'

function UserProfile() {
  const navigate = useNavigate()
  const { currentUser, updateProfile, changePassword, checkAuth } = useAuth()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm()

  const {
    register: pwRegister,
    handleSubmit: pwHandleSubmit,
    reset: pwReset,
    watch: pwWatch,
    formState: { errors: pwErrors }
  } = useForm()

  useEffect(() => {
    if (currentUser) {
      reset({
        name: currentUser.name || '',
        bio: currentUser.bio || '',
        username: currentUser.username || ''
      })
    }
  }, [currentUser, reset])

  const getInitials = (name) => {
    if (!name) return 'U'

    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const onSubmit = async (data) => {
    try {
      setSaving(true)

      await updateProfile(data)
      await checkAuth()

      toast.success('Profile updated!')
      setEditing(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const onPasswordSubmit = async (data) => {
    try {
      setPwSaving(true)

      await changePassword({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword
      })

      toast.success('Password changed!')
      setShowPwForm(false)
      pwReset()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setPwSaving(false)
    }
  }

  const handleCancel = () => {
    reset({
      name: currentUser?.name || '',
      bio: currentUser?.bio || '',
      username: currentUser?.username || ''
    })

    setEditing(false)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-end">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/55"
        onClick={() => navigate('/main-page')}
      />

      {/* panel */}
      <div className={`${overlayPanel} overflow-y-auto app-scrollbar`}>
        {/* header */}
        <div className={overlayHeader}>
          <h2 className={overlayTitle}>Profile</h2>

          <button
            onClick={() => navigate('/main-page')}
            className={overlayCloseBtn}
            aria-label="Close profile"
          >
            <BsX className="text-xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 p-6">
          {/* avatar section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-3">
              <div className="w-24 h-24 bg-[#579dff] rounded-full flex items-center justify-center text-white text-3xl font-bold overflow-hidden border-4 border-[#2c333a]">
                {currentUser?.profilePic ? (
                  <img
                    src={currentUser.profilePic}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(currentUser?.name)}</span>
                )}
              </div>

              {editing && (
                <button
                  type="button"
                  className={`absolute bottom-0 right-0 w-8 h-8 ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} rounded-full flex items-center justify-center ${dashboardPrimaryText} transition-colors shadow-lg`}
                  aria-label="Change avatar"
                >
                  <BsCamera className="text-xs" />
                </button>
              )}
            </div>

            <h3 className="text-lg font-bold text-white">
              {currentUser?.name || 'Kanvora User'}
            </h3>

            <p className={`text-sm ${dashboardMutedColor}`}>
              {currentUser?.email}
            </p>

            <span className="text-xs bg-[#ff4d67]/15 text-[#ff8aa0] px-3 py-1 rounded-full mt-2 font-medium">
              {currentUser?.role || 'VIEWER'}
            </span>
          </div>

          <div className="border-t border-[#2c333a] mb-6" />

          {/* about me */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-white">About Me</p>

              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-[#ff8aa0] hover:bg-[#ff4d67]/10 transition-colors"
                >
                  <BsPencil className="text-xs" />
                  Edit
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* full name */}
              <div>
                <label
                  htmlFor="profile-name"
                  className={`text-xs font-medium ${dashboardMutedColor} block mb-1`}
                >
                  Full Name
                </label>

                <input
                  id="profile-name"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'profile-name-error' : undefined}
                  className={editing ? dashboardField : dashboardFieldReadonly}
                  disabled={!editing}
                  {...register('name', {
                    required: 'Name is required'
                  })}
                />

                {errors.name && (
                  <p id="profile-name-error" role="alert" className="text-xs text-red-400 mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* username */}
              <div>
                <label
                  htmlFor="profile-username"
                  className={`text-xs font-medium ${dashboardMutedColor} block mb-1`}
                >
                  Username
                </label>

                <input
                  id="profile-username"
                  autoComplete="username"
                  className={editing ? dashboardField : dashboardFieldReadonly}
                  disabled={!editing}
                  placeholder="@yourhandle"
                  {...register('username')}
                />
              </div>

              {/* bio */}
              <div>
                <label
                  htmlFor="profile-bio"
                  className={`text-xs font-medium ${dashboardMutedColor} block mb-1`}
                >
                  Bio
                </label>

                <textarea
                  id="profile-bio"
                  rows={3}
                  disabled={!editing}
                  placeholder="Tell your team a bit about yourself..."
                  className={`${editing ? dashboardField : dashboardFieldReadonly} resize-none`}
                  {...register('bio')}
                />
              </div>

              {/* email */}
              <div>
                <label
                  htmlFor="profile-email"
                  className={`text-xs font-medium ${dashboardMutedColor} block mb-1`}
                >
                  Email
                </label>

                <input
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  disabled
                  readOnly
                  value={currentUser?.email || ''}
                  className={dashboardFieldReadonly}
                />

                <p className="text-xs text-[#6f7f8f] mt-1">
                  Email is managed by your account and cannot be changed from this profile.
                </p>
              </div>
            </div>

            {editing && (
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className={`${dashboardPrimaryBg} ${dashboardPrimaryBgHover} disabled:opacity-50 ${dashboardPrimaryText} font-semibold px-5 py-2 rounded-lg text-sm transition-colors`}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  className={dashboardSecondaryBtn}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </form>

        {/* security section */}
        <div className="px-6 pb-8 border-t border-[#2c333a]">
          <div className="flex items-center justify-between mt-6 mb-4">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <BsLock className="text-xs" />
              Security
            </p>

            {!showPwForm && (
              <button
                type="button"
                onClick={() => setShowPwForm(true)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-[#ff8aa0] hover:bg-[#ff4d67]/10 transition-colors"
              >
                Change password
              </button>
            )}
          </div>

          {showPwForm && (
            <form
              onSubmit={pwHandleSubmit(onPasswordSubmit)}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="profile-current-password"
                  className={`text-xs font-medium ${dashboardMutedColor} block mb-1`}
                >
                  Current password
                </label>

                <input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(pwErrors.oldPassword)}
                  aria-describedby={pwErrors.oldPassword ? 'profile-current-password-error' : undefined}
                  className={dashboardField}
                  {...pwRegister('oldPassword', {
                    required: 'Required'
                  })}
                />

                {pwErrors.oldPassword && (
                  <p id="profile-current-password-error" role="alert" className="text-xs text-red-400 mt-0.5">
                    {pwErrors.oldPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="profile-new-password"
                  className={`text-xs font-medium ${dashboardMutedColor} block mb-1`}
                >
                  New password
                </label>

                <input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(pwErrors.newPassword)}
                  aria-describedby={pwErrors.newPassword ? 'profile-new-password-error' : undefined}
                  className={dashboardField}
                  {...pwRegister('newPassword', {
                    required: 'Required',
                    minLength: {
                      value: 8,
                      message: 'Minimum 8 characters'
                    }
                  })}
                />

                {pwErrors.newPassword && (
                  <p id="profile-new-password-error" role="alert" className="text-xs text-red-400 mt-0.5">
                    {pwErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="profile-confirm-password"
                  className={`text-xs font-medium ${dashboardMutedColor} block mb-1`}
                >
                  Confirm new password
                </label>

                <input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(pwErrors.confirmPassword)}
                  aria-describedby={pwErrors.confirmPassword ? 'profile-confirm-password-error' : undefined}
                  className={dashboardField}
                  {...pwRegister('confirmPassword', {
                    required: 'Required',
                    validate: (v) =>
                      v === pwWatch('newPassword') || 'Passwords do not match'
                  })}
                />

                {pwErrors.confirmPassword && (
                  <p id="profile-confirm-password-error" role="alert" className="text-xs text-red-400 mt-0.5">
                    {pwErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className={`${dashboardPrimaryBg} ${dashboardPrimaryBgHover} disabled:opacity-50 ${dashboardPrimaryText} font-semibold px-5 py-2 rounded-lg text-sm transition-colors`}
                >
                  {pwSaving ? 'Saving...' : 'Update password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPwForm(false)
                    pwReset()
                  }}
                  className={dashboardSecondaryBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserProfile
