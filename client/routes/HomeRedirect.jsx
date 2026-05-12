import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { homePathFor } from './paths'

// "/" opens the signed-in role's home page (Owner: Account Provision, Cashier: Sales, …)
export default function HomeRedirect() {
  const user = useSelector(selectCurrentUser)
  return <Navigate to={homePathFor(user)} replace />
}
