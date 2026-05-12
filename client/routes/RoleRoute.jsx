import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { recordPageView } from '../api/auditLogsApi'
import { canOpen, homePathFor } from './paths'

// A page the user's role can't open sends them to their own home page instead. Every opening of one the role can,
// including clicking its sidebar link again, is recorded in the audit trail as a View.
export default function RoleRoute({ section, children }) {
  const user = useSelector(selectCurrentUser)
  const allowed = canOpen(user, section)
  // A new key for every navigation, even to the page already open, so each sidebar click counts as a visit
  const { key: visit } = useLocation()

  useEffect(() => {
    if (allowed) recordPageView(section)
  }, [allowed, section, user?.id, visit])

  if (!allowed) return <Navigate to={homePathFor(user)} replace />
  return children
}
