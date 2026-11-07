import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectCurrentUser, selectIsLoggedIn } from '../features/auth/store/authSlice'
import { homePathFor } from './paths'

// Sign-in pages are only for signed-out users; once signed in, return to the page they asked for
export default function PublicOnlyRoute() {
  const isLoggedIn = useSelector(selectIsLoggedIn)
  const user = useSelector(selectCurrentUser)
  const location = useLocation()
  if (isLoggedIn) return <Navigate to={location.state?.from || homePathFor(user)} replace />
  return <Outlet />
}
