// ProtectedRoute component: guards authenticated routes.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/authStore'
import Assistant from './Assistant'
import {
  dashboardBgColor,
  dashboardMutedColor,
  dashboardPrimaryBg
} from '../Styles/common'

function ProtectedRoute({ children, requiredRole }) {
  const navigate = useNavigate()
  const { isAuthenticated, authChecked, loading, checkAuth, currentUser } =
    useAuth()

  useEffect(() => {
    if (!authChecked && !loading) {
      checkAuth()
    }
  }, [checkAuth, authChecked, loading])

  useEffect(() => {
    if (loading || !authChecked) return
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }
    if (requiredRole && currentUser?.role !== requiredRole) {
      navigate('/main-page', { replace: true })
    }
  }, [
    authChecked,
    loading,
    isAuthenticated,
    currentUser,
    requiredRole,
    navigate
  ])

  if (loading || !authChecked) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${dashboardBgColor}`}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className={`h-10 w-10 animate-spin rounded-full border-2 ${dashboardPrimaryBg.replace('bg-', 'border-')} border-t-transparent`}
          />
          <p className={`${dashboardMutedColor} text-sm`}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null
  if (requiredRole && currentUser?.role !== requiredRole) return null

  return (
    <>
      {children}
      <Assistant />
    </>
  )
}

export default ProtectedRoute
