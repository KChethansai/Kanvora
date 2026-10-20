import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { inviteFromLocation } from '../utils/inviteToken'

function AuthRedirect() {
  const navigate = useNavigate()
  const { hash, search } = useLocation()

  useEffect(() => {
    const invite = inviteFromLocation({ hash, search })
    const target = invite ? `/login#invite=${invite}` : '/login'
    navigate(target, { replace: true })
  }, [hash, search, navigate])

  return null
}

export default AuthRedirect
