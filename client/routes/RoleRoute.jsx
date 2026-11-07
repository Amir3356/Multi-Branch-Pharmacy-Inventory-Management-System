import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { recordPageView } from '../api/auditLogsApi'
import { canOpen, homePathFor } from './paths'

// A page the user's role can't open sends them to their own home page instead. Opening one the role can is recorded
// in the audit trail (the server skips repeat visits within a few minutes).
export default function RoleRoute({ section, children }) {
  const user = useSelector(selectCurrentUser)
  const allowed = canOpen(user, section)

  useEffect(() => {
    if (allowed) recordPageView(section)
  }, [allowed, section, user?.id])

  if (!allowed) return <Navigate to={homePathFor(user)} replace />
  return children
}
