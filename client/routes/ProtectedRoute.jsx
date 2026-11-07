import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectIsLoggedIn } from '../features/auth/store/authSlice'
import { PATHS } from './paths'

// Dashboard pages need a signed-in user; otherwise go to the login page
export default function ProtectedRoute() {
  const isLoggedIn = useSelector(selectIsLoggedIn)
  const location = useLocation()
  if (!isLoggedIn) return <Navigate to={PATHS.login} replace state={{ from: location.pathname }} />
  return <Outlet />
}
